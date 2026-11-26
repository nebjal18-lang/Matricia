import { z } from "zod";
import { resolveClientOrganizationContext } from "@/modules/shared/client-organization-context";
import type { ClientRecurringRepository, RecurringFailure, RecurringResult } from "./contracts";
import { cadence, clientRecurringRole, cloneInput, createPlanInput, generateInput, isoDate, planStatus, recurringUuid, requestStatus, transitionPlanInput, type RecurringDashboard } from "./model";

type Query = { data: unknown; error: { code?: string; message?: string } | null };
export type ClientRecurringSource = {
  user(): Promise<string | null>;
  memberships(userId: string): Promise<Query>;
  roles(membershipIds: string[]): Promise<Query>;
  requests(organizationId: string): Promise<Query>;
  requestVersions(ids: string[]): Promise<Query>;
  plans(organizationId: string): Promise<Query>;
  planVersions(ids: string[]): Promise<Query>;
  occurrences(ids: string[]): Promise<Query>;
  rpc(name: string, input: Record<string, unknown>): Promise<Query>;
};

const requestRow = z.object({ id: recurringUuid, client_organization_id: recurringUuid, current_version_id: recurringUuid.nullable(), status: requestStatus, created_at: z.string() }).strict();
const requestVersionRow = z.object({ id: recurringUuid, request_id: recurringUuid, version_number: z.number().int().positive(), description: z.string().min(1), desired_date: isoDate.nullable() }).strict();
const planRow = z.object({ id: recurringUuid, client_organization_id: recurringUuid, template_request_id: recurringUuid, status: planStatus, current_version: z.number().int().positive(), row_version: z.number().int().positive(), updated_at: z.string() }).strict();
const planVersionRow = z.object({ id: recurringUuid, plan_id: recurringUuid, version_number: z.number().int().positive(), cadence, starts_on: isoDate, ends_on: isoDate.nullable(), status: planStatus, reason: z.string().min(3).max(500) }).strict();
const occurrenceRow = z.object({ id: recurringUuid, plan_id: recurringUuid, scheduled_on: isoDate, generated_request_id: recurringUuid, created_at: z.string() }).strict();
const membershipRow = z.object({ id: recurringUuid, organization_id: recurringUuid }).strict();
const roleRow = z.object({ membership_id: recurringUuid, role_code: clientRecurringRole, revoked_at: z.string().nullable() }).strict();
const cloned = z.object({ outcome: z.literal("SERVICE_REQUEST_CLONED"), request_id: recurringUuid, request_version_id: recurringUuid, status: z.literal("DRAFT") }).passthrough();
const created = z.object({ outcome: z.literal("RECURRING_PLAN_CREATED"), plan_id: recurringUuid, plan_version_id: recurringUuid, status: z.literal("ACTIVE") }).passthrough();
const transitioned = z.object({ outcome: z.enum(["RECURRING_PLAN_ACTIVE", "RECURRING_PLAN_PAUSED", "RECURRING_PLAN_ENDED"]), plan_id: recurringUuid, plan_version_id: recurringUuid, status: planStatus, row_version: z.number().int().positive() }).passthrough();
const generated = z.object({ outcome: z.literal("RECURRING_REQUESTS_GENERATED"), plan_id: recurringUuid, plan_version_id: recurringUuid, generated_count: z.number().int().min(0).max(24), through_date: isoDate, autonomous_invitations: z.literal(false), autonomous_spend: z.literal(false) }).passthrough();

function failure(error: Query["error"]): RecurringResult<never> {
  const message = error?.message ?? "";
  const known: Array<[string, RecurringFailure]> = [["SERVICE_NOT_RECURRING_ELIGIBLE", "NOT_ELIGIBLE"], ["RECURRING_PLAN_NOT_ACTIVE", "NOT_ACTIVE"], ["INVALID_RECURRING_TRANSITION", "INVALID_TRANSITION"], ["RECURRING_GENERATION_BOUNDS_EXCEEDED", "BOUNDS_EXCEEDED"], ["RECURRING_TOTAL_ITERATION_LIMIT_REACHED", "BOUNDS_EXCEEDED"], ["STALE_RECURRING_PLAN_VERSION", "CONFLICT"], ["IDEMPOTENCY_PAYLOAD_MISMATCH", "CONFLICT"], ["IDEMPOTENCY_IN_PROGRESS", "CONFLICT"]];
  const domain = known.find(([code]) => message.includes(code));
  if (domain) return { status: "error", reason: domain[1] };
  return { status: "error", reason: error?.code === "42501" ? "FORBIDDEN" : (error?.code === "40001" || error?.code === "PT409") ? "CONFLICT" : error?.code === "22023" ? "INVALID_INPUT" : "UNAVAILABLE" };
}

function parseRows<T>(schema: z.ZodType<T>, query: Query, max: number): RecurringResult<T[]> {
  if (query.error) return failure(query.error);
  const parsed = z.array(schema).max(max).safeParse(query.data);
  return parsed.success ? { status: "success", value: parsed.data } : { status: "error", reason: "INVALID_RESPONSE" };
}

export function createClientRecurringRepository(source: ClientRecurringSource): ClientRecurringRepository {
  return {
    async load(requestedOrganizationId) {
      const userId = await source.user();
      if (!userId) return { status: "error", reason: "UNAUTHENTICATED" };
      const memberships = parseRows(membershipRow, await source.memberships(userId), 100);
      if (memberships.status === "error") return memberships;
      const roles = parseRows(roleRow, await source.roles(memberships.value.map((item) => item.id)), 300);
      if (roles.status === "error") return roles;
      const organizationByMembership = new Map(memberships.value.map((membership) => [membership.id, membership.organization_id]));
      const authorized = roles.value.filter((role) => role.revoked_at === null).flatMap((role) => { const organizationId = organizationByMembership.get(role.membership_id); return organizationId ? [{ organization_id: organizationId, role: role.role_code }] : []; });
      const context = resolveClientOrganizationContext(authorized, requestedOrganizationId);
      if (context.status === "error") return { status: "error", reason: "FORBIDDEN" };
      const selectedOrganizationId = context.membership.organization_id;
      const activeRoles = new Set(authorized.filter((role) => role.organization_id === selectedOrganizationId).map((role) => role.role));
      const writableOrganizations = new Set(authorized.filter((role) => role.organization_id === selectedOrganizationId && role.role !== "CLIENT_VIEWER").map((role) => role.organization_id));
      const roleOrder = ["CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_BUYER", "CLIENT_VIEWER"] as const;
      const activeRole = roleOrder.find((role) => activeRoles.has(role));
      if (!activeRole) return { status: "error", reason: "FORBIDDEN" };
      const canManage = writableOrganizations.size > 0;
      const [requestsQuery, plansQuery] = await Promise.all([source.requests(selectedOrganizationId), source.plans(selectedOrganizationId)]);
      const requests = parseRows(requestRow, requestsQuery, 200), plans = parseRows(planRow, plansQuery, 100);
      if (requests.status === "error") return requests;
      if (plans.status === "error") return plans;
      const [versionsQuery, planVersionsQuery, occurrencesQuery] = await Promise.all([source.requestVersions(requests.value.map((item) => item.id)), source.planVersions(plans.value.map((item) => item.id)), source.occurrences(plans.value.map((item) => item.id))]);
      const versions = parseRows(requestVersionRow, versionsQuery, 400), planVersions = parseRows(planVersionRow, planVersionsQuery, 500), occurrences = parseRows(occurrenceRow, occurrencesQuery, 2400);
      if (versions.status === "error") return versions;
      if (planVersions.status === "error") return planVersions;
      if (occurrences.status === "error") return occurrences;
      const requestVersions = new Map(versions.value.map((item) => [item.id, item]));
      const currentPlanVersions = new Map(planVersions.value.map((item) => [`${item.plan_id}:${item.version_number}`, item]));
      const dashboard: RecurringDashboard = {
        access: { activeRole, canManage },
        requests: requests.value.flatMap((item) => { const version = item.current_version_id ? requestVersions.get(item.current_version_id) : undefined; return version ? [{ id: item.id, canManage: writableOrganizations.has(item.client_organization_id), status: item.status, description: version.description, desiredDate: version.desired_date, versionNumber: version.version_number, createdAt: item.created_at }] : []; }),
        plans: plans.value.flatMap((item) => { const version = currentPlanVersions.get(`${item.id}:${item.current_version}`); return version ? [{ id: item.id, canManage: writableOrganizations.has(item.client_organization_id), templateRequestId: item.template_request_id, status: item.status, rowVersion: item.row_version, currentVersion: item.current_version, cadence: version.cadence, startsOn: version.starts_on, endsOn: version.ends_on, reason: version.reason, updatedAt: item.updated_at, occurrences: occurrences.value.filter((entry) => entry.plan_id === item.id).map((entry) => ({ id: entry.id, scheduledOn: entry.scheduled_on, generatedRequestId: entry.generated_request_id, createdAt: entry.created_at })) }] : []; }),
      };
      return { status: "success", value: dashboard };
    },
    async clone(input) {
      const parsed = cloneInput.safeParse({ ...input, desiredDate: input.desiredDate ?? "" });
      if (!parsed.success) return { status: "error", reason: "INVALID_INPUT" };
      const result = await source.rpc("clone_service_request", { p_source_request_id: input.sourceRequestId, p_desired_date: input.desiredDate, p_change_reason: input.reason.trim(), p_idempotency_key: input.idempotencyKey, p_correlation_id: input.correlationId });
      if (result.error) return failure(result.error); const response = cloned.safeParse(result.data);
      return response.success ? { status: "success", value: { requestId: response.data.request_id, requestVersionId: response.data.request_version_id, status: response.data.status } } : { status: "error", reason: "INVALID_RESPONSE" };
    },
    async createPlan(input) {
      const parsed = createPlanInput.safeParse({ ...input, endsOn: input.endsOn ?? "" });
      if (!parsed.success) return { status: "error", reason: "INVALID_INPUT" };
      const result = await source.rpc("create_recurring_service_plan", { p_template_request_id: input.templateRequestId, p_cadence: input.cadence, p_starts_on: input.startsOn, p_ends_on: input.endsOn, p_reason: input.reason.trim(), p_idempotency_key: input.idempotencyKey, p_correlation_id: input.correlationId });
      if (result.error) return failure(result.error); const response = created.safeParse(result.data);
      return response.success ? { status: "success", value: { planId: response.data.plan_id, planVersionId: response.data.plan_version_id, status: response.data.status } } : { status: "error", reason: "INVALID_RESPONSE" };
    },
    async transition(input) {
      if (!transitionPlanInput.safeParse(input).success) return { status: "error", reason: "INVALID_INPUT" };
      const result = await source.rpc("transition_recurring_service_plan", { p_plan_id: input.planId, p_action: input.action, p_reason: input.reason.trim(), p_expected_row_version: input.expectedRowVersion, p_idempotency_key: input.idempotencyKey, p_correlation_id: input.correlationId });
      if (result.error) return failure(result.error); const response = transitioned.safeParse(result.data);
      return response.success ? { status: "success", value: { planId: response.data.plan_id, planVersionId: response.data.plan_version_id, status: response.data.status, rowVersion: response.data.row_version } } : { status: "error", reason: "INVALID_RESPONSE" };
    },
    async generate(input) {
      if (!generateInput.safeParse(input).success) return { status: "error", reason: "INVALID_INPUT" };
      const result = await source.rpc("generate_recurring_service_requests", { p_plan_id: input.planId, p_through_date: input.throughDate, p_max_occurrences: input.maxOccurrences, p_idempotency_key: input.idempotencyKey, p_correlation_id: input.correlationId });
      if (result.error) return failure(result.error); const response = generated.safeParse(result.data);
      return response.success ? { status: "success", value: { planId: response.data.plan_id, planVersionId: response.data.plan_version_id, generatedCount: response.data.generated_count, throughDate: response.data.through_date, autonomousInvitations: response.data.autonomous_invitations, autonomousSpend: response.data.autonomous_spend } } : { status: "error", reason: "INVALID_RESPONSE" };
    },
  };
}

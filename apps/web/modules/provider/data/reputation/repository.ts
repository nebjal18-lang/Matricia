import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { z } from "zod";
import { resolveClientOrganizationContext } from "@/modules/shared/client-organization-context";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { reputationDimensions, type ClientFavoritesDashboard, type FeedbackAxis, type ProviderReputationDashboard } from "./model";

const id = z.string().uuid();
const membership = z.object({ id, organization_id: id, organizations: z.object({ display_name: z.string().min(1) }), organization_member_roles: z.array(z.object({ role_code: z.string(), revoked_at: z.string().nullable() })).min(1) });
const feedbackAxis = z.object({ dimension: z.enum(reputationDimensions), message_fr: z.string().min(3), message_ar: z.string().min(3) }).strict();
const feedback = z.object({ ranking_position: z.number().int().positive(), ranked_quote_count: z.number().int().min(2), improvement_axes: z.array(feedbackAxis).min(1).max(6), methodology_version: z.string(), published_at: z.string() });
const snapshot = z.object({ id, service_id: id.nullable(), version_number: z.number().int().positive(), policy_version: z.string(), quality_basis_points: z.number().int(), delivery_basis_points: z.number().int(), compliance_basis_points: z.number().int(), responsiveness_basis_points: z.number().int(), satisfaction_basis_points: z.number().int(), finance_basis_points: z.number().int(), overall_basis_points: z.number().int(), evidence_count: z.number().int().positive(), calculated_at: z.string() });
const evaluation = z.object({ id, service_id: id.nullable(), badge_policy_id: id, evaluation_version: z.number().int().positive(), eligible: z.boolean(), evaluated_basis_points: z.number().int() });
const badgePolicy = z.object({ id, badge_code: z.string(), label_fr: z.string(), label_ar: z.string() });
const decision = z.object({ evaluation_id: id, decision_version: z.number().int().positive(), action: z.enum(["PUBLISHED", "REVOKED"]), rationale: z.string(), decided_at: z.string() });
const service = z.object({ id, current_published_version_id: id.nullable() });
const serviceVersion = z.object({ id, name_fr: z.string(), name_ar: z.string() });
const favorite = z.object({ id, provider_organization_id: id, service_id: id.nullable(), status: z.enum(["ACTIVE", "REMOVED"]), note: z.string().nullable(), row_version: z.number().int().positive(), created_at: z.string() });
const revalidation = z.object({ favorite_id: id, request_id: id, eligible: z.boolean(), exclusion_reasons: z.array(z.string()), checked_at: z.string() });
const request = z.object({ id, service_id: id, status: z.string() });
type Failure = { status: "error"; reason: "UNAUTHENTICATED" | "NO_ORGANIZATION" | "ORGANIZATION_SELECTION_REQUIRED" | "FORBIDDEN_ORGANIZATION" | "QUERY_FAILED" | "INVALID_RESPONSE" };

async function activeMembership(roleCodes: string[], requestedOrganizationId?: string, requireExplicitSelection = false) {
  const client = await getSupabaseServerClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  const authFailure = classifyAuthReadFailure(authError);
  if (authFailure) return { client, failure: { status: "error", reason: authFailure === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "QUERY_FAILED" } as Failure };
  if (!auth.user) return { client, failure: { status: "error", reason: "UNAUTHENTICATED" } as Failure };
  const result = await client.from("organization_memberships").select("id,organization_id,organizations!inner(display_name),organization_member_roles!inner(role_code,revoked_at)").eq("user_id", auth.user.id).eq("status", "ACTIVE").is("organization_member_roles.revoked_at", null).in("organization_member_roles.role_code", roleCodes).limit(100);
  if (result.error) return { client, failure: { status: "error", reason: "QUERY_FAILED" } as Failure };
  const parsed = z.array(membership).max(100).safeParse(result.data);
  if (!parsed.success) return { client, failure: { status: "error", reason: "INVALID_RESPONSE" } as Failure };
  if (!requireExplicitSelection && requestedOrganizationId === undefined) {
    const selected = parsed.data[0];
    return selected ? { client, membership: selected } : { client, failure: { status: "error", reason: "NO_ORGANIZATION" } as Failure };
  }
  const context = resolveClientOrganizationContext(parsed.data, requestedOrganizationId);
  if (context.status === "error") return { client, failure: { status: "error", reason: context.reason === "NO_CLIENT_ORGANIZATION" ? "NO_ORGANIZATION" : context.reason } as Failure };
  return { client, membership: context.membership };
}

async function serviceLabels(client: Awaited<ReturnType<typeof getSupabaseServerClient>>, serviceIds: string[]) {
  const unique = [...new Set(serviceIds)];
  if (!unique.length) return { status: "success" as const, labels: new Map<string, { fr: string; ar: string }>() };
  const servicesResult = await client.from("catalog_services").select("id,current_published_version_id").in("id", unique).limit(200);
  const services = z.array(service).safeParse(servicesResult.data);
  if (servicesResult.error || !services.success) return { status: "error" as const };
  const versionIds = services.data.flatMap((item) => item.current_published_version_id ? [item.current_published_version_id] : []);
  const versionsResult = versionIds.length ? await client.from("catalog_service_versions").select("id,name_fr,name_ar").in("id", versionIds).limit(200) : { data: [], error: null };
  const versions = z.array(serviceVersion).safeParse(versionsResult.data);
  if (versionsResult.error || !versions.success) return { status: "error" as const };
  const versionsById = new Map(versions.data.map((item) => [item.id, item]));
  return { status: "success" as const, labels: new Map(services.data.flatMap((item) => { const version = item.current_published_version_id ? versionsById.get(item.current_published_version_id) : null; return version ? [[item.id, { fr: version.name_fr, ar: version.name_ar }] as const] : []; })) };
}

export async function loadProviderReputation(requestedOrganizationId?: string): Promise<{ status: "success"; dashboard: ProviderReputationDashboard } | Failure> {
  const auth = await activeMembership(["PROVIDER_OWNER", "PROVIDER_MANAGER", "PROVIDER_SALES", "PROVIDER_VIEWER"], requestedOrganizationId, true);
  if (auth.failure) return auth.failure;
  const { client, membership: member } = auth;
  const organizationId = member.organization_id;
  const [feedbackResult, snapshotsResult, evaluationsResult, policiesResult, decisionsResult] = await Promise.all([
    client.rpc("list_my_anonymized_provider_feedback", { p_limit: 50 }),
    client.from("provider_reputation_snapshots").select("id,service_id,version_number,policy_version,quality_basis_points,delivery_basis_points,compliance_basis_points,responsiveness_basis_points,satisfaction_basis_points,finance_basis_points,overall_basis_points,evidence_count,calculated_at").eq("provider_organization_id", organizationId).order("version_number", { ascending: false }).limit(100),
    client.from("provider_badge_evaluations").select("id,service_id,badge_policy_id,evaluation_version,eligible,evaluated_basis_points").eq("provider_organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(100),
    client.from("provider_badge_policy_versions").select("id,badge_code,label_fr,label_ar").limit(100),
    client.from("provider_badge_decisions").select("evaluation_id,decision_version,action,rationale,decided_at").eq("provider_organization_id", organizationId).order("decision_version", { ascending: false }).limit(200),
  ]);
  if ([feedbackResult, snapshotsResult, evaluationsResult, policiesResult, decisionsResult].some((result) => result.error)) return { status: "error", reason: "QUERY_FAILED" };
  const feedbackRows = z.array(feedback).safeParse(feedbackResult.data), snapshots = z.array(snapshot).safeParse(snapshotsResult.data), evaluations = z.array(evaluation).safeParse(evaluationsResult.data), policies = z.array(badgePolicy).safeParse(policiesResult.data), decisions = z.array(decision).safeParse(decisionsResult.data);
  if (!feedbackRows.success || !snapshots.success || !evaluations.success || !policies.success || !decisions.success) return { status: "error", reason: "INVALID_RESPONSE" };
  const labels = await serviceLabels(client, snapshots.data.flatMap((item) => item.service_id ? [item.service_id] : []));
  if (labels.status === "error") return { status: "error", reason: "QUERY_FAILED" };
  const policyById = new Map(policies.data.map((item) => [item.id, item]));
  const latestDecision = new Map<string, z.infer<typeof decision>>();
  for (const item of decisions.data) if (!latestDecision.has(item.evaluation_id)) latestDecision.set(item.evaluation_id, item);
  return { status: "success", dashboard: {
    organizationName: member.organizations.display_name,
    feedback: feedbackRows.data.map((item) => ({ rankingPosition: item.ranking_position, rankedQuoteCount: item.ranked_quote_count, axes: item.improvement_axes.map((axis): FeedbackAxis => ({ dimension: axis.dimension, messageFr: axis.message_fr, messageAr: axis.message_ar })), methodologyVersion: item.methodology_version, publishedAt: item.published_at })),
    snapshots: snapshots.data.map((item) => { const label = item.service_id ? labels.labels.get(item.service_id) : null; return { id: item.id, serviceId: item.service_id, serviceLabelFr: label?.fr ?? null, serviceLabelAr: label?.ar ?? null, version: item.version_number, policyVersion: item.policy_version, scores: { quality: item.quality_basis_points, delivery: item.delivery_basis_points, compliance: item.compliance_basis_points, responsiveness: item.responsiveness_basis_points, satisfaction: item.satisfaction_basis_points, finance: item.finance_basis_points, overall: item.overall_basis_points }, evidenceCount: item.evidence_count, calculatedAt: item.calculated_at }; }),
    badges: evaluations.data.flatMap((item) => { const policy = policyById.get(item.badge_policy_id); if (!policy) return []; const latest = latestDecision.get(item.id); return [{ evaluationId: item.id, code: policy.badge_code, labelFr: policy.label_fr, labelAr: policy.label_ar, serviceId: item.service_id, eligible: item.eligible, evaluatedBasisPoints: item.evaluated_basis_points, evaluationVersion: item.evaluation_version, decision: latest?.action ?? null, decisionVersion: latest?.decision_version ?? null, rationale: latest?.rationale ?? null, decidedAt: latest?.decided_at ?? null }]; }),
  } };
}

export async function loadClientFavorites(requestedOrganizationId?: string): Promise<{ status: "success"; dashboard: ClientFavoritesDashboard } | Failure> {
  const auth = await activeMembership(["CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_BUYER", "CLIENT_VIEWER"], requestedOrganizationId, true);
  if (auth.failure) return auth.failure;
  const { client, membership: member } = auth;
  const organizationId = member.organization_id;
  const canManage = member.organization_member_roles.some((role) => role.revoked_at === null && ["CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_BUYER"].includes(role.role_code));
  const [favoritesResult, checksResult, requestsResult] = await Promise.all([
    client.from("client_provider_favorites").select("id,provider_organization_id,service_id,status,note,row_version,created_at").eq("client_organization_id", organizationId).order("created_at", { ascending: false }).limit(100),
    client.from("favorite_eligibility_revalidations").select("favorite_id,request_id,eligible,exclusion_reasons,checked_at").eq("client_organization_id", organizationId).order("checked_at", { ascending: false }).limit(300),
    client.from("service_requests").select("id,service_id,status").eq("client_organization_id", organizationId).not("status", "in", "(CANCELLED,EXPIRED)").order("created_at", { ascending: false }).limit(100),
  ]);
  if (favoritesResult.error || checksResult.error || requestsResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const favorites = z.array(favorite).safeParse(favoritesResult.data), checks = z.array(revalidation).safeParse(checksResult.data), requests = z.array(request).safeParse(requestsResult.data);
  if (!favorites.success || !checks.success || !requests.success) return { status: "error", reason: "INVALID_RESPONSE" };
  const labels = await serviceLabels(client, [...favorites.data.flatMap((item) => item.service_id ? [item.service_id] : []), ...requests.data.map((item) => item.service_id)]);
  if (labels.status === "error") return { status: "error", reason: "QUERY_FAILED" };
  const latestCheck = new Map<string, z.infer<typeof revalidation>>();
  for (const item of checks.data) if (!latestCheck.has(item.favorite_id)) latestCheck.set(item.favorite_id, item);
  return { status: "success", dashboard: { organizationId, organizationName: member.organizations.display_name, canManage, favorites: favorites.data.map((item) => { const label = item.service_id ? labels.labels.get(item.service_id) : null; const check = latestCheck.get(item.id); return { id: item.id, providerOrganizationId: item.provider_organization_id, serviceId: item.service_id, serviceLabelFr: label?.fr ?? null, serviceLabelAr: label?.ar ?? null, status: item.status, note: item.note, rowVersion: item.row_version, createdAt: item.created_at, latestRevalidation: check ? { requestId: check.request_id, eligible: check.eligible, reasons: check.exclusion_reasons, checkedAt: check.checked_at } : null }; }), requests: requests.data.map((item) => ({ id: item.id, serviceId: item.service_id, reference: item.id, status: item.status })) } };
}

export type FavoriteProviderOption = { organizationId: string; name: string; services: Array<{ id: string; nameFr: string; nameAr: string }> };
export async function loadFavoriteProviderOptions(requestedOrganizationId?: string): Promise<{ status: "success"; options: FavoriteProviderOption[] } | Failure> {
  const auth = await activeMembership(["CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_BUYER"], requestedOrganizationId, true);
  if (auth.failure) return auth.failure;
  const { client, membership: member } = auth;
  const requestsResult = await client.from("service_requests").select("id,service_id").eq("client_organization_id", member.organization_id).not("status", "in", "(CANCELLED,EXPIRED)").limit(100);
  const requests = z.array(z.object({ id, service_id: id })).safeParse(requestsResult.data);
  if (requestsResult.error || !requests.success) return { status: "error", reason: "QUERY_FAILED" };
  const rfqsResult = requests.data.length ? await client.from("rfqs").select("id,request_id").in("request_id", requests.data.map((item) => item.id)).limit(100) : { data: [], error: null };
  const rfqs = z.array(z.object({ id, request_id: id })).safeParse(rfqsResult.data);
  if (rfqsResult.error || !rfqs.success) return { status: "error", reason: "QUERY_FAILED" };
  const quotesResult = rfqs.data.length ? await client.from("quotes").select("provider_organization_id,rfq_id,status").in("rfq_id", rfqs.data.map((item) => item.id)).in("status", ["SUBMITTED", "SELECTED"]).limit(200) : { data: [], error: null };
  const quotes = z.array(z.object({ provider_organization_id: id, rfq_id: id, status: z.string() })).safeParse(quotesResult.data);
  if (quotesResult.error || !quotes.success) return { status: "error", reason: "QUERY_FAILED" };
  const providerIds = [...new Set(quotes.data.map((item) => item.provider_organization_id))];
  const organizationsResult = providerIds.length ? await client.from("organizations").select("id,display_name").in("id", providerIds).limit(100) : { data: [], error: null };
  const organizations = z.array(z.object({ id, display_name: z.string().min(1) })).safeParse(organizationsResult.data);
  if (organizationsResult.error || !organizations.success) return { status: "error", reason: "QUERY_FAILED" };
  const requestById = new Map(requests.data.map((item) => [item.id, item])), rfqById = new Map(rfqs.data.map((item) => [item.id, item]));
  const servicesForProvider = (providerId: string) => [...new Set(quotes.data.filter((quote) => quote.provider_organization_id === providerId).flatMap((quote) => { const requestId = rfqById.get(quote.rfq_id)?.request_id; const serviceId = requestId ? requestById.get(requestId)?.service_id : null; return serviceId ? [serviceId] : []; }))];
  const allServiceIds = [...new Set(providerIds.flatMap(servicesForProvider))], labels = await serviceLabels(client, allServiceIds);
  if (labels.status === "error") return { status: "error", reason: "QUERY_FAILED" };
  return { status: "success", options: organizations.data.map((organization) => ({ organizationId: organization.id, name: organization.display_name, services: servicesForProvider(organization.id).map((serviceId) => ({ id: serviceId, nameFr: labels.labels.get(serviceId)?.fr ?? serviceId, nameAr: labels.labels.get(serviceId)?.ar ?? serviceId })) })) };
}

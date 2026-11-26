import { z } from "zod";
import type {
  AnalysisOutcome,
  AssistanceDashboard,
  AssistedIntelligenceRepository,
  AssistanceFailure,
  AssistanceResult,
  DecisionOutcome,
  SimilarityOutcome,
} from "./contracts";
import { analysisInputSchema, decisionInputSchema, similarityInputSchema, uuid } from "./model";

type Query = { data: unknown; error: { code?: string; message?: string } | null };

export type AssistanceSource = {
  userId(): Promise<string | null>;
  memberships(userId: string): Promise<Query>;
  roles(membershipIds: string[]): Promise<Query>;
  organizations(organizationIds: string[]): Promise<Query>;
  models(): Promise<Query>;
  requests(): Promise<Query>;
  suggestions(requestIds: string[]): Promise<Query>;
  decisions(suggestionIds: string[]): Promise<Query>;
  sessions(organizationIds: string[]): Promise<Query>;
  questionnaireQuestions(questionnaireVersionIds: string[]): Promise<Query>;
  questions(questionVersionIds: string[]): Promise<Query>;
  recommendations(organizationIds: string[]): Promise<Query>;
  services(serviceIds: string[]): Promise<Query>;
  serviceVersions(serviceVersionIds: string[]): Promise<Query>;
  anomalies(organizationIds: string[]): Promise<Query>;
  reassessments(organizationIds: string[]): Promise<Query>;
  rpc(name: string, input: Record<string, unknown>): Promise<Query>;
};

const membershipRow = z.object({ id: uuid, organization_id: uuid }).strict();
const roleRow = z.object({ membership_id: uuid, role_code: z.string(), revoked_at: z.string().nullable() }).strict();
const organizationRow = z.object({ id: uuid, display_name: z.string().min(1) }).strict();
const modelRow = z.object({ id: uuid, version: z.number().int().positive(), algorithm: z.literal("TOKEN_OVERLAP_V1") }).strict();
const requestRow = z.object({
  id: uuid,
  organization_id: uuid,
  context_type: z.enum(["CONTEXTUAL_ASSISTANT", "PROFILE_CHANGE", "NEED_TEXT", "QUESTIONNAIRE_QUALITY", "SIMILARITY_REVIEW"]),
  status: z.enum(["COMPLETED", "FAILED"]),
  created_at: z.string(),
  input_text_expires_at: z.string().nullable(),
  input_text_redacted_at: z.string().nullable(),
}).strict();
const suggestionRow = z.object({
  id: uuid,
  request_id: uuid,
  organization_id: uuid,
  suggestion_kind: z.string(),
  target_type: z.string(),
  target_id: uuid.nullable(),
  related_target_id: uuid.nullable(),
  score_basis_points: z.number().int().min(0).max(10000),
  explanation_code: z.string(),
  explanation: z.object({ model_version: z.number().int().positive(), human_review_required: z.literal(true), evidence: z.record(z.string(), z.unknown()) }).passthrough(),
  proposed_payload: z.record(z.string(), z.unknown()),
  status: z.enum(["PROPOSED", "ACCEPTED", "REJECTED"]),
  created_at: z.string(),
  decided_at: z.string().nullable(),
}).strict();
const decisionRow = z.object({ id: uuid, suggestion_id: uuid, decision: z.enum(["ACCEPTED", "REJECTED"]), rationale: z.string(), decided_at: z.string() }).strict();
const sessionRow = z.object({ organization_id: uuid, questionnaire_version_id: uuid }).strict();
const questionnaireQuestionRow = z.object({ questionnaire_version_id: uuid, question_version_id: uuid }).strict();
const questionRow = z.object({ id: uuid, label_fr: z.string().min(1), label_ar: z.string().min(1), data_key: z.string().min(1) }).strict();
const recommendationRow = z.object({ organization_id: uuid, service_id: uuid.nullable() }).strict();
const serviceRow = z.object({ id: uuid, current_published_version_id: uuid.nullable() }).strict();
const serviceVersionRow = z.object({ id: uuid, service_id: uuid, name_fr: z.string().min(1), name_ar: z.string().min(1), code: z.string().min(1) }).strict();
const anomalyRow = z.object({ id: uuid, organization_id: uuid, anomaly_code: z.string().min(1), title_fr: z.string().min(1), title_ar: z.string().min(1), status: z.string().min(1) }).strict();
const reassessmentRow = z.object({ id: uuid, organization_id: uuid, changed_keys: z.array(z.string()), status: z.enum(["PENDING", "COMPLETED", "DISMISSED"]), created_at: z.string().datetime({ offset: true }) }).strict();

const analysisOutput = z.object({
  outcome: z.literal("ASSISTANCE_PROPOSED"),
  request_id: uuid,
  suggestion_count: z.number().int().nonnegative(),
  model_version_id: uuid,
  human_confirmation_required: z.literal(true),
}).passthrough();
const discoveryOutput = z.object({
  outcome: z.literal("ASSISTANCE_SCOPE_DISCOVERED"),
  algorithm: z.literal("TOKEN_OVERLAP_V1"),
  service_candidates: z.array(z.object({ service_version_id: uuid, service_id: uuid, score_basis_points: z.number().int().min(0).max(10_000) }).strict()).max(20),
  question_candidates: z.array(z.object({ question_version_id: uuid, service_id: uuid, required_for_quote: z.boolean(), score_basis_points: z.number().int().min(0).max(10_000) }).strict()).max(50),
  human_confirmation_required: z.literal(true),
}).strict();
const similarityOutput = z.object({
  outcome: z.literal("ANOMALY_SIMILARITY_PROPOSED"),
  request_id: uuid,
  suggestion_count: z.number().int().nonnegative(),
  human_confirmation_required: z.literal(true),
}).passthrough();
const decisionOutput = z.object({
  outcome: z.enum(["ASSISTANCE_SUGGESTION_ACCEPTED", "ASSISTANCE_SUGGESTION_REJECTED"]),
  suggestion_id: uuid,
  decision_id: uuid,
  business_action_executed: z.literal(false),
}).passthrough();

function failure<T>(reason: AssistanceFailure): AssistanceResult<T> {
  return { status: "error", reason };
}

function rows<T>(schema: z.ZodType<T>, query: Query): T[] | null {
  if (query.error) return null;
  const parsed = z.array(schema).safeParse(query.data);
  return parsed.success ? parsed.data : null;
}

function rpcFailure(error: Query["error"]): AssistanceFailure {
  if (error?.code === "42501") return "FORBIDDEN";
  if (error?.code === "22023") return "INVALID_INPUT";
  if (["23505", "40001", "PT409", "55000"].includes(error?.code ?? "")) return "CONFLICT";
  return "UNAVAILABLE";
}

async function command<T>(source: AssistanceSource, name: string, input: Record<string, unknown>, schema: z.ZodType<T>): Promise<AssistanceResult<T>> {
  if (!(await source.userId())) return failure("UNAUTHENTICATED");
  const response = await source.rpc(name, input);
  if (response.error) return failure(rpcFailure(response.error));
  const parsed = schema.safeParse(response.data);
  return parsed.success ? { status: "success", value: parsed.data } : failure("UNAVAILABLE");
}

export function createAssistedIntelligenceRepository(source: AssistanceSource): AssistedIntelligenceRepository {
  return {
    async dashboard() {
      const userId = await source.userId();
      if (!userId) return failure("UNAUTHENTICATED");
      const memberships = rows(membershipRow, await source.memberships(userId));
      if (!memberships) return failure("UNAVAILABLE");
      if (!memberships.length) return failure("FORBIDDEN");
      const membershipIds = memberships.map((item) => item.id);
      const organizationIds = [...new Set(memberships.map((item) => item.organization_id))];
      const [roleQuery, organizationQuery, modelQuery, requestQuery] = await Promise.all([
        source.roles(membershipIds),
        source.organizations(organizationIds),
        source.models(),
        source.requests(),
      ]);
      const roles = rows(roleRow, roleQuery);
      const organizations = rows(organizationRow, organizationQuery);
      const models = rows(modelRow, modelQuery);
      const requests = rows(requestRow, requestQuery);
      if (!roles || !organizations || !models || !requests) return failure("UNAVAILABLE");
      const suggestionRows = rows(suggestionRow, await source.suggestions(requests.map((item) => item.id)));
      if (!suggestionRows) return failure("UNAVAILABLE");
      const decisionRows = rows(decisionRow, await source.decisions(suggestionRows.map((item) => item.id)));
      if (!decisionRows) return failure("UNAVAILABLE");
      const [sessionRows, recommendationRows, anomalyRows, reassessmentRows] = await Promise.all([
        source.sessions(organizationIds), source.recommendations(organizationIds), source.anomalies(organizationIds), source.reassessments(organizationIds),
      ]).then(([sessionQuery, recommendationQuery, anomalyQuery, reassessmentQuery]) => [rows(sessionRow, sessionQuery), rows(recommendationRow, recommendationQuery), rows(anomalyRow, anomalyQuery), rows(reassessmentRow, reassessmentQuery)] as const);
      if (!sessionRows || !recommendationRows || !anomalyRows || !reassessmentRows) return failure("UNAVAILABLE");
      const questionnaireVersionIds = [...new Set(sessionRows.map((item) => item.questionnaire_version_id))];
      const questionLinks = rows(questionnaireQuestionRow, await source.questionnaireQuestions(questionnaireVersionIds));
      if (!questionLinks) return failure("UNAVAILABLE");
      const questionRows = rows(questionRow, await source.questions([...new Set(questionLinks.map((item) => item.question_version_id))]));
      const serviceRows = rows(serviceRow, await source.services([...new Set(recommendationRows.flatMap((item) => item.service_id ? [item.service_id] : []))]));
      if (!questionRows || !serviceRows) return failure("UNAVAILABLE");
      const serviceVersionRows = rows(serviceVersionRow, await source.serviceVersions(serviceRows.flatMap((item) => item.current_published_version_id ? [item.current_published_version_id] : [])));
      if (!serviceVersionRows) return failure("UNAVAILABLE");
      const membershipByOrganization = new Map(memberships.map((item) => [item.organization_id, item.id]));
      const activeRoles = new Map<string, Set<string>>();
      for (const role of roles) {
        if (role.revoked_at) continue;
        const roleSet = activeRoles.get(role.membership_id) ?? new Set<string>();
        roleSet.add(role.role_code);
        activeRoles.set(role.membership_id, roleSet);
      }
      const dashboard: AssistanceDashboard = {
        organizations: organizations.flatMap((organization) => {
          const membershipId = membershipByOrganization.get(organization.id);
          const roleSet = membershipId ? activeRoles.get(membershipId) ?? new Set<string>() : new Set<string>();
          const canAnalyze = ["CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_BUYER"].some((role) => roleSet.has(role));
          const canDecide = ["CLIENT_OWNER", "CLIENT_ADMIN"].some((role) => roleSet.has(role));
          return canAnalyze ? [{ id: organization.id, name: organization.display_name, canAnalyze, canDecide }] : [];
        }),
        model: models[0] ? { id: models[0].id, version: models[0].version, algorithm: models[0].algorithm } : null,
        requests: requests.map((item) => ({
          id: item.id,
          organizationId: item.organization_id,
          context: item.context_type,
          status: item.status,
          createdAt: item.created_at,
          inputExpiresAt: item.input_text_expires_at,
          inputRedactedAt: item.input_text_redacted_at,
        })),
        suggestions: suggestionRows.map((item) => ({
          id: item.id,
          requestId: item.request_id,
          organizationId: item.organization_id,
          kind: item.suggestion_kind,
          targetType: item.target_type,
          targetId: item.target_id,
          relatedTargetId: item.related_target_id,
          scoreBasisPoints: item.score_basis_points,
          explanationCode: item.explanation_code,
          modelVersion: item.explanation.model_version,
          humanReviewRequired: item.explanation.human_review_required,
          evidence: item.explanation.evidence,
          proposedPayload: item.proposed_payload,
          status: item.status,
          createdAt: item.created_at,
          decidedAt: item.decided_at,
        })),
        decisions: decisionRows.map((item) => ({ id: item.id, suggestionId: item.suggestion_id, decision: item.decision, rationale: item.rationale, decidedAt: item.decided_at })),
        questionCandidates: questionRows.slice(0, 50).flatMap((item) => { const link = questionLinks.find((candidate) => candidate.question_version_id === item.id); const session = link ? sessionRows.find((candidate) => candidate.questionnaire_version_id === link.questionnaire_version_id) : null; return session ? [{ id: item.id, organizationId: session.organization_id, labelFr: item.label_fr, labelAr: item.label_ar, detail: item.data_key }] : []; }),
        serviceCandidates: serviceVersionRows.slice(0, 50).flatMap((item) => { const recommendation = recommendationRows.find((candidate) => candidate.service_id === item.service_id); return recommendation ? [{ id: item.id, organizationId: recommendation.organization_id, labelFr: item.name_fr, labelAr: item.name_ar, detail: item.code }] : []; }),
        anomalyCandidates: anomalyRows.slice(0, 50).map((item) => ({ id: item.id, organizationId: item.organization_id, labelFr: item.title_fr, labelAr: item.title_ar, detail: `${item.anomaly_code} · ${item.status}` })),
        reassessmentCandidates: reassessmentRows.filter((item) => item.status === "PENDING").slice(0, 50).map((item) => ({ id: item.id, organizationId: item.organization_id, labelFr: `Profil à réévaluer · ${item.changed_keys.join(", ")}`, labelAr: `ملف يحتاج لإعادة التقييم · ${item.changed_keys.join(", ")}`, detail: new Date(item.created_at).toISOString().slice(0, 10) })),
      };
      return dashboard.organizations.length ? { status: "success", value: dashboard } : failure("FORBIDDEN");
    },
    async analyze(input) {
      const parsed = analysisInputSchema.safeParse(input);
      if (!parsed.success) return failure("INVALID_INPUT");
      let serviceVersionIds = parsed.data.serviceVersionIds;
      let questionVersionIds = parsed.data.questionVersionIds;
      if (parsed.data.context === "NEED_TEXT" && parsed.data.inputText) {
        const discovery = await command(source, "discover_assistance_scope", {
          p_organization_id: parsed.data.organizationId,
          p_input_text: parsed.data.inputText,
          p_known_data_keys: parsed.data.knownDataKeys,
          p_limit: 20,
        }, discoveryOutput);
        if (discovery.status === "error") return discovery;
        serviceVersionIds = [...new Set([...serviceVersionIds, ...discovery.value.service_candidates.map((candidate) => candidate.service_version_id)])].slice(0, 50);
        questionVersionIds = [...new Set([...questionVersionIds, ...discovery.value.question_candidates.map((candidate) => candidate.question_version_id)])].slice(0, 50);
      }
      const result = await command(source, "run_assisted_analysis", {
        p_organization_id: parsed.data.organizationId,
        p_context_type: parsed.data.context,
        p_input_text: parsed.data.inputText,
        p_candidate_service_version_ids: serviceVersionIds,
        p_candidate_question_version_ids: questionVersionIds,
        p_known_data_keys: parsed.data.knownDataKeys,
        p_model_version_id: parsed.data.modelVersionId,
        p_profile_reassessment_id: parsed.data.profileReassessmentId,
        p_idempotency_key: parsed.data.idempotencyKey,
        p_correlation_id: parsed.data.correlationId,
      }, analysisOutput);
      if (result.status === "error") return result;
      const value: AnalysisOutcome = { outcome: result.value.outcome, requestId: result.value.request_id, suggestionCount: result.value.suggestion_count, modelVersionId: result.value.model_version_id, humanConfirmationRequired: result.value.human_confirmation_required };
      return { status: "success", value };
    },
    async compareAnomalies(input) {
      const parsed = similarityInputSchema.safeParse(input);
      if (!parsed.success) return failure("INVALID_INPUT");
      const result = await command(source, "run_assisted_anomaly_similarity", {
        p_organization_id: parsed.data.organizationId,
        p_candidate_anomaly_ids: parsed.data.anomalyIds,
        p_model_version_id: parsed.data.modelVersionId,
        p_idempotency_key: parsed.data.idempotencyKey,
        p_correlation_id: parsed.data.correlationId,
      }, similarityOutput);
      if (result.status === "error") return result;
      const value: SimilarityOutcome = { outcome: result.value.outcome, requestId: result.value.request_id, suggestionCount: result.value.suggestion_count, humanConfirmationRequired: result.value.human_confirmation_required };
      return { status: "success", value };
    },
    async decide(input) {
      const parsed = decisionInputSchema.safeParse(input);
      if (!parsed.success) return failure("INVALID_INPUT");
      const result = await command(source, "decide_assisted_suggestion", {
        p_suggestion_id: parsed.data.suggestionId,
        p_decision: parsed.data.decision,
        p_rationale: parsed.data.rationale,
        p_idempotency_key: parsed.data.idempotencyKey,
        p_correlation_id: parsed.data.correlationId,
      }, decisionOutput);
      if (result.status === "error") return result;
      const value: DecisionOutcome = { outcome: result.value.outcome, suggestionId: result.value.suggestion_id, decisionId: result.value.decision_id, businessActionExecuted: result.value.business_action_executed };
      return { status: "success", value };
    },
  };
}

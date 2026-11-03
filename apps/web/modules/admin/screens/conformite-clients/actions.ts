"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

const centralRoles = new Set(["SUPER_ADMIN", "MATRICIA_ADMIN", "COMPLIANCE_MANAGER"]);
const caseStatusSchema = z.enum([
  "PROFILE_IN_PROGRESS", "DOCUMENTS_REQUIRED", "UNDER_REVIEW", "QUESTION_REQUIRED",
  "RESPONSE_RECEIVED", "VERIFIED", "REJECTED", "SUSPENDED",
]);
const decisionValueSchema = z.enum(["VERIFIED", "QUESTION_REQUIRED", "REJECTED"]);
const evidenceTypeSchema = z.enum(["REGISTRATION_DOCUMENT", "REPRESENTATIVE_AUTHORITY", "TAX_DOCUMENT"]);
const evidenceStatusSchema = z.enum(["PENDING", "VERIFIED", "REJECTED"]);
const anomalySeveritySchema = z.enum(["INFO", "WARNING", "CRITICAL"]);
const anomalyStatusSchema = z.enum(["OPEN", "QUESTIONED", "RESOLVED", "ACCEPTED_EXCEPTION"]);
const questionStatusSchema = z.enum(["OPEN", "ANSWERED", "ACCEPTED", "CLOSED"]);
const uuidSchema = z.string().uuid();
const requirementSchema = z.object({
  requirement_satisfied: z.boolean(),
  matched_role_codes: z.array(z.string()),
}).passthrough();
const caseRowSchema = z.object({
  id: uuidSchema,
  organization_id: uuidSchema,
  status: caseStatusSchema,
  current_profile_version: z.number().int().positive().nullable(),
  submitted_at: z.string().nullable(),
  decision_reason_public: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
const profileRowSchema = z.object({
  compliance_case_id: uuidSchema,
  version: z.number().int().positive(),
  display_name: z.string().nullable(),
  legal_name: z.string().nullable(),
});
const evidenceRowSchema = z.object({
  compliance_case_id: uuidSchema,
  evidence_type: evidenceTypeSchema,
  review_status: evidenceStatusSchema,
});
const anomalyRowSchema = z.object({
  id: uuidSchema,
  compliance_case_id: uuidSchema,
  anomaly_code: z.string().min(3).max(80),
  severity: anomalySeveritySchema,
  blocking: z.boolean(),
  status: anomalyStatusSchema,
  client_message_fr: z.string().min(3).max(500),
  client_message_ar: z.string().min(3).max(500),
});
const questionRowSchema = z.object({
  id: uuidSchema,
  compliance_case_id: uuidSchema,
  anomaly_id: uuidSchema.nullable(),
  question_text_fr: z.string().min(3).max(1000),
  question_text_ar: z.string().min(3).max(1000),
  expected_document_type: z.string().max(80).nullable(),
  due_at: z.string(),
  status: questionStatusSchema,
});
const responseRowSchema = z.object({
  question_id: uuidSchema,
  version: z.number().int().positive(),
  response_text: z.string().min(3).max(4000),
  submitted_at: z.string(),
});
const decisionSchema = z.object({
  complianceCaseId: uuidSchema,
  decision: decisionValueSchema,
  reasonPublic: z.string().trim().max(1000),
  idempotencyKey: z.string().uuid(),
  locale: z.string().refine(isLocale),
  confirmed: z.literal("yes"),
}).superRefine((value, context) => {
  if ((value.decision === "QUESTION_REQUIRED" || value.decision === "REJECTED")
    && value.reasonPublic.length < 3) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["reasonPublic"] });
  }
  if (value.reasonPublic.length > 0 && value.reasonPublic.length < 3) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["reasonPublic"] });
  }
});
const workflowBaseSchema = z.object({
  idempotencyKey: z.string().uuid(),
  locale: z.string().refine(isLocale),
  confirmed: z.literal("yes"),
});
const evaluateSchema = workflowBaseSchema.extend({ complianceCaseId: uuidSchema });
const createQuestionSchema = workflowBaseSchema.extend({
  anomalyId: uuidSchema,
  questionFr: z.string().trim().min(3).max(1000),
  questionAr: z.string().trim().min(3).max(1000),
  expectedDocumentType: z.enum(["NONE", "REGISTRATION_DOCUMENT", "REPRESENTATIVE_AUTHORITY", "TAX_DOCUMENT"]),
  dueDays: z.coerce.number().int().refine((value) => [1, 3, 5, 7, 14, 30].includes(value)),
  requestAnchor: z.string().datetime({ offset: true }),
}).superRefine((value, context) => {
  const anchor = new Date(value.requestAnchor).getTime();
  const now = Date.now();
  if (anchor > now + 300_000 || anchor < now - 604_800_000) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["requestAnchor"] });
  }
});
const reviewResponseSchema = workflowBaseSchema.extend({
  questionId: uuidSchema,
  accepted: z.enum(["yes", "no"]),
});
const decisionOutcomeSchema = z.object({
  outcome: z.enum([
    "CLIENT_COMPLIANCE_VERIFIED",
    "CLIENT_COMPLIANCE_QUESTION_REQUIRED",
    "CLIENT_COMPLIANCE_REJECTED",
  ]),
  compliance_case_id: uuidSchema,
  organization_id: uuidSchema,
  status: decisionValueSchema,
  trial_id: uuidSchema.nullable(),
}).strict();

export type ComplianceCaseStatus = z.infer<typeof caseStatusSchema>;
export type ComplianceDecision = z.infer<typeof decisionValueSchema>;
export type ComplianceEvidenceType = z.infer<typeof evidenceTypeSchema>;
export type AdministrativeAnomaly = {
  id: string;
  code: string;
  severity: z.infer<typeof anomalySeveritySchema>;
  blocking: boolean;
  status: z.infer<typeof anomalyStatusSchema>;
  messageFr: string;
  messageAr: string;
};
export type ComplianceQuestion = {
  id: string;
  anomalyId: string | null;
  textFr: string;
  textAr: string;
  expectedDocumentType: string | null;
  dueAt: string;
  status: z.infer<typeof questionStatusSchema>;
  latestResponse: { version: number; text: string; submittedAt: string } | null;
};
export type SafeComplianceCase = {
  id: string;
  organizationName: string | null;
  status: ComplianceCaseStatus;
  profileVersion: number | null;
  submittedAt: string | null;
  publicReason: string | null;
  createdAt: string;
  updatedAt: string;
  evidence: Array<{ type: ComplianceEvidenceType; status: "PENDING" | "VERIFIED" | "REJECTED" }>;
  anomalies: AdministrativeAnomaly[];
  questions: ComplianceQuestion[];
};
export type ComplianceReviewResult =
  | { status: "success"; cases: SafeComplianceCase[]; page: number; hasNext: boolean; counts: Record<"all"|"check"|"complement"|"review"|"decided", number> }
  | { status: "error"; reason: "UNAUTHENTICATED" | "MFA_REQUIRED" | "FORBIDDEN" | "UNAVAILABLE" };
export type ComplianceDecisionState =
  | { status: "idle" }
  | { status: "success"; decision: ComplianceDecision }
  | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "MFA_REQUIRED" | "FORBIDDEN" | "UNAVAILABLE" };
export type ComplianceWorkflowOutcome = "EVALUATED" | "QUESTION_CREATED" | "RESPONSE_ACCEPTED" | "RESPONSE_REJECTED";
export type ComplianceWorkflowState =
  | { status: "idle" }
  | { status: "success"; outcome: ComplianceWorkflowOutcome }
  | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "MFA_REQUIRED" | "FORBIDDEN" | "UNAVAILABLE" };

async function centralContext() {
  const supabase = await getSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { status: "error" as const, reason: "UNAUTHENTICATED" as const };
  const requirementResult = await supabase.rpc("get_my_account_security_requirement");
  const requirements = z.array(requirementSchema).safeParse(requirementResult.data);
  if (requirementResult.error || !requirements.success || requirements.data.length !== 1) {
    return { status: "error" as const, reason: "UNAVAILABLE" as const };
  }
  const requirement = requirements.data[0]!;
  if (!requirement.matched_role_codes.some((role) => centralRoles.has(role))) {
    return { status: "error" as const, reason: "FORBIDDEN" as const };
  }
  if (!requirement.requirement_satisfied) {
    return { status: "error" as const, reason: "MFA_REQUIRED" as const };
  }
  return { status: "success" as const, supabase };
}

function safeOrganizationName(displayName: string | null, legalName: string | null): string | null {
  const value = displayName?.trim() || legalName?.trim() || null;
  return value?.slice(0, 200) ?? null;
}

export async function listClientComplianceReviews(options: {page?: number; filter?: string; caseId?: string} = {}): Promise<ComplianceReviewResult> {
  const context = await centralContext();
  if (context.status === "error") return context;
  const input = z.object({page: z.number().int().min(1).max(100000), filter: z.enum(["all","check","complement","review","decided"]), caseId: z.string().uuid().optional()}).safeParse({page: options.page ?? 1, filter: options.filter ?? "all", caseId: options.caseId});
  if (!input.success) return {status: "error", reason: "UNAVAILABLE"};
  const result = await context.supabase.rpc("get_admin_client_compliance_page_v1", {p_page: input.data.page, p_filter: input.data.filter, p_case_id: input.data.caseId ?? null});
  const page = z.object({cases: z.array(caseRowSchema), page: z.number().int(), has_next: z.boolean(), counts: z.object({all:z.number().int(),check:z.number().int(),complement:z.number().int(),review:z.number().int(),decided:z.number().int()})}).safeParse(result.data);
  if (result.error || !page.success) return {status: "error", reason: "UNAVAILABLE"};
  const cases = {data: page.data.cases};
  const pagination = {page: page.data.page, hasNext: page.data.has_next, counts: page.data.counts};
  const caseIds = cases.data.map((item) => item.id);
  if (caseIds.length === 0) return { status: "success", cases: [], ...pagination };

  const [profilesResult, evidenceResult, anomaliesResult, questionsResult] = await Promise.all([
    context.supabase
      .from("client_profile_versions")
      .select("compliance_case_id,version,display_name:organization_snapshot->>display_name,legal_name:organization_snapshot->>legal_name")
      .in("compliance_case_id", caseIds),
    context.supabase
      .from("client_compliance_evidence")
      .select("compliance_case_id,evidence_type,review_status")
      .in("compliance_case_id", caseIds),
    context.supabase
      .from("client_administrative_anomalies")
      .select("id,compliance_case_id,anomaly_code,severity,blocking,status,client_message_fr,client_message_ar")
      .in("compliance_case_id", caseIds),
    context.supabase
      .from("client_compliance_questions")
      .select("id,compliance_case_id,anomaly_id,question_text_fr,question_text_ar,expected_document_type,due_at,status")
      .in("compliance_case_id", caseIds),
  ]);
  if (profilesResult.error || evidenceResult.error || anomaliesResult.error || questionsResult.error) {
    return { status: "error", reason: "UNAVAILABLE" };
  }
  const profiles = z.array(profileRowSchema).safeParse(profilesResult.data);
  const evidence = z.array(evidenceRowSchema).safeParse(evidenceResult.data);
  const anomalies = z.array(anomalyRowSchema).safeParse(anomaliesResult.data);
  const questions = z.array(questionRowSchema).safeParse(questionsResult.data);
  if (!profiles.success || !evidence.success || !anomalies.success || !questions.success) {
    return { status: "error", reason: "UNAVAILABLE" };
  }
  const questionIds = questions.data.map((question) => question.id);
  const responsesResult = questionIds.length === 0
    ? { data: [], error: null }
    : await context.supabase
      .from("client_compliance_response_versions")
      .select("question_id,version,response_text,submitted_at")
      .in("question_id", questionIds);
  if (responsesResult.error) return { status: "error", reason: "UNAVAILABLE" };
  const responses = z.array(responseRowSchema).safeParse(responsesResult.data);
  if (!responses.success) return { status: "error", reason: "UNAVAILABLE" };

  return {
    status: "success",
    ...pagination,
    cases: cases.data.map((item) => {
      const currentProfile = profiles.data.find((profile) =>
        profile.compliance_case_id === item.id && profile.version === item.current_profile_version);
      return {
        id: item.id,
        organizationName: currentProfile ? safeOrganizationName(currentProfile.display_name, currentProfile.legal_name) : null,
        status: item.status,
        profileVersion: item.current_profile_version,
        submittedAt: item.submitted_at,
        publicReason: item.decision_reason_public?.slice(0, 1000) ?? null,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        evidence: evidence.data
          .filter((record) => record.compliance_case_id === item.id)
          .map((record) => ({ type: record.evidence_type, status: record.review_status })),
        anomalies: anomalies.data
          .filter((record) => record.compliance_case_id === item.id)
          .map((record) => ({
            id: record.id,
            code: record.anomaly_code,
            severity: record.severity,
            blocking: record.blocking,
            status: record.status,
            messageFr: record.client_message_fr,
            messageAr: record.client_message_ar,
          })),
        questions: questions.data
          .filter((record) => record.compliance_case_id === item.id)
          .map((record) => {
            const latest = responses.data
              .filter((response) => response.question_id === record.id)
              .sort((left, right) => right.version - left.version)[0];
            return {
              id: record.id,
              anomalyId: record.anomaly_id,
              textFr: record.question_text_fr,
              textAr: record.question_text_ar,
              expectedDocumentType: record.expected_document_type,
              dueAt: record.due_at,
              status: record.status,
              latestResponse: latest
                ? { version: latest.version, text: latest.response_text.trim().slice(0, 4000), submittedAt: latest.submitted_at }
                : null,
            };
          }),
      };
    }),
  };
}

function workflowInput(formData: FormData) {
  return {
    idempotencyKey: formData.get("idempotencyKey"),
    locale: formData.get("locale"),
    confirmed: formData.get("confirmed"),
  };
}

function refresh(locale: string) {
  revalidatePath("/" + locale + "/administration/conformite-clients");
}

export async function evaluateClientCompliance(
  _previousState: ComplianceWorkflowState,
  formData: FormData,
): Promise<ComplianceWorkflowState> {
  const parsed = evaluateSchema.safeParse({
    ...workflowInput(formData),
    complianceCaseId: formData.get("complianceCaseId"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const context = await centralContext();
  if (context.status === "error") return context;
  const result = await context.supabase.rpc("evaluate_client_compliance", {
    p_compliance_case_id: parsed.data.complianceCaseId,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: randomUUID(),
  });
  const response = z.object({ outcome: z.literal("CLIENT_COMPLIANCE_EVALUATED") }).passthrough().safeParse(result.data);
  if (result.error || !response.success) return { status: "error", reason: "UNAVAILABLE" };
  refresh(parsed.data.locale);
  return { status: "success", outcome: "EVALUATED" };
}

export async function createClientComplianceQuestion(
  _previousState: ComplianceWorkflowState,
  formData: FormData,
): Promise<ComplianceWorkflowState> {
  const parsed = createQuestionSchema.safeParse({
    ...workflowInput(formData),
    anomalyId: formData.get("anomalyId"),
    questionFr: formData.get("questionFr"),
    questionAr: formData.get("questionAr"),
    expectedDocumentType: formData.get("expectedDocumentType"),
    dueDays: formData.get("dueDays"),
    requestAnchor: formData.get("requestAnchor"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const context = await centralContext();
  if (context.status === "error") return context;
  const dueAt = new Date(new Date(parsed.data.requestAnchor).getTime() + parsed.data.dueDays * 86_400_000).toISOString();
  const result = await context.supabase.rpc("create_client_compliance_question", {
    p_anomaly_id: parsed.data.anomalyId,
    p_question_text_fr: parsed.data.questionFr,
    p_question_text_ar: parsed.data.questionAr,
    p_expected_document_type: parsed.data.expectedDocumentType === "NONE" ? null : parsed.data.expectedDocumentType,
    p_due_at: dueAt,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: randomUUID(),
  });
  if (result.error || !uuidSchema.safeParse(result.data).success) return { status: "error", reason: "UNAVAILABLE" };
  refresh(parsed.data.locale);
  return { status: "success", outcome: "QUESTION_CREATED" };
}

export async function reviewClientComplianceResponse(
  _previousState: ComplianceWorkflowState,
  formData: FormData,
): Promise<ComplianceWorkflowState> {
  const parsed = reviewResponseSchema.safeParse({
    ...workflowInput(formData),
    questionId: formData.get("questionId"),
    accepted: formData.get("accepted"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const context = await centralContext();
  if (context.status === "error") return context;
  const accepted = parsed.data.accepted === "yes";
  const result = await context.supabase.rpc("accept_client_compliance_response", {
    p_question_id: parsed.data.questionId,
    p_accepted: accepted,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: randomUUID(),
  });
  if (result.error || result.data !== accepted) return { status: "error", reason: "UNAVAILABLE" };
  refresh(parsed.data.locale);
  return { status: "success", outcome: accepted ? "RESPONSE_ACCEPTED" : "RESPONSE_REJECTED" };
}

export async function decideClientCompliance(
  _previousState: ComplianceDecisionState,
  formData: FormData,
): Promise<ComplianceDecisionState> {
  const parsed = decisionSchema.safeParse({
    complianceCaseId: formData.get("complianceCaseId"),
    decision: formData.get("decision"),
    reasonPublic: formData.get("reasonPublic"),
    idempotencyKey: formData.get("idempotencyKey"),
    locale: formData.get("locale"),
    confirmed: formData.get("confirmed"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const context = await centralContext();
  if (context.status === "error") return context;
  const { data, error } = await context.supabase.rpc("decide_client_compliance", {
    p_compliance_case_id: parsed.data.complianceCaseId,
    p_decision: parsed.data.decision,
    p_reason_public: parsed.data.reasonPublic || null,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: randomUUID(),
  });
  const outcome = decisionOutcomeSchema.safeParse(data);
  const expectedOutcome = "CLIENT_COMPLIANCE_" + parsed.data.decision;
  if (error || !outcome.success
    || outcome.data.outcome !== expectedOutcome
    || outcome.data.status !== parsed.data.decision
    || outcome.data.compliance_case_id !== parsed.data.complianceCaseId
    || (parsed.data.decision === "VERIFIED") !== (outcome.data.trial_id !== null)) {
    return { status: "error", reason: "UNAVAILABLE" };
  }
  revalidatePath("/" + parsed.data.locale + "/administration/conformite-clients");
  return { status: "success", decision: parsed.data.decision };
}

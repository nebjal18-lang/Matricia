"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { humanQualificationScoreBps } from "@/modules/shared/lib/provider-qualification-review/model";
import { exactUnits } from "@/modules/shared/lib/volume-procurement/model";
import { uuidSchema } from "@/modules/shared/lib/catalogue-builder/model";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

export type FranchiseCommandState =
  | { status: "idle" }
  | { status: "success"; outcome: string }
  | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "MFA_REQUIRED" | "FORBIDDEN" | "CONFLICT" | "FAILED" };

const keySchema = z.string().trim().regex(/^[A-Z][A-Z0-9_.-]{1,119}$/u);
const bilingual = z.string().trim().min(2).max(240);
const longText = z.string().trim().min(3).max(4000);
const reasonSchema = z.string().trim().min(3).max(500);
const franchiseRoles = z.enum(["FRANCHISE_MANAGER", "FRANCHISE_EXPERT", "FRANCHISE_PROVIDER_MANAGER", "FRANCHISE_ACCOUNTING", "FRANCHISE_VIEWER"]);

function text(form: FormData, key: string) {
  return String(form.get(key) ?? "");
}

function revalidate(locale: string, organizationId: string) {
  const query = organizationId ? `?organizationId=${organizationId}` : "";
  revalidatePath(`/${locale}/franchise/qualite`);
  revalidatePath(`/${locale}/franchise/qualite/definitions`);
  revalidatePath(`/${locale}/franchise/qualite/risques`);
  revalidatePath(`/${locale}/franchise/qualite/recommandations`);
  revalidatePath(`/${locale}/franchise/qualite/incidents`);
  revalidatePath(`/${locale}/franchise/fournisseurs`);
  revalidatePath(`/${locale}/franchise/perimetre/utilisateurs`);
  revalidatePath(`/${locale}/franchise/finance/volume`);
  return query;
}

async function rpc(name: string, args: Record<string, unknown>): Promise<FranchiseCommandState> {
  const client = await getSupabaseServerClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  const authFailure = classifyAuthReadFailure(authError);
  if (authFailure) return { status: "error", reason: authFailure === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "FAILED" };
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const result = await client.rpc(name, args);
  if (result.error) {
    if (result.error.code === "42501" && /(?:^|_)(?:MFA|AAL2)(?:_|$)/i.test(result.error.message ?? "")) return { status: "error", reason: "MFA_REQUIRED" };
    if (result.error.code === "42501") return { status: "error", reason: "FORBIDDEN" };
    if (["40001", "23505", "23514", "23P01"].includes(result.error.code ?? "") || /STALE|IDEMPOTENCY|TRANSITION|INVALID_/i.test(result.error.message ?? "")) {
      return { status: "error", reason: "CONFLICT" };
    }
    return { status: "error", reason: "FAILED" };
  }
  const parsed = z.object({ outcome: z.string().min(3) }).passthrough().safeParse(result.data);
  return parsed.success ? { status: "success", outcome: parsed.data.outcome } : { status: "error", reason: "FAILED" };
}

export async function upsertFranchiseAnomalyDefinition(_: FranchiseCommandState, form: FormData): Promise<FranchiseCommandState> {
  const parsed = z.object({
    locale: z.string().refine(isLocale),
    organizationId: z.string().optional(),
    libraryId: uuidSchema,
    definitionKey: keySchema,
    severity: z.enum(["INFO", "MINOR", "IMPORTANT", "CRITICAL"]),
    titleFr: bilingual,
    titleAr: bilingual,
    descriptionFr: longText,
    descriptionAr: longText,
    blocking: z.enum(["yes", "no"]),
    evidenceRequired: z.enum(["yes", "no"]),
    detectedByRuleKey: z.string().trim().regex(/^[A-Z][A-Z0-9_.-]{1,119}$/u).or(z.literal("")),
    changeReason: reasonSchema,
    confirmed: z.literal("yes"),
    idempotencyKey: uuidSchema,
    correlationId: uuidSchema,
  }).safeParse({
    locale: text(form, "locale"),
    organizationId: text(form, "organizationId") || undefined,
    libraryId: text(form, "libraryId"),
    definitionKey: text(form, "definitionKey"),
    severity: text(form, "severity"),
    titleFr: text(form, "titleFr"),
    titleAr: text(form, "titleAr"),
    descriptionFr: text(form, "descriptionFr"),
    descriptionAr: text(form, "descriptionAr"),
    blocking: text(form, "blocking"),
    evidenceRequired: text(form, "evidenceRequired"),
    detectedByRuleKey: text(form, "detectedByRuleKey"),
    changeReason: text(form, "changeReason"),
    confirmed: text(form, "confirmed"),
    idempotencyKey: text(form, "idempotencyKey"),
    correlationId: text(form, "correlationId"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const result = await rpc("upsert_franchise_anomaly_definition", {
    p_library_id: parsed.data.libraryId,
    p_definition_key: parsed.data.definitionKey,
    p_severity: parsed.data.severity,
    p_title_fr: parsed.data.titleFr,
    p_title_ar: parsed.data.titleAr,
    p_description_fr: parsed.data.descriptionFr,
    p_description_ar: parsed.data.descriptionAr,
    p_blocking: parsed.data.blocking === "yes",
    p_evidence_required: parsed.data.evidenceRequired === "yes",
    p_detected_by_rule_key: parsed.data.detectedByRuleKey || null,
    p_change_reason: parsed.data.changeReason,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: parsed.data.correlationId,
  });
  if (result.status === "success") revalidate(parsed.data.locale, parsed.data.organizationId ?? "");
  return result;
}

export async function upsertFranchiseRiskDefinition(_: FranchiseCommandState, form: FormData): Promise<FranchiseCommandState> {
  const parsed = z.object({
    locale: z.string().refine(isLocale),
    organizationId: z.string().optional(),
    libraryId: uuidSchema,
    definitionKey: keySchema,
    impact: z.enum(["LOW", "MEDIUM", "HIGH"]),
    probability: z.enum(["LOW", "MEDIUM", "HIGH"]),
    titleFr: bilingual,
    titleAr: bilingual,
    descriptionFr: longText,
    descriptionAr: longText,
    changeReason: reasonSchema,
    confirmed: z.literal("yes"),
    idempotencyKey: uuidSchema,
    correlationId: uuidSchema,
  }).safeParse({
    locale: text(form, "locale"),
    organizationId: text(form, "organizationId") || undefined,
    libraryId: text(form, "libraryId"),
    definitionKey: text(form, "definitionKey"),
    impact: text(form, "impact"),
    probability: text(form, "probability"),
    titleFr: text(form, "titleFr"),
    titleAr: text(form, "titleAr"),
    descriptionFr: text(form, "descriptionFr"),
    descriptionAr: text(form, "descriptionAr"),
    changeReason: text(form, "changeReason"),
    confirmed: text(form, "confirmed"),
    idempotencyKey: text(form, "idempotencyKey"),
    correlationId: text(form, "correlationId"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const result = await rpc("upsert_franchise_risk_definition", {
    p_library_id: parsed.data.libraryId,
    p_definition_key: parsed.data.definitionKey,
    p_impact: parsed.data.impact,
    p_probability: parsed.data.probability,
    p_title_fr: parsed.data.titleFr,
    p_title_ar: parsed.data.titleAr,
    p_description_fr: parsed.data.descriptionFr,
    p_description_ar: parsed.data.descriptionAr,
    p_change_reason: parsed.data.changeReason,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: parsed.data.correlationId,
  });
  if (result.status === "success") revalidate(parsed.data.locale, parsed.data.organizationId ?? "");
  return result;
}

export async function upsertFranchiseRecommendationDefinition(_: FranchiseCommandState, form: FormData): Promise<FranchiseCommandState> {
  const parsed = z.object({
    locale: z.string().refine(isLocale),
    organizationId: z.string().optional(),
    libraryId: uuidSchema,
    definitionKey: keySchema,
    serviceId: uuidSchema,
    anomalyDefinitionId: uuidSchema.or(z.literal("")),
    solutionLevel: z.enum(["ESSENTIAL", "STANDARD", "ADVANCED"]),
    priority: z.coerce.number().int().min(1).max(100),
    titleFr: bilingual,
    titleAr: bilingual,
    clientTextFr: longText,
    clientTextAr: longText,
    technicalTextFr: longText,
    technicalTextAr: longText,
    changeReason: reasonSchema,
    confirmed: z.literal("yes"),
    idempotencyKey: uuidSchema,
    correlationId: uuidSchema,
  }).safeParse({
    locale: text(form, "locale"),
    organizationId: text(form, "organizationId") || undefined,
    libraryId: text(form, "libraryId"),
    definitionKey: text(form, "definitionKey"),
    serviceId: text(form, "serviceId"),
    anomalyDefinitionId: text(form, "anomalyDefinitionId"),
    solutionLevel: text(form, "solutionLevel"),
    priority: text(form, "priority"),
    titleFr: text(form, "titleFr"),
    titleAr: text(form, "titleAr"),
    clientTextFr: text(form, "clientTextFr"),
    clientTextAr: text(form, "clientTextAr"),
    technicalTextFr: text(form, "technicalTextFr"),
    technicalTextAr: text(form, "technicalTextAr"),
    changeReason: text(form, "changeReason"),
    confirmed: text(form, "confirmed"),
    idempotencyKey: text(form, "idempotencyKey"),
    correlationId: text(form, "correlationId"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const result = await rpc("upsert_franchise_recommendation_definition", {
    p_library_id: parsed.data.libraryId,
    p_definition_key: parsed.data.definitionKey,
    p_service_id: parsed.data.serviceId,
    p_anomaly_definition_id: parsed.data.anomalyDefinitionId || null,
    p_solution_level: parsed.data.solutionLevel,
    p_priority: parsed.data.priority,
    p_title_fr: parsed.data.titleFr,
    p_title_ar: parsed.data.titleAr,
    p_client_text_fr: parsed.data.clientTextFr,
    p_client_text_ar: parsed.data.clientTextAr,
    p_technical_text_fr: parsed.data.technicalTextFr,
    p_technical_text_ar: parsed.data.technicalTextAr,
    p_change_reason: parsed.data.changeReason,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: parsed.data.correlationId,
  });
  if (result.status === "success") revalidate(parsed.data.locale, parsed.data.organizationId ?? "");
  return result;
}

export async function instructFranchiseDispute(_: FranchiseCommandState, form: FormData): Promise<FranchiseCommandState> {
  const parsed = z.object({
    locale: z.string().refine(isLocale),
    organizationId: z.string().optional(),
    disputeCaseId: uuidSchema,
    statement: z.string().trim().min(10).max(4000),
    confirmed: z.literal("yes"),
    idempotencyKey: uuidSchema,
    correlationId: uuidSchema,
  }).safeParse({
    locale: text(form, "locale"),
    organizationId: text(form, "organizationId") || undefined,
    disputeCaseId: text(form, "disputeCaseId"),
    statement: text(form, "statement"),
    confirmed: text(form, "confirmed"),
    idempotencyKey: text(form, "idempotencyKey"),
    correlationId: text(form, "correlationId"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const result = await rpc("instruct_franchise_dispute", {
    p_dispute_case_id: parsed.data.disputeCaseId,
    p_statement: parsed.data.statement,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: parsed.data.correlationId,
  });
  if (result.status === "success") revalidate(parsed.data.locale, parsed.data.organizationId ?? "");
  return result;
}

export async function decideFranchiseProviderQualification(_: FranchiseCommandState, form: FormData): Promise<FranchiseCommandState> {
  const status = z.enum(["PENDING", "INFORMATION_REQUIRED", "APPROVED", "CONDITIONAL", "SUSPENDED", "EXPIRED", "REJECTED"]);
  const parsed = z.object({
    locale: z.string().refine(isLocale),
    organizationId: z.string().optional(),
    qualificationId: uuidSchema,
    status,
    questionnaireSessionId: uuidSchema.or(z.literal("")),
    scorePercent:z.string(),
    reviewedManifestHash:z.string().regex(/^[a-f0-9]{64}$/u).or(z.literal("")),
    evidenceConfirmed:z.enum(["yes",""]),
    rationale: z.string().trim().min(3).max(2000),
    ruleVersion: z.string().trim().regex(/^[A-Z0-9][A-Z0-9._-]{2,79}$/u),
    blockingCondition: z.string().trim().max(500),
    expectedRowVersion: z.coerce.number().int().positive(),
    confirmed: z.literal("yes"),
    idempotencyKey: uuidSchema,
    correlationId: uuidSchema,
  }).safeParse({
    locale: text(form, "locale"),
    organizationId: text(form, "organizationId") || undefined,
    qualificationId: text(form, "qualificationId"),
    status: text(form, "status"),
    questionnaireSessionId: text(form, "questionnaireSessionId"),
    scorePercent:text(form,"scorePercent"),
    reviewedManifestHash:text(form,"reviewedManifestHash"),
    evidenceConfirmed:text(form,"evidenceConfirmed"),
    rationale: text(form, "rationale"),
    ruleVersion:"PROVIDER-QUALIFICATION-V1",
    blockingCondition: text(form, "blockingCondition"),
    expectedRowVersion: text(form, "expectedRowVersion"),
    confirmed: text(form, "confirmed"),
    idempotencyKey: text(form, "idempotencyKey"),
    correlationId: text(form, "correlationId"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const approved = parsed.data.status === "APPROVED" || parsed.data.status === "CONDITIONAL";
  const session = approved?parsed.data.questionnaireSessionId || null:null;
  const score=approved?humanQualificationScoreBps(parsed.data.scorePercent):null;
  if (approved && (!session || score == null || parsed.data.evidenceConfirmed !== "yes" || !parsed.data.reviewedManifestHash)) {
    return { status: "error", reason: "VALIDATION" };
  }
  if (parsed.data.status === "CONDITIONAL" && parsed.data.blockingCondition.trim().length < 3) {
    return { status: "error", reason: "VALIDATION" };
  }
  const result = await rpc("decide_provider_qualification", {
    p_qualification_id: parsed.data.qualificationId,
    p_status: parsed.data.status,
    p_questionnaire_session_id: session,
    p_score_basis_points: score,
    p_mandatory_checks:approved?[{check:"SUBMITTED_PROVIDER_QUESTIONNAIRE",passed:true},{check:"HUMAN_EVIDENCE_REVIEW",passed:true,review_context_hash:parsed.data.reviewedManifestHash}]:[],
    p_blocking_conditions: parsed.data.blockingCondition.trim() ? [{ condition: parsed.data.blockingCondition.trim() }] : [],
    p_rationale: parsed.data.rationale,
    p_rule_version: parsed.data.ruleVersion,
    p_expires_at: null,
    p_expected_row_version: parsed.data.expectedRowVersion,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: parsed.data.correlationId,
  });
  if (result.status === "success") revalidate(parsed.data.locale, parsed.data.organizationId ?? "");
  return result;
}

export async function inviteFranchiseMandateMember(_: FranchiseCommandState, form: FormData): Promise<FranchiseCommandState> {
  const parsed = z.object({
    locale: z.string().refine(isLocale),
    organizationId: uuidSchema,
    invitedEmail: z.string().trim().toLowerCase().email().max(320),
    roleCode: franchiseRoles,
    expiryDays: z.enum(["1", "7", "14", "30"]),
    confirmed: z.literal("yes"),
    idempotencyKey: z.string().min(8).max(200),
    correlationId: uuidSchema,
  }).safeParse({
    locale: text(form, "locale"),
    organizationId: text(form, "organizationId"),
    invitedEmail: text(form, "invitedEmail"),
    roleCode: text(form, "roleCode"),
    expiryDays: text(form, "expiryDays"),
    confirmed: text(form, "confirmed"),
    idempotencyKey: text(form, "idempotencyKey"),
    correlationId: text(form, "correlationId"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const expiresAt = new Date(Date.now() + Number(parsed.data.expiryDays) * 86_400_000).toISOString();
  const result = await rpc("invite_organization_member_by_email", {
    p_organization_id: parsed.data.organizationId,
    p_invited_email: parsed.data.invitedEmail,
    p_role_codes: [parsed.data.roleCode],
    p_expires_at: expiresAt,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: parsed.data.correlationId,
  });
  if (result.status !== "success") return result;
  // Email delivery is owned by OrganizationEmailInvitationRequestedV1 → outbox consumer.
  revalidate(parsed.data.locale, parsed.data.organizationId);
  revalidatePath(`/${parsed.data.locale}/invitations`);
  return result;
}

export async function proposeFranchiseVolumePurchase(_: FranchiseCommandState, form: FormData): Promise<FranchiseCommandState> {
  const parsed = z.object({
    locale: z.string().refine(isLocale),
    organizationId: z.string().optional(),
    libraryId: uuidSchema,
    franchiseId:uuidSchema,
    skuId: uuidSchema,
    forecastUnits: exactUnits,
    minimumCommitmentUnits: z.string().trim().regex(/^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/),
    maximumUnits: exactUnits,
    paymentModel: z.enum(["PAY_PER_USE", "PREPAID", "HYBRID"]),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    rationale: z.string().trim().min(10).max(4000),
    confirmed: z.literal("yes"),
    idempotencyKey: uuidSchema,
    correlationId: uuidSchema,
  }).safeParse({
    locale: text(form, "locale"),
    organizationId: text(form, "organizationId") || undefined,
    libraryId: text(form, "libraryId"),
    franchiseId:text(form,"franchiseId"),
    skuId: text(form, "skuId"),
    forecastUnits: text(form, "forecastUnits"),
    minimumCommitmentUnits: text(form, "minimumCommitmentUnits"),
    maximumUnits: text(form, "maximumUnits"),
    paymentModel: text(form, "paymentModel"),
    periodStart: text(form, "periodStart"),
    periodEnd: text(form, "periodEnd"),
    rationale: text(form, "rationale"),
    confirmed: text(form, "confirmed"),
    idempotencyKey: text(form, "idempotencyKey"),
    correlationId: text(form, "correlationId"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const scaled=(value:string)=>{const[whole,fraction=""]=value.split(".");return BigInt(whole!)*BigInt(1_000_000)+BigInt(fraction.padEnd(6,"0"));};
  if (scaled(parsed.data.minimumCommitmentUnits) > scaled(parsed.data.maximumUnits) || scaled(parsed.data.forecastUnits) > scaled(parsed.data.maximumUnits) || parsed.data.periodEnd < parsed.data.periodStart) {
    return { status: "error", reason: "VALIDATION" };
  }
  const result = await rpc("propose_franchise_volume_purchase_for_mandate_v1", {
    p_franchise_id:parsed.data.franchiseId,
    p_library_id: parsed.data.libraryId,
    p_sku_id: parsed.data.skuId,
    p_forecast_units: parsed.data.forecastUnits,
    p_minimum_commitment_units: parsed.data.minimumCommitmentUnits,
    p_maximum_units: parsed.data.maximumUnits,
    p_payment_model: parsed.data.paymentModel,
    p_period_start: parsed.data.periodStart,
    p_period_end: parsed.data.periodEnd,
    p_rationale: parsed.data.rationale,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: parsed.data.correlationId,
  });
  if (result.status === "success") revalidate(parsed.data.locale, parsed.data.organizationId ?? "");
  return result;
}

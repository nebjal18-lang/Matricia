"use server";

import { serviceDetails,serviceDetailsSchema } from "@/modules/franchise/data/library/service-details";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { loadFranchiseLibraryWorkspace, type FranchiseLibraryWorkspace } from "@/modules/franchise/data/library/workspace";
import { uuidSchema } from "@/modules/shared/lib/catalogue-builder/model";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

export type FranchiseServiceActionState =
  | { status: "idle" }
  | { status: "success"; serviceId: string; outcome?: string;command?:{draftVersionId:string;identityRowVersion:number;versionRowVersion:number} }
  | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "UNAVAILABLE" | "CONFLICT" | "LOCKED" | "MANDATE_REQUIRED" };

export type FranchiseSimulationActionState =
  | { status: "idle" }
  | { status: "success"; detail: string; evaluation?: {scoreBasisPoints:number;engineVersion:string;actions:Array<{type:string;target?:string;[key:string]:unknown}>} }
  | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "UNAVAILABLE" | "CONFLICT" | "LOCKED" | "MANDATE_REQUIRED" };

const createSchema = z.object({
  ...serviceDetailsSchema,
  locale: z.string().refine(isLocale),
  organizationId: z.string().optional(),
  franchiseId: uuidSchema.optional(),
  libraryId: uuidSchema,
  subcategoryId: uuidSchema,
  code: z.string().trim().regex(/^[A-Z][A-Z0-9_-]{1,79}$/u),
  nameFr: z.string().trim().min(2).max(240),
  nameAr: z.string().trim().min(2).max(240),
  descriptionFr: z.string().trim().min(3).max(1000),
  descriptionAr: z.string().trim().min(3).max(1000),
  changeReason: z.string().trim().min(3).max(500),
  confirmed: z.literal("yes"),
  idempotencyKey: uuidSchema,
  correlationId: uuidSchema,
});

const commandSchema = z.object({
  ...serviceDetailsSchema,
  locale: z.string().refine(isLocale),
  organizationId: z.string().optional(),
  franchiseId: uuidSchema.optional(),
  libraryId: uuidSchema,
  serviceId: uuidSchema,
  subcategoryId: uuidSchema,
  code: z.string().trim().regex(/^[A-Z][A-Z0-9_-]{1,79}$/u),
  nameFr: z.string().trim().min(2).max(240),
  nameAr: z.string().trim().min(2).max(240),
  descriptionFr: z.string().trim().min(3).max(1000),
  descriptionAr: z.string().trim().min(3).max(1000),
  changeReason: z.string().trim().min(3).max(500),
  confirmed: z.literal("yes").optional(),
  draftVersionId: uuidSchema,
  identityRowVersion: z.coerce.number().int().positive(),
  versionRowVersion: z.coerce.number().int().positive(),
  idempotencyKey: uuidSchema,
  correlationId: uuidSchema,
});

const simulateSchema = z.object({
  locale: z.string().refine(isLocale),
  organizationId: z.string().optional(),
  franchiseId: uuidSchema.optional(),
  libraryId: uuidSchema,
  serviceId: uuidSchema,
  idempotencyKey: uuidSchema,
  correlationId: uuidSchema,
});

const submitSchema = z.object({
  locale: z.string().refine(isLocale),
  organizationId: z.string().optional(),
  franchiseId: uuidSchema.optional(),
  libraryId: uuidSchema,
  serviceId: uuidSchema,
  draftVersionId: uuidSchema,
  identityRowVersion: z.coerce.number().int().positive(),
  versionRowVersion: z.coerce.number().int().positive(),
  confirmed: z.literal("yes"),
  idempotencyKey: uuidSchema,
  correlationId: uuidSchema,
});

const reviewSubmitSchema = z.object({
  locale: z.string().refine(isLocale),
  organizationId: z.string().optional(),
  franchiseId: uuidSchema.optional(),
  libraryId: uuidSchema,
  draftVersionId: uuidSchema,
  identityRowVersion: z.coerce.number().int().positive(),
  versionRowVersion: z.coerce.number().int().positive(),
  confirmed: z.literal("yes"),
  idempotencyKey: uuidSchema,
  correlationId: uuidSchema,
});

const questionnaireSubmitSchema = reviewSubmitSchema.extend({ questionnaireId: uuidSchema });
const ruleSubmitSchema = reviewSubmitSchema.extend({ ruleId: uuidSchema });

const publishSchema = z.object({
  locale: z.string().refine(isLocale),
  organizationId: z.string().optional(),
  franchiseId: uuidSchema.optional(),
  libraryId: uuidSchema,
  libraryRowVersion: z.coerce.number().int().positive(),
  confirmed: z.literal("yes"),
  idempotencyKey: uuidSchema,
  correlationId: uuidSchema,
});

const questionnairePublishSchema = z.object({
  locale: z.string().refine(isLocale),
  organizationId: z.string().optional(),
  franchiseId: uuidSchema.optional(),
  libraryId: uuidSchema,
  questionnaireId: uuidSchema,
  draftVersionId: uuidSchema,
  versionRowVersion: z.coerce.number().int().positive(),
  confirmed: z.literal("yes"),
  idempotencyKey: uuidSchema,
  correlationId: uuidSchema,
});

const duplicateSchema = z.object({
  locale: z.string().refine(isLocale),
  organizationId: z.string().optional(),
  franchiseId: uuidSchema.optional(),
  libraryId: uuidSchema,
  serviceId: uuidSchema,
  draftVersionId: uuidSchema,
  subcategoryId: uuidSchema,
  code: z.string().trim().regex(/^[A-Z][A-Z0-9_-]{1,79}$/u),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  nameFr: z.string().trim().min(2).max(240),
  nameAr: z.string().trim().min(2).max(240),
  changeReason: z.string().trim().min(3).max(500),
  confirmed: z.literal("yes"),
  idempotencyKey: uuidSchema,
  correlationId: uuidSchema,
});

const archiveSchema = z.object({
  locale: z.string().refine(isLocale),
  organizationId: z.string().optional(),
  franchiseId: uuidSchema.optional(),
  libraryId: uuidSchema,
  serviceId: uuidSchema,
  draftVersionId: uuidSchema,
  identityRowVersion: z.coerce.number().int().positive(),
  versionRowVersion: z.coerce.number().int().positive(),
  changeReason: z.string().trim().min(3).max(500),
  confirmed: z.literal("yes"),
  idempotencyKey: uuidSchema,
  correlationId: uuidSchema,
});

const cloneQuestionnaireSchema = z.object({
  locale: z.string().refine(isLocale),
  organizationId: z.string().optional(),
  franchiseId: uuidSchema.optional(),
  libraryId: uuidSchema,
  questionnaireId: uuidSchema,
  draftVersionId: uuidSchema,
  targetReleaseId: uuidSchema,
  code: z.string().trim().regex(/^[A-Z][A-Z0-9_-]{1,79}$/u),
  changeReason: z.string().trim().min(3).max(500),
  confirmed: z.literal("yes"),
  idempotencyKey: uuidSchema,
  correlationId: uuidSchema,
});

const questionnaireSimulateSchema = z.object({
  locale: z.string().refine(isLocale),
  organizationId: z.string().optional(),
  franchiseId: uuidSchema.optional(),
  libraryId: uuidSchema,
  questionnaireId: uuidSchema,
  questionnaireVersionId: uuidSchema,
  questionVersionId: uuidSchema.optional(),
  answer: z.string().trim().max(500).optional(),
});

const hierarchySchema = z.object({
  locale: z.string().refine(isLocale),
  organizationId: z.string().optional(),
  franchiseId: uuidSchema.optional(),
  libraryId: uuidSchema,
  code: z.string().trim().regex(/^[A-Z][A-Z0-9_-]{1,79}$/u),
  nameFr: z.string().trim().min(2).max(240),
  nameAr: z.string().trim().min(2).max(240),
  descriptionFr: z.string().trim().min(3).max(1000),
  descriptionAr: z.string().trim().min(3).max(1000),
  changeReason: z.string().trim().min(3).max(500),
  confirmed: z.literal("yes"),
  idempotencyKey: uuidSchema,
  correlationId: uuidSchema,
});

const subcategoryCreateSchema = hierarchySchema.extend({ categoryId: uuidSchema });

const hierarchySubmitSchema = z.object({
  locale: z.string().refine(isLocale),
  organizationId: z.string().optional(),
  franchiseId: uuidSchema.optional(),
  libraryId: uuidSchema,
  objectType: z.enum(["CATEGORY", "SUBCATEGORY"]),
  objectId: uuidSchema,
  draftVersionId: uuidSchema,
  identityRowVersion: z.coerce.number().int().positive(),
  versionRowVersion: z.coerce.number().int().positive(),
  confirmed: z.literal("yes"),
  idempotencyKey: uuidSchema,
  correlationId: uuidSchema,
});

function slugFromCode(code: string) {
  return code.trim().toLowerCase().replace(/_/g, "-");
}

function formValues(formData: FormData) {
  return Object.fromEntries(Array.from(formData.entries()).filter(([key]) => !key.startsWith("$ACTION_")));
}

function mapRpcError(code: string | undefined, message: string | undefined): Extract<FranchiseServiceActionState, { status: "error" }>["reason"] {
  if (code === "42501") return "FORBIDDEN";
  if (code === "40001" || code === "23P01" || /STALE|IDEMPOTENCY|SCHEDULE_CONFLICT/i.test(message ?? "")) return "CONFLICT";
  if (code === "55000" || code === "23514" || /INVALID_CATALOG_VERSION_STATE|NOT_CURRENT|INCOMPLETE_CATALOG_RELEASE|CATALOG_AR_REVIEW_REQUIRED|INVALID_CATALOG_RELEASE|CATALOG_SERVICE_ARCHIVE_BLOCKED|INVALID_QUESTIONNAIRE_CLONE/i.test(message ?? "")) return "LOCKED";
  return "UNAVAILABLE";
}

async function requireWorkspace(input: { locale: string; organizationId?: string; franchiseId?: string; libraryId: string;serviceId?:string;questionnaireId?:string;ruleId?:string }): Promise<
  | { status: "ok"; workspace: FranchiseLibraryWorkspace }
  | { status: "error"; reason: Exclude<FranchiseServiceActionState, { status: "idle" | "success" }>["reason"] }
> {
  const parsedLocale = isLocale(input.locale) ? input.locale : null;
  if (!parsedLocale) return { status: "error", reason: "VALIDATION" };
  const workspace = await loadFranchiseLibraryWorkspace({
    locale: parsedLocale,
    organizationId: input.organizationId && uuidSchema.safeParse(input.organizationId).success ? input.organizationId : undefined,
    libraryId: input.libraryId,
    franchiseId: input.franchiseId,
    catalog:{kind:input.ruleId?"RULE":input.questionnaireId?"QUESTIONNAIRE":"SERVICE",objectId:input.serviceId??input.questionnaireId??input.ruleId},
  });
  if (workspace.status === "error") {
    if (workspace.reason === "MANDATE_REQUIRED") return {status:"error",reason:"MANDATE_REQUIRED"};
    if (workspace.reason === "UNAUTHENTICATED") return { status: "error", reason: "UNAUTHENTICATED" };
    return { status: "error", reason: workspace.reason === "FORBIDDEN" || workspace.reason === "NO_MANDATE" ? "FORBIDDEN" : "UNAVAILABLE" };
  }
  if (workspace.workspace.mandate.libraryId !== input.libraryId || (input.franchiseId && workspace.workspace.mandate.franchiseId !== input.franchiseId)) return { status: "error", reason: "FORBIDDEN" };
  return { status: "ok", workspace: workspace.workspace };
}

function revalidateService(locale: string, serviceId?: string) {
  revalidatePath(`/${locale}/franchise/services`);
  revalidatePath(`/${locale}/franchise/accueil`);
  revalidatePath(`/${locale}/franchise/bibliotheque`);
  revalidatePath(`/${locale}/franchise/validations`);
  revalidatePath(`/${locale}/franchise/questionnaires`);
  revalidatePath(`/${locale}/franchise/regles`);
  if (serviceId) revalidatePath(`/${locale}/franchise/services/${serviceId}`);
}

export async function createFranchiseServiceAction(_state: FranchiseServiceActionState, formData: FormData): Promise<FranchiseServiceActionState> {
  const parsed = createSchema.safeParse(formValues(formData));
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const scoped = await requireWorkspace(parsed.data);
  if (scoped.status === "error") return scoped;
  if (!scoped.workspace.categories.some((category) => category.children.some((child) => child.id === parsed.data.subcategoryId))) {
    return { status: "error", reason: "FORBIDDEN" };
  }
  const details=serviceDetails(parsed.data,null,{fr:parsed.data.descriptionFr,ar:parsed.data.descriptionAr});
  if(!details)return{status:"error",reason:"VALIDATION"};
  const client = await getSupabaseServerClient();
  const response = await client.rpc("create_catalog_service", {
    p_library_id: parsed.data.libraryId,
    p_primary_subcategory_id: parsed.data.subcategoryId,
    p_code: parsed.data.code,
    p_slug: slugFromCode(parsed.data.code),
    p_name_fr: parsed.data.nameFr,
    p_name_ar: parsed.data.nameAr,
    p_short_description_fr: parsed.data.descriptionFr,
    p_short_description_ar: parsed.data.descriptionAr,
    p_long_description_fr: details.longDescriptionFr,
    p_long_description_ar: details.longDescriptionAr,
    p_service_type: details.serviceType,
    p_unit_label_fr: details.unitLabelFr,
    p_unit_label_ar: details.unitLabelAr,
    p_credit_eligible: details.creditEligible,
    p_volume_eligible: details.volumeEligible,
    p_recurring_eligible: details.recurringEligible,
    p_trial_eligible: details.trialEligible,
    p_rfq_required: details.rfqRequired,
    p_fixed_fulfillment_allowed: details.fixedFulfillmentAllowed,
    p_base_currency: details.baseCurrency,
    p_sort_order: details.sortOrder,
    p_fulfillment_config: details.fulfillmentConfig,
    p_visibility_rules: details.visibilityRules,
    p_sensitive: details.sensitive,
    p_change_reason: parsed.data.changeReason,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: parsed.data.correlationId,
  });
  if (response.error) return { status: "error", reason: mapRpcError(response.error.code, response.error.message) };
  const created = z.object({ service_id: z.string().uuid(), library_id: z.string().uuid() }).safeParse(response.data);
  if (!created.success || created.data.library_id !== parsed.data.libraryId) return { status: "error", reason: "UNAVAILABLE" };
  revalidateService(parsed.data.locale, created.data.service_id);
  return { status: "success", serviceId: created.data.service_id, outcome: "CREATED" };
}

export async function saveFranchiseServiceDraftAction(_state: FranchiseServiceActionState, formData: FormData): Promise<FranchiseServiceActionState> {
  const parsed = commandSchema.safeParse(formValues(formData));
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const scoped = await requireWorkspace(parsed.data);
  if (scoped.status === "error") return scoped;
  const service = scoped.workspace.services.find((item) => item.id === parsed.data.serviceId);
  if (!service?.command) return { status: "error", reason: "FORBIDDEN" };
  if (!scoped.workspace.categories.some((category) => category.children.some((child) => child.id === parsed.data.subcategoryId))) {
    return { status: "error", reason: "FORBIDDEN" };
  }
  const command = service.command;
  const details=serviceDetails(parsed.data,command,{fr:parsed.data.descriptionFr,ar:parsed.data.descriptionAr});
  if(!details)return{status:"error",reason:"VALIDATION"};
  const client = await getSupabaseServerClient();
  const response = await client.rpc("save_catalog_service_draft", {
    p_service_id: parsed.data.serviceId,
    p_version_id: parsed.data.draftVersionId,
    p_primary_subcategory_id: parsed.data.subcategoryId,
    p_code: parsed.data.code,
    p_slug: command.slug || slugFromCode(parsed.data.code),
    p_name_fr: parsed.data.nameFr,
    p_name_ar: parsed.data.nameAr,
    p_short_description_fr: parsed.data.descriptionFr,
    p_short_description_ar: parsed.data.descriptionAr,
    p_long_description_fr: details.longDescriptionFr,
    p_long_description_ar: details.longDescriptionAr,
    p_service_type: details.serviceType,
    p_unit_label_fr: details.unitLabelFr,
    p_unit_label_ar: details.unitLabelAr,
    p_credit_eligible: details.creditEligible,
    p_volume_eligible: details.volumeEligible,
    p_recurring_eligible: details.recurringEligible,
    p_trial_eligible: details.trialEligible,
    p_rfq_required: details.rfqRequired,
    p_fixed_fulfillment_allowed: details.fixedFulfillmentAllowed,
    p_base_currency: details.baseCurrency,
    p_sort_order: details.sortOrder,
    p_fulfillment_config: details.fulfillmentConfig,
    p_visibility_rules: details.visibilityRules,
    p_sensitive: details.sensitive,
    p_change_reason: parsed.data.changeReason,
    p_expected_identity_row_version: parsed.data.identityRowVersion,
    p_expected_version_row_version: parsed.data.versionRowVersion,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: parsed.data.correlationId,
  });
  if (response.error) return { status: "error", reason: mapRpcError(response.error.code, response.error.message) };
  revalidateService(parsed.data.locale, parsed.data.serviceId);
  const saved=z.object({version_id:z.string().uuid(),identity_row_version:z.number().int().positive(),version_row_version:z.number().int().positive()}).safeParse(response.data);
  if(!saved.success)return{status:"error",reason:"UNAVAILABLE"};
  return { status: "success", serviceId: parsed.data.serviceId, outcome: "SAVED",command:{draftVersionId:saved.data.version_id,identityRowVersion:saved.data.identity_row_version,versionRowVersion:saved.data.version_row_version} };
}

export async function simulateFranchiseServiceImpactAction(_state: FranchiseServiceActionState, formData: FormData): Promise<FranchiseServiceActionState> {
  const parsed = simulateSchema.safeParse(formValues(formData));
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const scoped = await requireWorkspace(parsed.data);
  if (scoped.status === "error") return scoped;
  if (!scoped.workspace.services.some((item) => item.id === parsed.data.serviceId)) return { status: "error", reason: "FORBIDDEN" };
  const client = await getSupabaseServerClient();
  const response = await client.rpc("simulate_catalog_service_impact", {
    p_service_id: parsed.data.serviceId,
    p_max_items: 25,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: parsed.data.correlationId,
  });
  if (response.error) return { status: "error", reason: mapRpcError(response.error.code, response.error.message) };
  const impact = z.object({
    outcome: z.string(),
    blocking_dependencies: z.array(z.unknown()).optional(),
    can_archive_immediately: z.boolean().optional(),
  }).safeParse(response.data);
  if (!impact.success) return { status: "error", reason: "UNAVAILABLE" };
  revalidateService(parsed.data.locale, parsed.data.serviceId);
  return {
    status: "success",
    serviceId: parsed.data.serviceId,
    outcome: `${impact.data.outcome}:${impact.data.blocking_dependencies?.length ?? 0}:${impact.data.can_archive_immediately ? "1" : "0"}`,
  };
}

export async function submitFranchiseCatalogServiceAction(_state: FranchiseServiceActionState, formData: FormData): Promise<FranchiseServiceActionState> {
  const parsed = submitSchema.safeParse(formValues(formData));
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const scoped = await requireWorkspace(parsed.data);
  if (scoped.status === "error") return scoped;
  const service = scoped.workspace.services.find((item) => item.id === parsed.data.serviceId);
  if (!service?.command || service.command.draftVersionId !== parsed.data.draftVersionId) return { status: "error", reason: "FORBIDDEN" };
  if (service.status !== "DRAFT") return { status: "error", reason: "LOCKED" };
  const client = await getSupabaseServerClient();
  const response = await client.rpc("submit_franchise_catalog_service", {
    p_service_id: parsed.data.serviceId,
    p_version_id: parsed.data.draftVersionId,
    p_expected_identity_row_version: parsed.data.identityRowVersion,
    p_expected_version_row_version: parsed.data.versionRowVersion,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: parsed.data.correlationId,
  });
  if (response.error) return { status: "error", reason: mapRpcError(response.error.code, response.error.message) };
  revalidateService(parsed.data.locale, parsed.data.serviceId);
  return { status: "success", serviceId: parsed.data.serviceId, outcome: "SUBMITTED" };
}

export async function simulateFranchiseQuestionnaireAction(_state: FranchiseSimulationActionState, formData: FormData): Promise<FranchiseSimulationActionState> {
  const parsed = questionnaireSimulateSchema.safeParse(formValues(formData));
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const scoped = await requireWorkspace(parsed.data);
  if (scoped.status === "error") return { status: "error", reason: scoped.reason };
  const questionnaire = scoped.workspace.questionnaires.find((item) => item.id === parsed.data.questionnaireId);
  if (!questionnaire || questionnaire.questionnaireVersionId !== parsed.data.questionnaireVersionId) {
    return { status: "error", reason: "FORBIDDEN" };
  }
  const answers: Record<string, unknown> = {};
  const allowed = new Set((scoped.workspace.compositionQuestions ?? []).filter((q)=>q.versionId===parsed.data.questionnaireVersionId).map((q)=>q.questionVersionId));
  const entries = [...formData.entries()].filter(([key])=>key.startsWith("answer:")).map(([key,value])=>[key.slice(7),value] as const);
  if(parsed.data.questionVersionId)entries.push([parsed.data.questionVersionId,parsed.data.answer ?? ""]);
  if(entries.length>500)return{status:"error",reason:"VALIDATION"};
  for(const [questionId,value] of entries){
    if(!allowed.has(questionId))return{status:"error",reason:"FORBIDDEN"};
    const question=scoped.workspace.questionVersionBank?.find((q)=>q.id===questionId);
    if(!question || typeof value!=="string" || value.length>10000)return{status:"error",reason:"VALIDATION"};
    const raw=value.trim();if(!raw)continue;
    if(["YES_NO","INTEGER","DECIMAL","PERCENTAGE","MONEY","SINGLE_CHOICE","MULTIPLE_CHOICE","FILE"].includes(question.answerType)){
      try{answers[questionId]=JSON.parse(raw);}catch{return{status:"error",reason:"VALIDATION"};}
    }else answers[questionId]=raw;
  }
  const client = await getSupabaseServerClient();
  const response = await client.rpc("simulate_questionnaire_rule_engine", {
    p_questionnaire_version_id: parsed.data.questionnaireVersionId,
    p_answers: answers,
    p_previous_answers: {},
  });
  if (response.error) return { status: "error", reason: mapRpcError(response.error.code, response.error.message) };
  const simulated = z.object({
    triggered_actions: z.array(z.object({type:z.string(),target:z.string().optional()}).passthrough()),
    score_basis_points: z.number().int(),
    engine_version:z.string(),
  }).passthrough().safeParse(response.data);
  if (!simulated.success) return { status: "error", reason: "UNAVAILABLE" };
  const actions = simulated.data.triggered_actions?.length ?? 0;
  return {
    status: "success",
    detail: `${actions}:${simulated.data.score_basis_points}`,
    evaluation:{scoreBasisPoints:simulated.data.score_basis_points,engineVersion:simulated.data.engine_version,actions:simulated.data.triggered_actions},
  };
}

export async function submitFranchiseCatalogQuestionnaireAction(_state: FranchiseServiceActionState, formData: FormData): Promise<FranchiseServiceActionState> {
  const parsed = questionnaireSubmitSchema.safeParse(formValues(formData));
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const scoped = await requireWorkspace(parsed.data);
  if (scoped.status === "error") return scoped;
  const questionnaire = scoped.workspace.questionnaires.find((item) => item.id === parsed.data.questionnaireId);
  if (!questionnaire || questionnaire.draftVersionId !== parsed.data.draftVersionId) return { status: "error", reason: "FORBIDDEN" };
  if (!["DRAFT", "LOCAL_TEST", "FRANCHISE_REVIEW"].includes(questionnaire.status)) return { status: "error", reason: "LOCKED" };
  const client = await getSupabaseServerClient();
  const response = await client.rpc("submit_franchise_catalog_questionnaire", {
    p_questionnaire_id: parsed.data.questionnaireId,
    p_version_id: parsed.data.draftVersionId,
    p_expected_identity_row_version: parsed.data.identityRowVersion,
    p_expected_version_row_version: parsed.data.versionRowVersion,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: parsed.data.correlationId,
  });
  if (response.error) return { status: "error", reason: mapRpcError(response.error.code, response.error.message) };
  revalidateService(parsed.data.locale);
  revalidatePath(`/${parsed.data.locale}/franchise/questionnaires/${parsed.data.questionnaireId}`);
  return { status: "success", serviceId: parsed.data.questionnaireId, outcome: "SUBMITTED" };
}

export async function submitFranchiseCatalogRuleAction(_state: FranchiseServiceActionState, formData: FormData): Promise<FranchiseServiceActionState> {
  const parsed = ruleSubmitSchema.safeParse(formValues(formData));
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const scoped = await requireWorkspace(parsed.data);
  if (scoped.status === "error") return scoped;
  const rule = scoped.workspace.rules.find((item) => item.id === parsed.data.ruleId);
  if (!rule || rule.draftVersionId !== parsed.data.draftVersionId) return { status: "error", reason: "FORBIDDEN" };
  if (rule.status !== "DRAFT") return { status: "error", reason: "LOCKED" };
  const client = await getSupabaseServerClient();
  const response = await client.rpc("submit_franchise_catalog_rule", {
    p_rule_id: parsed.data.ruleId,
    p_version_id: parsed.data.draftVersionId,
    p_expected_identity_row_version: parsed.data.identityRowVersion,
    p_expected_version_row_version: parsed.data.versionRowVersion,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: parsed.data.correlationId,
  });
  if (response.error) return { status: "error", reason: mapRpcError(response.error.code, response.error.message) };
  revalidateService(parsed.data.locale);
  revalidatePath(`/${parsed.data.locale}/franchise/regles/${parsed.data.ruleId}`);
  return { status: "success", serviceId: parsed.data.ruleId, outcome: "SUBMITTED" };
}

export async function submitFranchiseCatalogPublicationAction(_state: FranchiseServiceActionState, formData: FormData): Promise<FranchiseServiceActionState> {
  const parsed = publishSchema.safeParse(formValues(formData));
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const scoped = await requireWorkspace(parsed.data);
  if (scoped.status === "error") return scoped;
  if (scoped.workspace.mandate.libraryRowVersion !== parsed.data.libraryRowVersion) return { status: "error", reason: "CONFLICT" };
  if (!scoped.workspace.services.some((item) => item.status === "APPROVED")) return { status: "error", reason: "LOCKED" };
  const client = await getSupabaseServerClient();
  const response = await client.rpc("submit_franchise_catalog_publication", {
    p_library_id: parsed.data.libraryId,
    p_expected_library_row_version: parsed.data.libraryRowVersion,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: parsed.data.correlationId,
  });
  if (response.error) return { status: "error", reason: mapRpcError(response.error.code, response.error.message) };
  const published = z.object({
    outcome: z.string(),
    release_id: z.string().uuid().optional(),
    status: z.string().optional(),
  }).passthrough().safeParse(response.data);
  if (!published.success) return { status: "error", reason: "UNAVAILABLE" };
  revalidateService(parsed.data.locale);
  return { status: "success", serviceId: published.data.release_id ?? parsed.data.libraryId, outcome: published.data.status ?? published.data.outcome };
}

export async function publishFranchiseQuestionnaireAction(_state: FranchiseServiceActionState, formData: FormData): Promise<FranchiseServiceActionState> {
  const parsed = questionnairePublishSchema.safeParse(formValues(formData));
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const scoped = await requireWorkspace(parsed.data);
  if (scoped.status === "error") return scoped;
  const questionnaire = scoped.workspace.questionnaires.find((item) => item.id === parsed.data.questionnaireId);
  if (!questionnaire || questionnaire.draftVersionId !== parsed.data.draftVersionId) return { status: "error", reason: "FORBIDDEN" };
  if (questionnaire.status !== "APPROVED") return { status: "error", reason: "LOCKED" };
  const client = await getSupabaseServerClient();
  const response = await client.rpc("publish_questionnaire_version", {
    p_questionnaire_version_id: parsed.data.draftVersionId,
    p_expected_row_version: parsed.data.versionRowVersion,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: parsed.data.correlationId,
  });
  if (response.error) return { status: "error", reason: mapRpcError(response.error.code, response.error.message) };
  revalidateService(parsed.data.locale);
  revalidatePath(`/${parsed.data.locale}/franchise/questionnaires/${parsed.data.questionnaireId}`);
  return { status: "success", serviceId: parsed.data.questionnaireId, outcome: "PUBLISHED" };
}

export async function duplicateFranchiseCatalogServiceAction(_state: FranchiseServiceActionState, formData: FormData): Promise<FranchiseServiceActionState> {
  const parsed = duplicateSchema.safeParse(formValues(formData));
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const scoped = await requireWorkspace(parsed.data);
  if (scoped.status === "error") return scoped;
  const service = scoped.workspace.services.find((item) => item.id === parsed.data.serviceId);
  if (!service?.command || service.command.draftVersionId !== parsed.data.draftVersionId) return { status: "error", reason: "FORBIDDEN" };
  if (service.status === "ARCHIVED") return { status: "error", reason: "LOCKED" };
  const client = await getSupabaseServerClient();
  const response = await client.rpc("duplicate_catalog_service", {
    p_source_service_id: parsed.data.serviceId,
    p_source_version_id: parsed.data.draftVersionId,
    p_primary_subcategory_id: parsed.data.subcategoryId,
    p_code: parsed.data.code,
    p_slug: parsed.data.slug,
    p_name_fr: parsed.data.nameFr,
    p_name_ar: parsed.data.nameAr,
    p_change_reason: parsed.data.changeReason,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: parsed.data.correlationId,
  });
  if (response.error) return { status: "error", reason: mapRpcError(response.error.code, response.error.message) };
  const duplicated = z.object({ service_id: z.string().uuid().optional(), outcome: z.string().optional() }).passthrough().safeParse(response.data);
  revalidateService(parsed.data.locale, duplicated.success ? duplicated.data.service_id : parsed.data.serviceId);
  return { status: "success", serviceId: duplicated.success && duplicated.data.service_id ? duplicated.data.service_id : parsed.data.serviceId, outcome: "DUPLICATED" };
}

export async function archiveFranchiseCatalogServiceAction(_state: FranchiseServiceActionState, formData: FormData): Promise<FranchiseServiceActionState> {
  const parsed = archiveSchema.safeParse(formValues(formData));
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const scoped = await requireWorkspace(parsed.data);
  if (scoped.status === "error") return scoped;
  const service = scoped.workspace.services.find((item) => item.id === parsed.data.serviceId);
  if (!service?.command || service.command.draftVersionId !== parsed.data.draftVersionId) return { status: "error", reason: "FORBIDDEN" };
  if (service.status === "ARCHIVED" || service.status === "IN_REVIEW") return { status: "error", reason: "LOCKED" };
  const client = await getSupabaseServerClient();
  const response = await client.rpc("archive_catalog_service", {
    p_service_id: parsed.data.serviceId,
    p_version_id: parsed.data.draftVersionId,
    p_expected_identity_row_version: parsed.data.identityRowVersion,
    p_expected_version_row_version: parsed.data.versionRowVersion,
    p_change_reason: parsed.data.changeReason,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: parsed.data.correlationId,
  });
  if (response.error) return { status: "error", reason: mapRpcError(response.error.code, response.error.message) };
  revalidateService(parsed.data.locale, parsed.data.serviceId);
  return { status: "success", serviceId: parsed.data.serviceId, outcome: "ARCHIVED" };
}

export async function cloneFranchiseCatalogQuestionnaireAction(_state: FranchiseServiceActionState, formData: FormData): Promise<FranchiseServiceActionState> {
  const parsed = cloneQuestionnaireSchema.safeParse(formValues(formData));
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const scoped = await requireWorkspace(parsed.data);
  if (scoped.status === "error") return scoped;
  const questionnaire = scoped.workspace.questionnaires.find((item) => item.id === parsed.data.questionnaireId);
  if (!questionnaire || questionnaire.draftVersionId !== parsed.data.draftVersionId) return { status: "error", reason: "FORBIDDEN" };
  const client = await getSupabaseServerClient();
  const response = await client.rpc("clone_catalog_questionnaire", {
    p_source_version_id: parsed.data.draftVersionId,
    p_target_release_id: parsed.data.targetReleaseId,
    p_new_code: parsed.data.code,
    p_change_reason: parsed.data.changeReason,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: parsed.data.correlationId,
  });
  if (response.error) return { status: "error", reason: mapRpcError(response.error.code, response.error.message) };
  const cloned = z.object({ questionnaire_id: z.string().uuid().optional() }).passthrough().safeParse(response.data);
  revalidateService(parsed.data.locale);
  revalidatePath(`/${parsed.data.locale}/franchise/questionnaires`);
  return { status: "success", serviceId: cloned.success && cloned.data.questionnaire_id ? cloned.data.questionnaire_id : parsed.data.questionnaireId, outcome: "CLONED" };
}

export async function createFranchiseCategoryAction(_state: FranchiseServiceActionState, formData: FormData): Promise<FranchiseServiceActionState> {
  const parsed = hierarchySchema.safeParse(formValues(formData));
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const scoped = await requireWorkspace(parsed.data);
  if (scoped.status === "error") return scoped;
  const client = await getSupabaseServerClient();
  const response = await client.rpc("create_catalog_category", {
    p_library_id: parsed.data.libraryId,
    p_code: parsed.data.code,
    p_slug: slugFromCode(parsed.data.code),
    p_name_fr: parsed.data.nameFr,
    p_name_ar: parsed.data.nameAr,
    p_description_fr: parsed.data.descriptionFr,
    p_description_ar: parsed.data.descriptionAr,
    p_icon_key: "category",
    p_sort_order: Math.max(1, scoped.workspace.categories.length + 1),
    p_visibility_rules: {},
    p_sensitive: false,
    p_change_reason: parsed.data.changeReason,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: parsed.data.correlationId,
  });
  if (response.error) return { status: "error", reason: mapRpcError(response.error.code, response.error.message) };
  const created = z.object({ category_id: z.string().uuid(), library_id: z.string().uuid() }).safeParse(response.data);
  if (!created.success || created.data.library_id !== parsed.data.libraryId) return { status: "error", reason: "UNAVAILABLE" };
  revalidateService(parsed.data.locale);
  return { status: "success", serviceId: created.data.category_id, outcome: "CATEGORY_CREATED" };
}

export async function createFranchiseSubcategoryAction(_state: FranchiseServiceActionState, formData: FormData): Promise<FranchiseServiceActionState> {
  const parsed = subcategoryCreateSchema.safeParse(formValues(formData));
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const scoped = await requireWorkspace(parsed.data);
  if (scoped.status === "error") return scoped;
  if (!scoped.workspace.categories.some((category) => category.id === parsed.data.categoryId)) {
    return { status: "error", reason: "FORBIDDEN" };
  }
  const client = await getSupabaseServerClient();
  const parent = scoped.workspace.categories.find((category) => category.id === parsed.data.categoryId);
  const response = await client.rpc("create_catalog_subcategory", {
    p_category_id: parsed.data.categoryId,
    p_code: parsed.data.code,
    p_slug: slugFromCode(parsed.data.code),
    p_name_fr: parsed.data.nameFr,
    p_name_ar: parsed.data.nameAr,
    p_description_fr: parsed.data.descriptionFr,
    p_description_ar: parsed.data.descriptionAr,
    p_icon_key: "subcategory",
    p_sort_order: Math.max(1, (parent?.children.length ?? 0) + 1),
    p_visibility_rules: {},
    p_sensitive: false,
    p_change_reason: parsed.data.changeReason,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: parsed.data.correlationId,
  });
  if (response.error) return { status: "error", reason: mapRpcError(response.error.code, response.error.message) };
  const created = z.object({ subcategory_id: z.string().uuid(), library_id: z.string().uuid() }).safeParse(response.data);
  if (!created.success || created.data.library_id !== parsed.data.libraryId) return { status: "error", reason: "UNAVAILABLE" };
  revalidateService(parsed.data.locale);
  return { status: "success", serviceId: created.data.subcategory_id, outcome: "SUBCATEGORY_CREATED" };
}

export async function submitFranchiseHierarchyAction(_state: FranchiseServiceActionState, formData: FormData): Promise<FranchiseServiceActionState> {
  const parsed = hierarchySubmitSchema.safeParse(formValues(formData));
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const scoped = await requireWorkspace(parsed.data);
  if (scoped.status === "error") return scoped;
  const category = scoped.workspace.categories.find((item) => item.id === parsed.data.objectId);
  const child = scoped.workspace.categories.flatMap((item) => item.children).find((item) => item.id === parsed.data.objectId);
  const target = parsed.data.objectType === "CATEGORY" ? category : child;
  if (!target || target.draftVersionId !== parsed.data.draftVersionId || target.status !== "DRAFT") {
    return { status: "error", reason: "FORBIDDEN" };
  }
  const client = await getSupabaseServerClient();
  const response = await client.rpc("submit_catalog_change", {
    p_object_type: parsed.data.objectType,
    p_object_id: parsed.data.objectId,
    p_version_id: parsed.data.draftVersionId,
    p_expected_identity_row_version: parsed.data.identityRowVersion,
    p_expected_version_row_version: parsed.data.versionRowVersion,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: parsed.data.correlationId,
  });
  if (response.error) return { status: "error", reason: mapRpcError(response.error.code, response.error.message) };
  revalidateService(parsed.data.locale);
  return { status: "success", serviceId: parsed.data.objectId, outcome: "SUBMITTED" };
}

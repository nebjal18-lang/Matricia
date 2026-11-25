"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { minimizeAssistanceInput } from "@/modules/shared/lib/assisted-intelligence/model";
import {
  canonicalizePublicNeedClassification,
  classificationSnapshot,
  type NeedDiscovery,
  type NeedQuestionSuggestion,
  type NeedServiceSuggestion,
} from "@/modules/public/data/need-intent/model";

const uuid = z.string().uuid();
const classificationSchema = z.object({ libraryCode: z.string().max(40), serviceCode: z.string().max(100).nullable() }).strict();
const payloadSchema = z.object({
  need: z.string().trim().min(10).max(1200),
  location: z.string().max(1200),
  timing: z.string().max(1200),
  constraints: z.string().max(1200),
  classification: classificationSchema.nullable().optional(),
}).strict();
const inputSchema = z.object({ locale: z.enum(["fr", "ar"]), organizationId: uuid, payload: z.string().max(8000) });
const discoverInput = z.object({ locale: z.enum(["fr", "ar"]), organizationId: uuid, inputText: z.string().trim().min(10).max(1000) });
const discoveryOutput = z.object({
  outcome: z.literal("ASSISTANCE_SCOPE_DISCOVERED"),
  algorithm: z.literal("TOKEN_OVERLAP_V1"),
  service_candidates: z.array(z.object({ service_version_id: uuid, service_id: uuid, score_basis_points: z.number().int().min(0).max(10_000) }).strict()).max(20),
  question_candidates: z.array(z.object({ question_version_id: uuid, service_id: uuid, required_for_quote: z.boolean(), score_basis_points: z.number().int().min(0).max(10_000) }).strict()).max(50),
  human_confirmation_required: z.literal(true),
}).strict();
const serviceVersionRow = z.object({
  id: uuid,
  service_id: uuid,
  library_id: uuid,
  name_fr: z.string().min(1),
  name_ar: z.string().min(1),
  code: z.string().min(1),
});
const libraryRow = z.object({ id: uuid, code: z.string().min(1) });
const questionRow = z.object({
  id: uuid,
  source_service_id: uuid.nullable(),
  label_fr: z.string().min(1),
  label_ar: z.string().min(1),
  help_fr: z.string().nullable(),
  help_ar: z.string().nullable(),
  data_key: z.string().min(1),
  required_for_quote: z.boolean(),
  answer_type: z.string().min(1),
  options: z.unknown(),
});
const factRow = z.object({
  data_key: z.string().min(1),
  value: z.unknown(),
  source_type: z.string().min(1),
  observed_at: z.string(),
  fresh_until: z.string(),
});

export type SaveNeedState = { status: "idle" } | { status: "success"; intakeId: string } | { status: "error"; reason: "VALIDATION" | "FORBIDDEN" | "UNAVAILABLE" };
export type DiscoverNeedState =
  | { status: "success"; value: NeedDiscovery }
  | { status: "error"; reason: "VALIDATION" | "FORBIDDEN" | "UNAUTHENTICATED" | "UNAVAILABLE" };

function jsonText(value: unknown): string | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text && text.length <= 1200 ? text : null;
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" && Number.isInteger(value)) return String(value);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (typeof record.fr === "string") return jsonText(record.fr);
    if (typeof record.label === "string") return jsonText(record.label);
    if (typeof record.value === "string") return jsonText(record.value);
  }
  return null;
}

function optionLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string" && item.trim()) return [item.trim().slice(0, 120)];
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const record = item as Record<string, unknown>;
      const label = record.label ?? record.fr ?? record.value;
      return typeof label === "string" && label.trim() ? [label.trim().slice(0, 120)] : [];
    }
    return [];
  }).slice(0, 40);
}

function isLocationKey(key: string): boolean {
  return /(city|region|address|site|ville|localisation|geo)/iu.test(key);
}

export async function savePublicNeedIntake(_: SaveNeedState, data: FormData): Promise<SaveNeedState> {
  const input = inputSchema.safeParse({ locale: data.get("locale"), organizationId: data.get("organizationId"), payload: data.get("payload") });
  if (!input.success) return { status: "error", reason: "VALIDATION" };
  let raw: unknown;
  try { raw = JSON.parse(input.data.payload); } catch { return { status: "error", reason: "VALIDATION" }; }
  const payload = payloadSchema.safeParse(raw);
  if (!payload.success) return { status: "error", reason: "VALIDATION" };
  const classification = payload.data.classification
    ? canonicalizePublicNeedClassification(payload.data.classification, input.data.locale)
    : null;
  if (payload.data.classification && !classification) return { status: "error", reason: "VALIDATION" };
  const snapshot = classification ? classificationSnapshot(classification, input.data.locale) : "";
  const constraints = [payload.data.constraints.trim(), snapshot].filter(Boolean).join("\n");
  if (constraints.length > 1200) return { status: "error", reason: "VALIDATION" };
  const canonicalPayload = { need: payload.data.need, location: payload.data.location, timing: payload.data.timing, constraints };
  const idempotencyKey = createHash("sha256").update(`${input.data.organizationId}:${JSON.stringify({ ...canonicalPayload, classification })}`).digest("hex");
  const client = await getSupabaseServerClient();
  const result = await client.rpc("save_public_need_intake", {
    p_organization_id: input.data.organizationId,
    p_payload: canonicalPayload,
    p_locale: input.data.locale,
    p_idempotency_key: idempotencyKey,
    p_correlation_id: randomUUID(),
  });
  if (result.error) return { status: "error", reason: result.error.code === "42501" ? "FORBIDDEN" : "UNAVAILABLE" };
  const response = z.object({ outcome: z.literal("PUBLIC_NEED_INTAKE_SAVED"), intake_id: uuid, status: z.literal("DRAFT_REVIEW") }).passthrough().safeParse(result.data);
  if (!response.success) return { status: "error", reason: "UNAVAILABLE" };
  revalidatePath(`/${input.data.locale}/client/demandes`);
  return { status: "success", intakeId: response.data.intake_id };
}

export async function discoverPublicNeedScope(input: {
  locale: "fr" | "ar";
  organizationId: string;
  inputText: string;
}): Promise<DiscoverNeedState> {
  const parsed = discoverInput.safeParse(input);
  const minimized = parsed.success ? minimizeAssistanceInput(parsed.data.inputText) : null;
  if (!parsed.success || !minimized || minimized.length < 10) return { status: "error", reason: "VALIDATION" };
  const client = await getSupabaseServerClient();
  const auth = await client.auth.getUser();
  if (!auth.data.user) return { status: "error", reason: "UNAUTHENTICATED" };

  const factsQuery = await client
    .from("prefill_fact_versions")
    .select("data_key,value,source_type,observed_at,fresh_until")
    .eq("organization_id", parsed.data.organizationId)
    .gt("fresh_until", new Date().toISOString())
    .order("observed_at", { ascending: false })
    .limit(100);
  const facts = factsQuery.error ? [] : z.array(factRow).safeParse(factsQuery.data).data ?? [];
  const latestByKey = new Map<string, z.infer<typeof factRow>>();
  for (const fact of facts) if (!latestByKey.has(fact.data_key)) latestByKey.set(fact.data_key, fact);
  const knownDataKeys = [...latestByKey.keys()].slice(0, 100);

  const discovery = await client.rpc("discover_assistance_scope", {
    p_organization_id: parsed.data.organizationId,
    p_input_text: minimized,
    p_known_data_keys: knownDataKeys,
    p_limit: 20,
  });
  if (discovery.error) {
    if (discovery.error.code === "42501") return { status: "error", reason: "FORBIDDEN" };
    if (discovery.error.code === "22023") return { status: "error", reason: "VALIDATION" };
    return { status: "error", reason: "UNAVAILABLE" };
  }
  const scope = discoveryOutput.safeParse(discovery.data);
  if (!scope.success) return { status: "error", reason: "UNAVAILABLE" };

  const versionIds = scope.data.service_candidates.map((item) => item.service_version_id);
  const questionIds = scope.data.question_candidates.map((item) => item.question_version_id);
  const versionsQuery = versionIds.length
    ? await client.from("catalog_service_versions").select("id,service_id,library_id,name_fr,name_ar,code").in("id", versionIds).eq("status", "PUBLISHED")
    : { data: [], error: null };
  const versions = versionsQuery.error ? null : z.array(serviceVersionRow).safeParse(versionsQuery.data);
  if (!versions?.success) return { status: "error", reason: "UNAVAILABLE" };
  const libraryIds = [...new Set(versions.data.map((item) => item.library_id))];
  const librariesQuery = libraryIds.length
    ? await client.from("catalog_libraries").select("id,code").in("id", libraryIds)
    : { data: [], error: null };
  const libraries = librariesQuery.error ? null : z.array(libraryRow).safeParse(librariesQuery.data);
  if (!libraries?.success) return { status: "error", reason: "UNAVAILABLE" };
  const questionsQuery = questionIds.length
    ? await client.from("question_versions").select("id,source_service_id,label_fr,label_ar,help_fr,help_ar,data_key,required_for_quote,answer_type,options").in("id", questionIds).eq("status", "PUBLISHED")
    : { data: [], error: null };
  const questions = questionsQuery.error ? null : z.array(questionRow).safeParse(questionsQuery.data);
  if (!questions?.success) return { status: "error", reason: "UNAVAILABLE" };

  const libraryById = new Map(libraries.data.map((item) => [item.id, item.code]));
  const versionById = new Map(versions.data.map((item) => [item.id, item]));
  const questionById = new Map(questions.data.map((item) => [item.id, item]));
  const arabic = parsed.data.locale === "ar";
  const services: NeedServiceSuggestion[] = [];
  for (const candidate of scope.data.service_candidates) {
    const version = versionById.get(candidate.service_version_id);
    if (!version) continue;
    const libraryCode = libraryById.get(version.library_id);
    const classified = libraryCode
      ? canonicalizePublicNeedClassification({ libraryCode, serviceCode: version.code }, parsed.data.locale)
      : null;
    if (!classified?.serviceCode) continue;
    services.push({
      libraryCode: classified.libraryCode,
      serviceCode: classified.serviceCode,
      serviceName: arabic ? version.name_ar : version.name_fr,
      libraryName: classified.libraryName,
      scoreBasisPoints: candidate.score_basis_points,
      serviceVersionId: version.id,
      serviceId: version.service_id,
    });
  }

  const questionSuggestions: NeedQuestionSuggestion[] = [];
  for (const candidate of scope.data.question_candidates) {
    const question = questionById.get(candidate.question_version_id);
    if (!question || !question.source_service_id) continue;
    const fact = latestByKey.get(question.data_key);
    const prefillValue = fact ? jsonText(fact.value) : null;
    questionSuggestions.push({
      questionVersionId: question.id,
      serviceId: question.source_service_id,
      dataKey: question.data_key,
      label: arabic ? question.label_ar : question.label_fr,
      help: arabic ? question.help_ar : question.help_fr,
      requiredForQuote: question.required_for_quote,
      answerType: question.answer_type,
      options: optionLabels(question.options),
      scoreBasisPoints: candidate.score_basis_points,
      prefill: prefillValue && fact ? { value: prefillValue, source: fact.source_type } : null,
    });
  }

  let locationPrefill: string | null = null;
  for (const fact of latestByKey.values()) {
    if (!isLocationKey(fact.data_key)) continue;
    locationPrefill = jsonText(fact.value);
    if (locationPrefill) break;
  }

  return {
    status: "success",
    value: {
      algorithm: "TOKEN_OVERLAP_V1",
      humanConfirmationRequired: true,
      services: services.slice(0, 8),
      questions: questionSuggestions.slice(0, 12),
      knownCount: latestByKey.size,
      locationPrefill,
    },
  };
}

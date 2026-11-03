"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
export type PrivacyState = { status: "idle" | "success" | "error"; message?: string };
const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
export async function managePrivacy(_: PrivacyState, form: FormData): Promise<PrivacyState> {
  const locale = text(form, "locale");
  const correlation = z.string().uuid().safeParse(text(form, "idempotencyKey"));
  if (!isLocale(locale) || !correlation.success) return { status: "error", message: "VALIDATION" };
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { status: "error", message: "UNAUTHENTICATED" };
  let rpc: string;
  let args: Record<string, unknown>;
  const intent = text(form, "intent");
  if (intent === "register") {
    const input = z.object({ org: z.string().uuid(), type: z.enum(["ACCESS", "RECTIFICATION", "OPPOSITION", "ERASURE", "RESTRICTION", "PORTABILITY", "CONSENT_WITHDRAWAL", "OTHER"]), subject: z.string().min(3).max(300), verification: z.enum(["STANDARD", "ENHANCED", "IN_PERSON"]), days: z.coerce.number().int().min(1).max(365) }).safeParse({ org: text(form, "organizationId"), type: text(form, "requestType"), subject: text(form, "subjectReference"), verification: text(form, "verificationLevel"), days: text(form, "slaDays") });
    if (!input.success) return { status: "error", message: "VALIDATION" };
    rpc = "register_data_subject_request";
    args = { p_organization_id: input.data.org, p_request_type: input.data.type, p_subject_reference_hash: createHash("sha256").update(`${input.data.org}:${input.data.subject}`).digest("hex"), p_verification_level: input.data.verification, p_locale: `${locale}-MA`, p_sla_days: input.data.days, p_correlation_id: correlation.data };
  } else if (intent === "transition") {
    const input = z.object({ id: z.string().uuid(), version: z.coerce.number().int().positive(), status: z.enum(["IDENTITY_PENDING", "IDENTITY_VERIFIED", "IN_REVIEW", "FULFILLED", "REJECTED", "COMPLETED", "CANCELLED"]), reason: z.string().min(3).max(100), reference: z.string().max(500).refine((v) => !v || (!v.includes("..") && !v.includes("://") && !v.startsWith("/"))) }).safeParse({ id: text(form, "requestId"), version: text(form, "rowVersion"), status: text(form, "newStatus"), reason: text(form, "reason"), reference: text(form, "exportReference") });
    if (!input.success) return { status: "error", message: "VALIDATION" };
    rpc = "transition_data_subject_request";
    args = { p_request_id: input.data.id, p_expected_version: input.data.version, p_new_status: input.data.status, p_decision_reason_code: input.data.reason, p_export_storage_reference: input.data.reference || null, p_correlation_id: correlation.data };
  } else if (intent === "retention") {
    const input = z.object({ policy: z.string().uuid(), subject: z.string().min(3).max(300), org: z.string().uuid(), action: z.enum(["ANONYMIZE", "PURGE", "LEGAL_ARCHIVE"]) }).safeParse({ policy: text(form, "policyId"), subject: text(form, "subjectReference"), org: text(form, "organizationId"), action: text(form, "disposition") });
    if (!input.success) return { status: "error", message: "VALIDATION" };
    const policy = await client.from("retention_policies").select("organization_id,disposition").eq("id", input.data.policy).eq("organization_id", input.data.org).maybeSingle();
    if (policy.error || !policy.data || policy.data.disposition !== input.data.action) return { status: "error", message: "FORBIDDEN" };
    rpc = "request_privacy_retention_action";
    args = { p_policy_id: input.data.policy, p_subject_reference_hash: createHash("sha256").update(`${input.data.org}:${input.data.subject}`).digest("hex"), p_action_type: input.data.action, p_idempotency_key: correlation.data, p_correlation_id: correlation.data };
  } else if (intent === "gate") {
    const id = z.string().uuid().safeParse(text(form, "organizationId"));
    if (!id.success) return { status: "error", message: "VALIDATION" };
    rpc = "assert_privacy_production_ready"; args = { p_organization_id: id.data };
  } else return { status: "error", message: "VALIDATION" };
  const response = await client.rpc(rpc, args);
  if (response.error) return { status: "error", message: response.error.code === "42501" ? "FORBIDDEN" : response.error.code === "40001" ? "CONFLICT" : response.error.code === "55000" ? "BLOCKED" : "FAILED" };
  revalidatePath(`/${locale}/administration/confidentialite`);
  return { status: "success", message: intent === "gate" ? "GATE_CHECKED" : intent === "retention" ? "RETENTION_REQUESTED" : "RECORDED" };
}

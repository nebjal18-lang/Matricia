"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
export type HumanAssistanceState = { status: "idle" } | { status: "success"; id: string } | { status: "error"; reason: "VALIDATION" | "FORBIDDEN" | "CONFLICT" | "UNAVAILABLE" };
const request = z.object({ locale: z.enum(["fr", "ar"]), organizationId: z.string().uuid(), requestId: z.union([z.string().uuid(), z.literal("")]), subject: z.string().trim().min(3).max(200), body: z.string().trim().min(10).max(10000), version: z.coerce.number().int().nonnegative(), key: z.string().min(8).max(200), intent: z.enum(["save", "submit"]) });
function failure(code: string | undefined): HumanAssistanceState { return { status: "error", reason: code === "42501" ? "FORBIDDEN" : code === "40001" || code === "22000" ? "CONFLICT" : "UNAVAILABLE" }; }
export async function saveHumanAssistance(_: HumanAssistanceState, form: FormData): Promise<HumanAssistanceState> {
  const parsed = request.safeParse(Object.fromEntries(form));
  const documents = z.array(z.string().uuid()).max(10).safeParse(form.getAll("documents"));
  if (!parsed.success || !documents.success || (parsed.data.intent === "submit" && form.get("consent") !== "on")) return { status: "error", reason: "VALIDATION" };
  const v = parsed.data;
  const client = await getSupabaseServerClient();
  if (!(await client.auth.getUser()).data.user) return { status: "error", reason: "FORBIDDEN" };
  const { data, error } = await client.rpc("save_client_assistance", { p_request_id: v.requestId || null, p_organization_id: v.organizationId, p_subject: v.subject, p_body: v.body, p_document_ids: documents.data, p_submit: v.intent === "submit", p_consent: form.get("consent") === "on", p_expected_version: v.version, p_idempotency_key: v.key, p_correlation_id: randomUUID() });
  if (error) return failure(error.code);
  const result = z.object({ id: z.string().uuid() }).passthrough().safeParse(data);
  if (!result.success) return { status: "error", reason: "UNAVAILABLE" };
  revalidatePath(`/${v.locale}/client/diagnostics/assistance`);
  return { status: "success", id: result.data.id };
}
export async function replyHumanAssistance(_: HumanAssistanceState, form: FormData): Promise<HumanAssistanceState> {
  const p = z.object({ locale: z.enum(["fr", "ar"]), requestId: z.string().uuid(), body: z.string().trim().min(1).max(10000), key: z.string().min(8).max(200) }).safeParse(Object.fromEntries(form));
  if (!p.success) return { status: "error", reason: "VALIDATION" };
  const v = p.data;
  const { error } = await (await getSupabaseServerClient()).rpc("reply_client_assistance", { p_request_id: v.requestId, p_body: v.body, p_close: false, p_idempotency_key: v.key, p_correlation_id: randomUUID() });
  if (error) return failure(error.code);
  revalidatePath(`/${v.locale}/client/diagnostics/assistance`);
  return { status: "success", id: v.requestId };
}

export async function withdrawHumanAssistance(_: HumanAssistanceState, form: FormData): Promise<HumanAssistanceState> {
  const parsed = z.object({ locale: z.enum(["fr","ar"]), requestId: z.string().uuid(), version: z.coerce.number().int().positive(), key: z.string().uuid(), confirmed: z.literal("on") }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const value = parsed.data;
  const { error } = await (await getSupabaseServerClient()).rpc("withdraw_client_assistance_consent", { p_request_id: value.requestId, p_expected_version: value.version, p_idempotency_key: value.key, p_correlation_id: randomUUID() });
  if (error) return failure(error.code);
  revalidatePath(`/${value.locale}/client/diagnostics/assistance`);
  return { status: "success", id: value.requestId };
}

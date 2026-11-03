"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
import type {EditorialState} from "./model";
export async function manageEditorialReview(_: EditorialState, form: FormData): Promise<EditorialState> {
  const t = (key: string) => String(form.get(key) ?? "").trim();
  const common = z.object({locale: z.enum(["fr", "ar"]), key: z.string().uuid(), rowVersion: z.coerce.number().int().positive()}).safeParse({locale: t("locale"), key: t("idempotencyKey"), rowVersion: t("rowVersion")});
  if (!common.success) return {status: "error", reason: "VALIDATION"};
  let rpc: string, args: Record<string, unknown>;
  if (t("intent") === "schedule") {
    const value = z.object({id: z.string().uuid(), hash: z.string().regex(/^[a-f0-9]{64}$/u), from: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u), until: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u).or(z.literal("")), confirmed: z.literal("on")}).safeParse({id: t("releaseId"), hash: t("snapshotHash"), from: t("effectiveFrom"), until: t("effectiveUntil"), confirmed: t("scheduleConfirmed")});
    if (!value.success) return {status: "error", reason: "VALIDATION"};
    const from = new Date(`${value.data.from}:00Z`), until = value.data.until ? new Date(`${value.data.until}:00Z`) : null;
    if (!Number.isFinite(from.getTime()) || from.toISOString().slice(0,16) !== value.data.from || (until && (!Number.isFinite(until.getTime()) || until.toISOString().slice(0,16) !== value.data.until || until <= from))) return {status: "error", reason: "VALIDATION"};
    rpc = "schedule_reviewed_catalog_release";
    args = {p_release_id: value.data.id, p_expected_row_version: common.data.rowVersion, p_expected_snapshot_hash: value.data.hash, p_effective_from: from.toISOString(), p_effective_until: until?.toISOString() ?? null, p_idempotency_key: common.data.key};
  } else {
    const value = z.object({id: z.string().uuid(), decision: z.enum(["APPROVE", "REJECT"]), reason: z.string().min(10).max(2000)}).safeParse({id: t("requestId"), decision: t("intent"), reason: t("reason")});
    const confirmed = t("reviewConfirmed") === "on";
    if (!value.success || (value.data.decision === "APPROVE" && !confirmed)) return {status: "error", reason: "VALIDATION"};
    rpc = "decide_catalog_editorial_review";
    args = {p_change_request_id: value.data.id, p_decision: value.data.decision, p_reason: value.data.reason, p_expected_row_version: common.data.rowVersion, p_translation_confirmed: confirmed, p_idempotency_key: common.data.key};
  }
  const client = await getSupabaseServerClient();
  const {data: auth} = await client.auth.getUser();
  if (!auth.user) return {status: "error", reason: "FORBIDDEN"};
  const result = await client.rpc(rpc, args);
  if (result.error) return {status: "error", reason: result.error.code === "40001" || result.error.code === "55000" ? "STALE" : result.error.code === "42501" ? "FORBIDDEN" : "FAILED"};
  const parsed = rpc === "schedule_reviewed_catalog_release" ? z.object({outcome: z.literal("CATALOG_RELEASE_SCHEDULED")}).safeParse(result.data) : z.object({outcome: z.enum(["CATALOG_CHANGE_APPROVED", "CATALOG_CHANGE_REJECTED"]), reviewProofHash: z.string().regex(/^[a-f0-9]{64}$/u)}).safeParse(result.data);
  if (!parsed.success) return {status: "error", reason: "FAILED"};
  revalidatePath(`/${common.data.locale}/administration/catalogue/revues`);
  return {status: "success", reason: parsed.data.outcome, proofHash: "reviewProofHash" in parsed.data ? parsed.data.reviewProofHash : undefined};
}

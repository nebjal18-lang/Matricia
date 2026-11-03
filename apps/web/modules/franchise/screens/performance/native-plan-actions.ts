"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
export type NativePlanActionState = { status: "idle" } | { status: "success" } | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "MFA_REQUIRED" | "CONFLICT" | "FORBIDDEN" | "QUERY_FAILED" };
export async function recordNativePlanProgress(_: NativePlanActionState, form: FormData): Promise<NativePlanActionState> {
  const p = z.object({ locale: z.enum(["fr", "ar"]), planId: z.string().uuid(), kind: z.enum(["COMMENT", "PROGRESS", "APPROVED", "REJECTED", "COMPLETED"]), comment: z.string().trim().min(3).max(2000), progress: z.coerce.number().int().min(0).max(100).nullable(), key: z.string().uuid() }).safeParse({ locale: form.get("locale"), planId: form.get("planId"), kind: form.get("kind"), comment: form.get("comment"), progress: form.get("kind") === "PROGRESS" ? form.get("progress") : null, key: form.get("idempotencyKey") });
  if (!p.success || !isLocale(p.data.locale)) return { status: "error", reason: "VALIDATION" };
  const client = await getSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  const failure = classifyAuthReadFailure(error);
  if (failure) return { status: "error", reason: failure === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "QUERY_FAILED" };
  if (!data.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const response = await client.rpc("record_franchise_control_plan_event_v1", { p_plan_id: p.data.planId, p_kind: p.data.kind, p_comment: p.data.comment, p_progress_percent: p.data.progress, p_idempotency_key: p.data.key });
  if (response.error) {
    if (response.error.code === "42501") return { status: "error", reason: /AAL2|MFA/.test(response.error.message ?? "") ? "MFA_REQUIRED" : "FORBIDDEN" };
    if (response.error.code === "23514") return { status: "error", reason: "CONFLICT" };
    return { status: "error", reason: "QUERY_FAILED" };
  }
  if (!z.object({ outcome: z.literal("FRANCHISE_CONTROL_PLAN_EVENT_RECORDED") }).safeParse(response.data).success) return { status: "error", reason: "QUERY_FAILED" };
  revalidatePath("/[locale]/administration/gouvernance-franchise/plans/[planId]/responsable", "page");
  revalidatePath(`/${p.data.locale}/franchise/performance`);
  return { status: "success" };
}

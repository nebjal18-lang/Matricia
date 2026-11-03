"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { classifyCommandFailure, type CommandFailureReason } from "@/modules/shared/lib/auth/command-failure";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { planOwnerContextSchema, type PlanOwnerContext } from "@/modules/franchise/data/performance/owner-context";
export type NativeOwnerActionState = { status: "idle" } | { status: "success" } | { status: "error"; reason: CommandFailureReason };
export type NativeOwnerSearchState = { status: "idle" } | { status: "success"; context: PlanOwnerContext } | { status: "error"; reason: CommandFailureReason };
async function actor(): Promise<{ error: CommandFailureReason } | { client: Awaited<ReturnType<typeof getSupabaseServerClient>> }> {
  const client = await getSupabaseServerClient(); const auth = await client.auth.getUser(); const failure = classifyAuthReadFailure(auth.error);
  if (failure || !auth.data.user) return { error: (failure === "UNAVAILABLE" ? "FAILED" : "UNAUTHENTICATED") as CommandFailureReason };
  return { client };
}
export async function proposeNativePlanOwner(_: NativeOwnerActionState, form: FormData): Promise<NativeOwnerActionState> {
  const p = z.object({ locale: z.enum(["fr", "ar"]), planId: z.string().uuid(), ownerUserId: z.string().uuid(), version: z.coerce.number().int().min(0).max(1_000_000), reason: z.string().trim().min(10).max(2000), key: z.string().uuid() }).safeParse({ locale: form.get("locale"), planId: form.get("planId"), ownerUserId: form.get("ownerUserId"), version: form.get("version"), reason: form.get("reason"), key: form.get("idempotencyKey") });
  if (!p.success) return { status: "error", reason: "VALIDATION" };
  const access = await actor(); if ("error" in access) return { status: "error", reason: access.error };
  const response = await access.client.rpc("propose_franchise_control_owner_v1", { p_plan_id: p.data.planId, p_owner_user_id: p.data.ownerUserId, p_expected_version: p.data.version, p_reason: p.data.reason, p_idempotency_key: p.data.key });
  if (response.error) return { status: "error", reason: classifyCommandFailure(response.error) };
  if (!z.object({ outcome: z.literal("FRANCHISE_CONTROL_OWNER_PROPOSED"), requestId: z.string().uuid() }).safeParse(response.data).success) return { status: "error", reason: "FAILED" };
  revalidatePath("/[locale]/administration/gouvernance-franchise/plans/[planId]/responsable", "page"); revalidatePath("/fr/franchise/performance"); revalidatePath("/ar/franchise/performance"); return { status: "success" };
}
export async function reviewNativePlanOwner(_: NativeOwnerActionState, form: FormData): Promise<NativeOwnerActionState> {
  const p = z.object({ locale: z.enum(["fr", "ar"]), requestId: z.string().uuid(), decision: z.enum(["APPROVE", "REJECT"]), reason: z.string().trim().min(10).max(2000), key: z.string().uuid() }).safeParse({ locale: form.get("locale"), requestId: form.get("requestId"), decision: form.get("decision"), reason: form.get("reason"), key: form.get("idempotencyKey") });
  if (!p.success) return { status: "error", reason: "VALIDATION" };
  const access = await actor(); if ("error" in access) return { status: "error", reason: access.error };
  const response = await access.client.rpc("review_franchise_control_owner_v1", { p_request_id: p.data.requestId, p_decision: p.data.decision, p_reason: p.data.reason, p_idempotency_key: p.data.key });
  if (response.error) return { status: "error", reason: classifyCommandFailure(response.error) };
  if (!z.object({ outcome: z.literal("FRANCHISE_CONTROL_OWNER_REVIEWED"), requestId: z.string().uuid() }).safeParse(response.data).success) return { status: "error", reason: "FAILED" };
  revalidatePath("/[locale]/administration/gouvernance-franchise/plans/[planId]/responsable", "page"); revalidatePath("/fr/franchise/performance"); revalidatePath("/ar/franchise/performance"); return { status: "success" };
}
export async function searchNativePlanOwners(_: NativeOwnerSearchState, form: FormData): Promise<NativeOwnerSearchState> {
  const p = z.object({ planId: z.string().uuid(), query: z.string().trim().max(120), before: z.string().datetime({ offset: true }).optional(), beforeId: z.string().uuid().optional() }).safeParse({ planId: form.get("planId"), query: form.get("q") ?? "", before: form.get("before") ?? undefined, beforeId: form.get("beforeId") ?? undefined });
  if (!p.success) return { status: "error", reason: "VALIDATION" };
  const access = await actor(); if ("error" in access) return { status: "error", reason: access.error };
  const response = await access.client.rpc("get_franchise_control_owner_context_v1", { p_plan_id: p.data.planId, p_member_search: p.data.query, p_before_request_at: p.data.before ?? null, p_before_request_id: p.data.beforeId ?? null });
  if (response.error) return { status: "error", reason: classifyCommandFailure(response.error) };
  const parsed = planOwnerContextSchema.safeParse(response.data);
  return parsed.success ? { status: "success", context: parsed.data } : { status: "error", reason: "FAILED" };
}

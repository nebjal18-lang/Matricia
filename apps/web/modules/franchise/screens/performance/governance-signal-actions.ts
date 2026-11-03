"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { classifyCommandFailure, type CommandFailureReason } from "@/modules/shared/lib/auth/command-failure";
import { governanceInspectionSchema, sourceKinds, type GovernanceInspection } from "@/modules/franchise/data/governance-signals/inspection";
export type GovernanceInspectionState = { status: "idle" } | { status: "success"; inspection: GovernanceInspection; purpose: string; sourceKind: (typeof sourceKinds)[number] } | { status: "error"; reason: CommandFailureReason };
export type GovernanceSignalActionState = { status: "idle" } | { status: "success"; requestId: string } | { status: "error"; reason: CommandFailureReason };
async function run(form: FormData, kind: "request" | "propose" | "approve"): Promise<GovernanceSignalActionState> {
  const values = z.object({ locale: z.enum(["fr", "ar"]), objectId: z.string().uuid(), reason: z.string().trim().min(10).max(2000), key: z.string().uuid(), outcome: kind === "propose" ? z.enum(["OBSERVATION_ONLY", "FURTHER_REVIEW_REQUIRED"]) : kind === "approve" ? z.enum(["APPROVE", "REJECT"]) : z.literal("") }).safeParse({ locale: form.get("locale"), objectId: form.get("objectId"), reason: form.get("reason"), key: form.get("idempotencyKey"), outcome: kind === "request" ? "" : form.get("outcome") });
  if (!values.success) return { status: "error", reason: "VALIDATION" };
  const client = await getSupabaseServerClient(); const auth = await client.auth.getUser(); const failure = classifyAuthReadFailure(auth.error);
  if (failure) return { status: "error", reason: failure === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "FAILED" };
  if (!auth.data.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const p = values.data;
  const response = kind === "request" ? await client.rpc("request_franchise_governance_review_v1", { p_snapshot_id: p.objectId, p_reason: p.reason, p_idempotency_key: p.key }) : kind === "propose" ? await client.rpc("propose_franchise_governance_review_v1", { p_request_id: p.objectId, p_outcome: p.outcome, p_reason: p.reason, p_idempotency_key: p.key }) : await client.rpc("approve_franchise_governance_review_v1", { p_proposal_id: p.objectId, p_decision: p.outcome, p_reason: p.reason, p_idempotency_key: p.key });
  if (response.error) return { status: "error", reason: classifyCommandFailure(response.error) };
  const parsed = z.object({ outcome: z.literal(kind === "request" ? "MATRICIA_REVIEW_REQUIRED" : kind === "propose" ? "FRANCHISE_GOVERNANCE_REVIEW_PROPOSED" : "FRANCHISE_GOVERNANCE_REVIEW_DECIDED"), requestId: z.string().uuid() }).safeParse(response.data);
  if (!parsed.success) return { status: "error", reason: "FAILED" };
  revalidatePath(`/${p.locale}/franchise/performance`); revalidatePath(`/${p.locale}/administration/gouvernance-franchise/signalements/${parsed.data.requestId}`);
  return { status: "success", requestId: parsed.data.requestId };
}
export async function requestGovernanceReview(_: GovernanceSignalActionState, form: FormData) { return run(form, "request"); }
export async function proposeGovernanceReview(_: GovernanceSignalActionState, form: FormData) { return run(form, "propose"); }
export async function approveGovernanceReview(_: GovernanceSignalActionState, form: FormData) { return run(form, "approve"); }

export async function inspectGovernanceSources(_: GovernanceInspectionState, form: FormData): Promise<GovernanceInspectionState> {
  const parsed = z.object({ requestId: z.string().uuid(), sourceKind: z.enum(sourceKinds), purpose: z.string().trim().min(10).max(1000), after: z.string().max(200).nullable() }).safeParse({ requestId: form.get("requestId"), sourceKind: form.get("sourceKind"), purpose: form.get("purpose"), after: form.get("after") || null });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const client = await getSupabaseServerClient(); const auth = await client.auth.getUser(); const failure = classifyAuthReadFailure(auth.error);
  if (failure || !auth.data.user) return { status: "error", reason: failure === "UNAVAILABLE" ? "FAILED" : "UNAUTHENTICATED" };
  const p = parsed.data;
  const response = await client.rpc("inspect_franchise_governance_review_v1", { p_request_id: p.requestId, p_source_kind: p.sourceKind, p_after_source_id: p.after, p_limit: 25, p_purpose: p.purpose });
  if (response.error) return { status: "error", reason: classifyCommandFailure(response.error) };
  const data = governanceInspectionSchema.safeParse(response.data);
  if (!data.success || data.data.request.id !== p.requestId || data.data.request.snapshot_id !== data.data.snapshot.id || data.data.request.franchise_id !== data.data.snapshot.franchise_id) return { status: "error", reason: "FAILED" };
  return { status: "success", inspection: data.data, purpose: p.purpose, sourceKind: p.sourceKind };
}

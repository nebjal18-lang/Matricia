import { z } from "zod";
import { planOwnerContextSchema } from "./owner-context";
import { unstable_rethrow } from "next/navigation";
import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
export const franchiseAxes = ["CLIENT_NETWORK", "LIBRARY_QUALITY", "PROVIDER_NETWORK", "DELIVERY_PERFORMANCE", "CLIENT_SATISFACTION", "COMPLIANCE_FINANCE"] as const;
const basisPoints = z.number().int().min(0).max(10000).nullable();
export const nativeReportSchema = z.object({
  id: z.string().uuid(), franchise_id: z.string().uuid(), model_id: z.string().uuid(), kind: z.enum(["DAILY", "MONTHLY", "QUARTERLY"]),
  period_start: z.string().date(), period_end: z.string().date(), completeness: z.enum(["COMPLETE", "PARTIAL"]), global_score_bps: basisPoints,
  axis_scores: z.object(Object.fromEntries(franchiseAxes.map(axis => [axis, basisPoints])) as Record<(typeof franchiseAxes)[number], typeof basisPoints>),
  metrics: z.record(z.string(), z.unknown()), methodology: z.object({ version: z.literal("NATIVE_FRANCHISE_CONTROL_V1"), modelVersion: z.number().int().positive(), axisWeights: z.record(z.string(), z.number().int().positive()), collectedAt: z.string(), manualSnapshotsConsumed: z.literal(false), noAutomaticSanctions: z.literal(true), alerts: z.array(z.object({ axis: z.enum(franchiseAxes), scoreBps: z.number().int().min(0).max(10000), thresholdBps: z.number().int().min(0).max(10000), severity: z.enum(["WARNING", "CRITICAL"]) })) }).passthrough(),
  comparison: z.object({ status: z.enum(["AVAILABLE", "INSUFFICIENT_COHORT"]), cohortSize: z.number().int().min(5).optional(), medianScoreBps: z.number().int().nullable().optional() }).passthrough(),
  previous_report_id: z.string().uuid().nullable(), source_evidence_hash: z.string().regex(/^[a-f0-9]{64}$/), generated_at: z.string(),
}).refine(report => (report.completeness === "COMPLETE") === (report.global_score_bps !== null) && (report.global_score_bps !== null) === franchiseAxes.every(axis => report.axis_scores[axis] !== null));
const planEvent = z.object({ id: z.union([z.number().int(), z.string().regex(/^\d+$/)]), kind: z.enum(["COMMENT", "PROGRESS", "APPROVED", "REJECTED", "COMPLETED"]), comment: z.string(), progress_percent: z.number().int().nullable(), created_at: z.string() });
const planSchema = z.object({ id: z.string().uuid(), franchise_id: z.string().uuid(), report_id: z.string().uuid(), due_on: z.string().date(), origin: z.literal("SYSTEM_PROPOSAL"), suggested_owner_user_id: z.string().uuid().nullable(), objectives: z.array(z.object({ axis: z.enum(franchiseAxes), observedScoreBps: z.number().int(), targetScoreBps: z.number().int(), completionCriterion: z.literal("REMEASURE_NATIVE_SOURCE_AT_OR_ABOVE_TARGET") })), ownerContext: planOwnerContextSchema, events: z.array(planEvent).max(50), eventCount: z.number().int().nonnegative(), nextEventAfter: z.string().regex(/^\d{1,19}$/).nullable() });
const cursorSchema = z.object({ before: z.string().datetime({ offset: true }), id: z.string().uuid() });
const responseSchema = z.object({ capabilities: z.object({ canWrite: z.boolean(), canDecide: z.boolean() }), franchiseId: z.string().uuid(), reports: z.array(nativeReportSchema), plans: z.array(planSchema), nextCursor: cursorSchema.nullable() });
export type NativeFranchiseControl = z.infer<typeof responseSchema>;
export type NativeControlResult = { status: "success"; dashboard: NativeFranchiseControl } | { status: "error"; reason: "UNAUTHENTICATED" | "FORBIDDEN" | "QUERY_FAILED" | "INVALID_RESPONSE" | "VALIDATION" };

export async function loadNativeFranchiseControl(franchiseId: string, cursor?: { before?: string; id?: string; eventPlanId?: string; afterEventId?: string }): Promise<NativeControlResult> {
  if (!z.string().uuid().safeParse(franchiseId).success) return { status: "error", reason: "VALIDATION" };
  const parsedCursor = cursor && (cursor.before || cursor.id) ? cursorSchema.safeParse(cursor) : null;
  if (parsedCursor && !parsedCursor.success) return { status: "error", reason: "VALIDATION" };
  const eventsCursor = cursor && (cursor.eventPlanId || cursor.afterEventId) ? z.object({ eventPlanId: z.string().uuid(), afterEventId: z.string().regex(/^\d{1,19}$/).refine(value => BigInt(value) <= BigInt("9223372036854775807")) }).safeParse(cursor) : null;
  if (eventsCursor && !eventsCursor.success) return { status: "error", reason: "VALIDATION" };
  try {
    const client = await getSupabaseServerClient();
    const { data, error } = await client.auth.getUser();
    const failure = classifyAuthReadFailure(error);
    if (failure) return { status: "error", reason: failure === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "QUERY_FAILED" };
    if (!data.user) return { status: "error", reason: "UNAUTHENTICATED" };
    const result = await client.rpc("list_franchise_native_control_v1", { p_franchise_id: franchiseId, p_limit: 20, p_before: parsedCursor?.success ? parsedCursor.data.before : null, p_before_id: parsedCursor?.success ? parsedCursor.data.id : null, p_event_plan_id: eventsCursor?.success ? eventsCursor.data.eventPlanId : null, p_after_event_id: eventsCursor?.success ? eventsCursor.data.afterEventId : null });
    if (result.error) return { status: "error", reason: result.error.code === "42501" ? "FORBIDDEN" : "QUERY_FAILED" };
    const parsed = responseSchema.safeParse(result.data);
    if (!parsed.success || parsed.data.franchiseId !== franchiseId || parsed.data.reports.some(report => report.franchise_id !== franchiseId) || parsed.data.plans.some(plan => plan.franchise_id !== franchiseId)) return { status: "error", reason: "INVALID_RESPONSE" };
    return { status: "success", dashboard: parsed.data };
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", reason: "QUERY_FAILED" };
  }
}

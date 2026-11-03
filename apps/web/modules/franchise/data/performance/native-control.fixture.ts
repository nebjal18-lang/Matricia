import { type NativeFranchiseControl, franchiseAxes } from "./native-control";
export const controlFranchiseId = "d3650000-0000-4000-8000-000000000001";
/** Synthetic structural fixture only; never imported by an application route. */
export function nativeControlFixture() {
  return {
    franchiseId: controlFranchiseId, capabilities: { canWrite: false, canDecide: false },
    reports: [{ id: "a3651000-0000-4000-8000-000000000001", franchise_id: controlFranchiseId, model_id: "f0365000-0000-4000-8000-000000000001", kind: "DAILY" as const, period_start: "2026-11-02", period_end: "2026-11-02", completeness: "PARTIAL" as "PARTIAL" | "COMPLETE", global_score_bps: null as number | null, axis_scores: Object.fromEntries(franchiseAxes.map(axis => [axis, null])) as Record<(typeof franchiseAxes)[number], number | null>, metrics: { servicesTotal: 0 }, methodology: { version: "NATIVE_FRANCHISE_CONTROL_V1" as const, modelVersion: 1, axisWeights: { CLIENT_NETWORK: 2000, LIBRARY_QUALITY: 2000, PROVIDER_NETWORK: 1500, DELIVERY_PERFORMANCE: 2000, CLIENT_SATISFACTION: 1500, COMPLIANCE_FINANCE: 1000 }, collectedAt: "2026-11-03T10:00:00+00:00", manualSnapshotsConsumed: false as const, noAutomaticSanctions: true as const, alerts: [] as NativeFranchiseControl["reports"][number]["methodology"]["alerts"] }, comparison: { status: "INSUFFICIENT_COHORT" as const }, previous_report_id: null, source_evidence_hash: "a".repeat(64), generated_at: "2026-11-03T10:00:00+00:00" }], plans: [] as NativeFranchiseControl["plans"], nextCursor: null,
  };
}

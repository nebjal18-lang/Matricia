import { z } from "zod";
const id = z.string().uuid();
const count = z.number().int().nonnegative();
export const governanceSignalSchema = z.object({
  id, report_id: id, franchise_id: id, period_start: z.string().date(), period_end: z.string().date(), collected_at: z.string(), source_evidence_hash: z.string().regex(/^[a-f0-9]{64}$/), methodology_version: z.literal("NATIVE_GOVERNANCE_SIGNALS_V1"),
  summary: z.object({ scope: z.literal("MANDATED_LIBRARY_AGGREGATE_NO_TERRITORY_ATTRIBUTION"), missionCount: count, assignedProviderCount: count, largestProviderShareBps: count.max(10000).nullable(), matchingRunCount: count, requestsWithSeveralRuns: count, governedPanelProposalCount: count, panelInvitationCount: count, panelDistinctProviders: count.nullable(), previousPanelDistinctProviders: count.nullable(), panelDiversityDelta: z.number().int().nullable(), qualificationShortestSeconds: z.number().nullable(), catalogReviewShortestSeconds: z.number().nullable(), thresholdConfiguration: z.literal("APPROVED_THRESHOLDS_NOT_PROVIDED"), riskVerdict: z.null(), noFaultAsserted: z.literal(true) }),
});
const available = z.object({ status: z.literal("AVAILABLE"), franchiseId: id, snapshot: governanceSignalSchema, benchmark: z.object({ status: z.enum(["ADMIN_ONLY", "AVAILABLE", "INSUFFICIENT_COHORT"]), cohortSize: z.number().int().min(5).optional(), medianLargestShareBps: count.max(10000).nullable().optional() }).refine(value => value.status !== "AVAILABLE" || value.cohortSize !== undefined), capabilities: z.object({ canRequestReview: z.boolean(), canInspect: z.boolean(), requestRestriction: z.enum(["ROLE_REQUIRED", "MFA_REQUIRED"]).nullable() }), reviewCount: count, reviews: z.array(z.object({ id, createdAt: z.string(), status: z.enum(["HUMAN_REVIEW_RECORDED", "MATRICIA_REVIEW_REQUIRED"]) })).max(25) });
export const signalResult = z.union([available, z.object({ status: z.literal("NOT_AVAILABLE"), franchiseId: id })]);
export type GovernanceSignals = z.infer<typeof available>;
export type GovernanceSignalResult = z.infer<typeof signalResult> | { status: "error"; reason: "QUERY_FAILED" | "INVALID_RESPONSE" | "FORBIDDEN" | "UNAUTHENTICATED" };

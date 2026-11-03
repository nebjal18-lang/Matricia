import { z } from "zod";
import { governanceSignalSchema } from "./model";
export const sourceKinds = ["MISSION", "MATCHING_RUN", "PANEL_PROPOSAL", "PANEL_INVITATION", "PREVIOUS_PANEL_INVITATION", "QUALIFICATION_DECISION", "CATALOG_REVIEW", "CONFLICT_DISCLOSURE", "REASSIGNMENT"] as const;
const id = z.string().uuid();
export const governanceInspectionSchema = z.object({
  request: z.object({ id, snapshot_id: id, franchise_id: id, reason: z.string(), origin: z.enum(["SYSTEM_FACT", "MEMBER_REQUEST"]), created_at: z.string() }), snapshot: governanceSignalSchema,
  sources: z.array(z.object({ sourceId: z.string().max(200), evidence: z.record(z.string(), z.unknown()), evidenceHash: z.string().regex(/^[a-f0-9]{64}$/) })).max(50), nextAfter: z.string().max(200).nullable(), canPropose: z.boolean(),
  proposals: z.array(z.object({ id, outcome: z.enum(["OBSERVATION_ONLY", "FURTHER_REVIEW_REQUIRED"]), reason: z.string(), proposed_at: z.string(), canApprove: z.boolean(), approval: z.object({ decision: z.enum(["APPROVE", "REJECT"]), reason: z.string() }).nullable() })),
});
export type GovernanceInspection = z.infer<typeof governanceInspectionSchema>;

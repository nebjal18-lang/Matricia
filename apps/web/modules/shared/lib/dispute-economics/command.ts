import { unstable_rethrow } from "next/navigation";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { loadDisputeDecisionContext } from "./server";

export async function executeDisputeDecision(input: { caseId: string; outcome: string; reason: string; evidenceIds: string[]; idempotencyKey: string }): Promise<{ status: "success" } | { status: "error"; reason: string }> {
  try { return await execute(input); } catch (error) { unstable_rethrow(error); return { status: "error", reason: "UNAVAILABLE" }; }
}
async function execute(input: { caseId: string; outcome: string; reason: string; evidenceIds: string[]; idempotencyKey: string }): Promise<{ status: "success" } | { status: "error"; reason: string }> {
  const context = await loadDisputeDecisionContext(input.caseId);
  if (context.status === "error") return { status: "error", reason: context.reason };
  if (!context.authorized) return { status: "error", reason: "FORBIDDEN" };
  // Eligibility is enforced transactionally by SQL after its idempotent receipt
  // lookup, so a confirmed decision can be safely replayed after CLOSED.
  const rule = input.outcome === "NON_COMPLIANT_CONFIRMED" ? {} : context.policy;
  if (!rule) return { status: "error", reason: "POLICY_UNAVAILABLE" };
  const client = await getSupabaseServerClient();
  const result = await client.rpc("decide_mission_dispute", {
    p_dispute_case_id: input.caseId, p_outcome: input.outcome, p_reason: input.reason,
    p_evidence_ids: input.evidenceIds, p_rule_snapshot: rule,
    p_idempotency_key: input.idempotencyKey, p_correlation_id: randomUUID(),
  });
  if (result.error) return { status: "error", reason: result.error.code === "42501" ? "FORBIDDEN" : result.error.code === "40001" ? "STALE_STATE" : "UNAVAILABLE" };
  const receipt = z.object({ dispute_case_id: z.literal(input.caseId), decision_id: z.string().uuid(), outcome: z.literal(input.outcome), decision_number: z.number().int().positive() }).safeParse(result.data);
  return receipt.success ? { status: "success" } : { status: "error", reason: "UNAVAILABLE" };
}

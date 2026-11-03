import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ context: vi.fn(), rpc: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("./server", () => ({ loadDisputeDecisionContext: mocks.context }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ rpc: mocks.rpc }) }));
import { executeDisputeDecision } from "./command";
import { caseId, evidenceId, context } from "./fixtures.test-support";
const input = { caseId, outcome: "NON_COMPLIANT_CONFIRMED", reason: "Motif de décision conservé.", evidenceIds: [evidenceId], idempotencyKey: evidenceId };
beforeEach(() => { vi.resetAllMocks(); mocks.context.mockResolvedValue(context); mocks.rpc.mockResolvedValue({ data: { dispute_case_id: caseId, decision_id: evidenceId, outcome: input.outcome, decision_number: 1 }, error: null }); });
describe("independent economic decision command", () => {
  it("sends no caller money, hash or validation boolean for noncompliance", async () => { expect(await executeDisputeDecision(input)).toEqual({ status: "success" }); expect(mocks.rpc.mock.calls[0]?.[1].p_rule_snapshot).toEqual({}); });
  it("uses the frozen case policy for nonfinancial decisions", async () => { mocks.rpc.mockResolvedValue({ data: { dispute_case_id: caseId, decision_id: evidenceId, outcome: "COMPLIANT", decision_number: 1 }, error: null }); expect(await executeDisputeDecision({ ...input, outcome: "COMPLIANT" })).toEqual({ status: "success" }); expect(mocks.rpc.mock.calls[0]?.[1].p_rule_snapshot).toEqual(context.policy); });
  it("does not block the nonfinancial workflow when a signed economic rule is absent", async () => { mocks.context.mockResolvedValue({ ...context, economics: { ...context.economics, rule: null, economic_status: "APPROVED_SIGNED_ECONOMIC_RULE_REQUIRED" } }); expect(await executeDisputeDecision(input)).toEqual({ status: "success" }); });
  it.each(["PARTY_MEMBER", "READ_ONLY"])("rejects %s before any mutation", async restriction => { mocks.context.mockResolvedValue({ ...context, authorized: false, canDecide: false, restriction }); expect(await executeDisputeDecision(input)).toEqual({ status: "error", reason: "FORBIDDEN" }); expect(mocks.rpc).not.toHaveBeenCalled(); });
  it("lets SQL replay the immutable receipt after CLOSED", async () => { mocks.context.mockResolvedValue({ ...context, canDecide: false, restriction: "STATE" }); expect(await executeDisputeDecision(input)).toEqual({ status: "success" }); });
  it("refuses a missing nonfinancial policy instead of hashing the reason", async () => { mocks.context.mockResolvedValue({ ...context, policy: null }); expect(await executeDisputeDecision({ ...input, outcome: "COMPLIANT" })).toEqual({ status: "error", reason: "POLICY_UNAVAILABLE" }); expect(mocks.rpc).not.toHaveBeenCalled(); });
  it.each([{ data: {}, error: null }, { data: { dispute_case_id: caseId, outcome: input.outcome }, error: null }, { data: null, error: { code: "503" } }])("never reports a missing or failed receipt as success", async result => { mocks.rpc.mockResolvedValue(result); expect(await executeDisputeDecision(input)).toEqual({ status: "error", reason: "UNAVAILABLE" }); });
});

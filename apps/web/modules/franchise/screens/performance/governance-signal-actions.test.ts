import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestGovernanceReview, proposeGovernanceReview, approveGovernanceReview, inspectGovernanceSources } from "./governance-signal-actions";
import { governanceSignalFixture } from "@/modules/franchise/data/governance-signals/fixture";
const m = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ auth: { getUser: m.auth }, rpc: m.rpc }) }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
const id = governanceSignalFixture().snapshot.id;
function form() { const f = new FormData(); Object.entries({ locale: "ar", objectId: id, requestId: id, reason: "Texte libre français de revue conservé", idempotencyKey: id, outcome: "OBSERVATION_ONLY", sourceKind: "CONFLICT_DISCLOSURE", purpose: "Inspection indépendante pour contrôle de la source" }).forEach(([k, v]) => f.set(k, v)); return f; }
beforeEach(() => { vi.clearAllMocks(); m.auth.mockResolvedValue({ data: { user: { id: "member" } }, error: null }); m.rpc.mockResolvedValue({ data: { outcome: "MATRICIA_REVIEW_REQUIRED", requestId: id }, error: null }); });
describe("native governance review commands", () => {
  it("requests an examination of the frozen source snapshot with an unchanged free-text reason", async () => {
    expect(await requestGovernanceReview({ status: "idle" }, form())).toEqual({ status: "success", requestId: id });
    expect(m.rpc).toHaveBeenCalledWith("request_franchise_governance_review_v1", { p_snapshot_id: id, p_reason: "Texte libre français de revue conservé", p_idempotency_key: id });
  });
  it("does not send a write or private inspection during an Auth outage even if a cached user exists", async () => {
    m.auth.mockResolvedValue({ data: { user: { id: "cached" } }, error: { status: 503 } }); expect(await requestGovernanceReview({ status: "idle" }, form())).toEqual({ status: "error", reason: "FAILED" }); expect(await inspectGovernanceSources({ status: "idle" }, form())).toEqual({ status: "error", reason: "FAILED" }); expect(m.rpc).not.toHaveBeenCalled();
  });
  it.each([["FRANCHISE_GOVERNANCE_REVIEW_MFA_REQUIRED", "MFA_REQUIRED"], ["FRANCHISE_GOVERNANCE_SECOND_INDEPENDENT_ADMIN_REQUIRED", "FORBIDDEN"]] as const)("keeps %s distinct", async (message, reason) => {
    m.rpc.mockResolvedValue({ data: null, error: { code: "42501", message } }); expect(await requestGovernanceReview({ status: "idle" }, form())).toEqual({ status: "error", reason });
  });
  it("rejects an unexpected command receipt", async () => {
    m.rpc.mockResolvedValue({ data: { success: true }, error: null }); expect(await requestGovernanceReview({ status: "idle" }, form())).toEqual({ status: "error", reason: "FAILED" }); expect(m.revalidate).not.toHaveBeenCalled();
  });
  it("records an independent proposal and approval using separate command contracts", async () => {
    m.rpc.mockResolvedValue({ data: { outcome: "FRANCHISE_GOVERNANCE_REVIEW_PROPOSED", requestId: id }, error: null }); expect((await proposeGovernanceReview({ status: "idle" }, form())).status).toBe("success");
    expect(m.rpc).toHaveBeenCalledWith("propose_franchise_governance_review_v1", expect.objectContaining({ p_request_id: id, p_outcome: "OBSERVATION_ONLY" }));
    m.rpc.mockResolvedValue({ data: { outcome: "FRANCHISE_GOVERNANCE_REVIEW_DECIDED", requestId: id }, error: null }); const f = form(); f.set("outcome", "APPROVE"); expect((await approveGovernanceReview({ status: "idle" }, f)).status).toBe("success"); expect(m.rpc).toHaveBeenCalledWith("approve_franchise_governance_review_v1", expect.objectContaining({ p_proposal_id: id, p_decision: "APPROVE" }));
  });
  it("validates the purpose before a private source RPC and bounds the page", async () => {
    const f = form(); f.set("purpose", "short"); expect(await inspectGovernanceSources({ status: "idle" }, f)).toEqual({ status: "error", reason: "VALIDATION" }); expect(m.rpc).not.toHaveBeenCalled();
    m.rpc.mockResolvedValue({ data: { request: { id, snapshot_id: id, franchise_id: governanceSignalFixture().franchiseId, reason: "PRIVATE_REASON", origin: "SYSTEM_FACT", created_at: "2026-11-03T08:00:00Z" }, snapshot: governanceSignalFixture().snapshot, sources: [], nextAfter: null, canPropose: true, proposals: [] }, error: null });
    const result = await inspectGovernanceSources({ status: "idle" }, form()); expect(result.status).toBe("success"); expect(m.rpc).toHaveBeenCalledWith("inspect_franchise_governance_review_v1", expect.objectContaining({ p_source_kind: "CONFLICT_DISCLOSURE", p_limit: 25, p_purpose: "Inspection indépendante pour contrôle de la source" }));
  });
});

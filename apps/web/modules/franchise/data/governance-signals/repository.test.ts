import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFranchiseGovernanceSignals } from "./repository";
import { governanceSignalFixture } from "./fixture";
const m = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ auth: { getUser: m.auth }, rpc: m.rpc }) }));
const id = governanceSignalFixture().franchiseId;
beforeEach(() => { vi.clearAllMocks(); m.auth.mockResolvedValue({ data: { user: { id: "member" } }, error: null }); m.rpc.mockResolvedValue({ data: governanceSignalFixture(), error: null }); });
describe("native governance signal reads", () => {
  it("loads native data for the exact franchise without an economic attribution", async () => {
    const result = await loadFranchiseGovernanceSignals(id); expect(result.status).toBe("AVAILABLE"); expect(m.rpc).toHaveBeenCalledWith("get_franchise_governance_signals_v1", { p_franchise_id: id, p_report_id: null });
  });
  it("keeps an Auth outage distinct from a missing session", async () => {
    m.auth.mockResolvedValue({ data: { user: { id: "cached" } }, error: { status: 503 } }); expect(await loadFranchiseGovernanceSignals(id)).toEqual({ status: "error", reason: "QUERY_FAILED" }); expect(m.rpc).not.toHaveBeenCalled();
  });
  it("rejects another mandate projection", async () => {
    m.rpc.mockResolvedValue({ data: { ...governanceSignalFixture(), franchiseId: "d3650000-0000-4000-8000-000000000001" }, error: null }); expect(await loadFranchiseGovernanceSignals(id)).toEqual({ status: "error", reason: "INVALID_RESPONSE" });
  });
  it("does not accept a numerical verdict where no threshold is approved", async () => {
    const f = governanceSignalFixture(); m.rpc.mockResolvedValue({ data: { ...f, snapshot: { ...f.snapshot, summary: { ...f.snapshot.summary, riskVerdict: "HIGH" } } }, error: null }); expect(await loadFranchiseGovernanceSignals(id)).toEqual({ status: "error", reason: "INVALID_RESPONSE" });
  });
  it("keeps no report distinct from a technical query failure", async () => {
    m.rpc.mockResolvedValue({ data: { status: "NOT_AVAILABLE", franchiseId: id }, error: null }); expect((await loadFranchiseGovernanceSignals(id)).status).toBe("NOT_AVAILABLE");
    m.rpc.mockResolvedValue({ data: null, error: { code: "42703" } }); expect(await loadFranchiseGovernanceSignals(id)).toEqual({ status: "error", reason: "QUERY_FAILED" });
  });
});

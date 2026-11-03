import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadNativeFranchiseControl } from "./native-control";
import { controlFranchiseId, nativeControlFixture } from "./native-control.fixture";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ auth: { getUser: mocks.auth }, rpc: mocks.rpc }) }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ data: { user: { id: "a3650000-0000-4000-8000-000000000001" } }, error: null }); mocks.rpc.mockResolvedValue({ data: nativeControlFixture(), error: null }); });
describe("native Franchise control read contract", () => {
  it("preserves absent axes and global score as null", async () => {
    const result = await loadNativeFranchiseControl(controlFranchiseId);
    expect(result.status).toBe("success");
    if (result.status === "success") { expect(result.dashboard.reports[0]!.global_score_bps).toBeNull(); expect(result.dashboard.reports[0]!.axis_scores.CLIENT_NETWORK).toBeNull(); }
    expect(mocks.rpc).toHaveBeenCalledWith("list_franchise_native_control_v1", expect.objectContaining({ p_franchise_id: controlFranchiseId, p_limit: 20, p_before: null, p_before_id: null }));
  });
  it("does not query on cached-user Auth outages", async () => {
    mocks.auth.mockResolvedValue({ data: { user: { id: "cached" } }, error: { status: 503 } });
    expect(await loadNativeFranchiseControl(controlFranchiseId)).toEqual({ status: "error", reason: "QUERY_FAILED" }); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("asks for login only for a known invalid session", async () => {
    mocks.auth.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
    expect(await loadNativeFranchiseControl(controlFranchiseId)).toEqual({ status: "error", reason: "UNAUTHENTICATED" }); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("preserves permission denial rather than an empty successful report list", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    expect(await loadNativeFranchiseControl(controlFranchiseId)).toEqual({ status: "error", reason: "FORBIDDEN" });
  });
  it("rejects a response from a different mandate", async () => {
    const fixture = nativeControlFixture(); fixture.reports[0]!.franchise_id = "d3650000-0000-4000-8000-000000000002";
    mocks.rpc.mockResolvedValue({ data: fixture, error: null });
    expect(await loadNativeFranchiseControl(controlFranchiseId)).toEqual({ status: "error", reason: "INVALID_RESPONSE" });
  });
  it("rejects a fabricated complete score with missing observations", async () => {
    const fixture = nativeControlFixture(); fixture.reports[0]!.completeness = "COMPLETE";
    mocks.rpc.mockResolvedValue({ data: fixture, error: null });
    expect(await loadNativeFranchiseControl(controlFranchiseId)).toEqual({ status: "error", reason: "INVALID_RESPONSE" });
  });
  it("rejects a forged global score over absent axes", async () => {
    const fixture = nativeControlFixture(); fixture.reports[0]!.completeness = "COMPLETE"; fixture.reports[0]!.global_score_bps = 0;
    mocks.rpc.mockResolvedValue({ data: fixture, error: null });
    expect(await loadNativeFranchiseControl(controlFranchiseId)).toEqual({ status: "error", reason: "INVALID_RESPONSE" });
  });
  it("requires a complete, typed pagination cursor", async () => {
    expect(await loadNativeFranchiseControl(controlFranchiseId, { before: "2026-11-01T00:00:00Z" })).toEqual({ status: "error", reason: "VALIDATION" }); expect(mocks.rpc).not.toHaveBeenCalled();
    await loadNativeFranchiseControl(controlFranchiseId, { before: "2026-11-01T00:00:00Z", id: "a3651000-0000-4000-8000-000000000001" });
    expect(mocks.rpc).toHaveBeenCalledWith("list_franchise_native_control_v1", expect.objectContaining({ p_before: "2026-11-01T00:00:00Z", p_before_id: "a3651000-0000-4000-8000-000000000001" }));
  });
});

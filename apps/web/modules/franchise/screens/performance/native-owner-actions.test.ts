import { beforeEach, describe, expect, it, vi } from "vitest";
import { proposeNativePlanOwner, reviewNativePlanOwner, searchNativePlanOwners } from "./native-owner-actions";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ auth: { getUser: mocks.auth }, rpc: mocks.rpc }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
const planId = "a3731000-0000-4000-8000-000000000001", owner = "a3732000-0000-4000-8000-000000000001", key = "a3733000-0000-4000-8000-000000000001";
function form() { const f = new FormData(); Object.entries({ locale: "ar", planId, ownerUserId: owner, version: "2", reason: "Texte libre de motif conservé", idempotencyKey: key }).forEach(([k, v]) => f.set(k, v)); return f; }
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ data: { user: { id: "admin" } }, error: null }); mocks.rpc.mockResolvedValue({ data: { outcome: "FRANCHISE_CONTROL_OWNER_PROPOSED", requestId: key }, error: null }); });
describe("governed responsible-member actions", () => {
  it("passes the selected authorized member, expected version and stable key without asking for a raw reference", async () => {
    expect(await proposeNativePlanOwner({ status: "idle" }, form())).toEqual({ status: "success" });
    expect(mocks.rpc).toHaveBeenCalledWith("propose_franchise_control_owner_v1", { p_plan_id: planId, p_owner_user_id: owner, p_expected_version: 2, p_reason: "Texte libre de motif conservé", p_idempotency_key: key });
    expect(mocks.revalidate).toHaveBeenCalledWith("/fr/franchise/performance"); expect(mocks.revalidate).toHaveBeenCalledWith("/ar/franchise/performance");
  });
  it("never mutates with a cached user while Auth is unavailable", async () => {
    mocks.auth.mockResolvedValue({ data: { user: { id: "cached" } }, error: { status: 503 } });
    expect(await proposeNativePlanOwner({ status: "idle" }, form())).toEqual({ status: "error", reason: "FAILED" }); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([["FRANCHISE_CONTROL_OWNER_MFA_REQUIRED", "MFA_REQUIRED"], ["FRANCHISE_CONTROL_OWNER_INDEPENDENT_ADMIN_REQUIRED", "FORBIDDEN"]] as const)("keeps %s distinct", async (message, reason) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message } }); expect(await proposeNativePlanOwner({ status: "idle" }, form())).toEqual({ status: "error", reason });
  });
  it("does not acknowledge a malformed assignment receipt", async () => {
    mocks.rpc.mockResolvedValue({ data: { outcome: "UNKNOWN" }, error: null }); expect(await proposeNativePlanOwner({ status: "idle" }, form())).toEqual({ status: "error", reason: "FAILED" }); expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("submits a second review without trusting a client-supplied owner or version", async () => {
    const f = form(); f.set("requestId", key); f.set("decision", "APPROVE");
    mocks.rpc.mockResolvedValue({ data: { outcome: "FRANCHISE_CONTROL_OWNER_REVIEWED", requestId: key }, error: null });
    expect(await reviewNativePlanOwner({ status: "idle" }, f)).toEqual({ status: "success" });
    expect(mocks.rpc).toHaveBeenCalledWith("review_franchise_control_owner_v1", { p_request_id: key, p_decision: "APPROVE", p_reason: "Texte libre de motif conservé", p_idempotency_key: key });
  });
  it("bounds member-search input before accessing the scoped server projection", async () => {
    const f = new FormData(); f.set("planId", planId); f.set("q", "x".repeat(121)); expect(await searchNativePlanOwners({ status: "idle" }, f)).toEqual({ status: "error", reason: "VALIDATION" }); expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), client: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: mocks.client }));
import { loadMyPlatformAccess } from "./platform-access";
beforeEach(() => { vi.clearAllMocks(); mocks.client.mockResolvedValue({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }); mocks.getUser.mockResolvedValue({ data: { user: { id: "user", email: "fixture@example.invalid" } }, error: null }); });
describe("platform access read failure classification", () => {
  it("preserves framework redirects instead of turning them into query failures", async () => {
    let signal: unknown;
    try { redirect("/fr/connexion"); } catch (error) { signal = error; }
    mocks.getUser.mockRejectedValue(signal);
    await expect(loadMyPlatformAccess()).rejects.toBe(signal);
  });
  it("keeps Auth503 technical without inventing an expired session", async () => { mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } }); expect(await loadMyPlatformAccess()).toEqual({ status: "error", reason: "QUERY_FAILED" }); expect(mocks.rpc).not.toHaveBeenCalled(); });
  it("reports a genuinely missing session", async () => { mocks.getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthSessionMissingError" } }); expect(await loadMyPlatformAccess()).toEqual({ status: "error", reason: "UNAUTHENTICATED" }); });
  it("contains transport rejection without clearing authentication", async () => { mocks.getUser.mockRejectedValue(new Error("transport")); expect(await loadMyPlatformAccess()).toEqual({ status: "error", reason: "QUERY_FAILED" }); });
  it("contains the RPC transport rejection", async () => { mocks.rpc.mockRejectedValue(new Error("transport")); expect(await loadMyPlatformAccess()).toEqual({ status: "error", reason: "QUERY_FAILED" }); });
  it("preserves malformed security response as a technical protocol failure", async () => { mocks.rpc.mockResolvedValue({ data: [], error: null }); expect(await loadMyPlatformAccess()).toEqual({ status: "error", reason: "INVALID_RESPONSE" }); });
  it("keeps MFA unmet even when the account has an admin role", async () => { mocks.rpc.mockResolvedValue({ data: [{ requirement_satisfied: false, matched_role_codes: ["SUPER_ADMIN"] }], error: null }); expect(await loadMyPlatformAccess()).toMatchObject({ status: "ok", requirementSatisfied: false }); });
});

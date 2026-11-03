import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), from: vi.fn(), range: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc, from: mocks.from }) }));
import { loadFranchiseNetworkInvitationStatus } from "./invitation-status-action";
const idle = { status: "idle" } as const, id = "11111111-1111-4111-8111-111111111111";
function form(page = 1) { const f = new FormData(); f.set("franchiseId", id); f.set("page", String(page)); return f; }
beforeEach(() => {
  vi.clearAllMocks(); mocks.getUser.mockResolvedValue({ data: { user: { id } }, error: null }); mocks.rpc.mockResolvedValue({ data: { read: true, write: true }, error: null });
  mocks.range.mockResolvedValue({ data: [], count: 0, error: null });
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: mocks.range };
  mocks.from.mockReturnValue(query);
});
describe("network invitation status projection", () => {
  it("checks explicit mandate capability before treating an empty RLS result as empty", async () => {
    mocks.rpc.mockResolvedValue({ data: { read: false, write: false }, error: null });
    await expect(loadFranchiseNetworkInvitationStatus(idle, form())).resolves.toEqual({ status: "error", reason: "FORBIDDEN" }); expect(mocks.from).not.toHaveBeenCalled();
  });
  it("loads a bounded page from the database-clock expiry projection", async () => {
    await expect(loadFranchiseNetworkInvitationStatus(idle, form(2))).resolves.toEqual({ status: "success", rows: [], page: 2, total: 0 });
    expect(mocks.from).toHaveBeenCalledWith("franchise_network_invitation_status_v1"); expect(mocks.range).toHaveBeenCalledWith(25, 49);
  });
  it.each([{ data: null, count: 0, error: { code: "503" } }, { data: [], count: null, error: null }, { data: [{ id: "invalid" }], count: 1, error: null }])("never hides an incident or invalid projection with an empty list", async response => {
    mocks.range.mockResolvedValue(response);
    await expect(loadFranchiseNetworkInvitationStatus(idle, form())).resolves.toEqual({ status: "error", reason: "FAILED" });
  });
  it("keeps expired-session and Auth-transport failures distinct", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
    await expect(loadFranchiseNetworkInvitationStatus(idle, form())).resolves.toEqual({ status: "error", reason: "UNAUTHENTICATED" });
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } });
    await expect(loadFranchiseNetworkInvitationStatus(idle, form())).resolves.toEqual({ status: "error", reason: "FAILED" }); expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

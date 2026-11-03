import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser }, from: mocks.from, rpc: mocks.rpc }) }));
import { loadNotificationCenter } from "./repository";

function query(data: unknown) {
  const value = { data, error: null };
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "order", "limit"]) chain[method] = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => value);
  chain.then = (resolve: (result: typeof value) => unknown) => Promise.resolve(value).then(resolve);
  return chain;
}

describe("notification repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "11111111-1111-4111-8111-111111111111" } } });
    mocks.rpc.mockResolvedValue({ data: { preferences: [], notifications: [], next: null }, error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table === "platform_user_roles") throw new Error("forbidden platform role read");
      if (table === "organization_memberships") return query({ organization_id: "22222222-2222-4222-8222-222222222222", organizations: { display_name: "Client A" } });
      return query([]);
    });
  });

  it("does not fall back to another organization for an invalid explicit selection", async () => {
    const result = await loadNotificationCenter("fr", "not-a-uuid");
    expect(result).toEqual({ status: "error", reason: "FORBIDDEN" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires the shell-selected organization instead of guessing the first membership", async () => {
    expect(await loadNotificationCenter("fr")).toEqual({status:"error",reason:"NO_ORGANIZATION"});
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("passes the exact selected organization and keyset filters to the server", async () => {
    const result=await loadNotificationCenter("ar", "22222222-2222-4222-8222-222222222222", {q:"فاتورة",unread:true,before:"2026-10-01T10:00:00Z",beforeId:"33333333-3333-4333-8333-333333333333"});
    expect(result.status).toBe("success");
    expect(mocks.rpc).toHaveBeenCalledWith("list_notification_center_page_v1",expect.objectContaining({p_organization_id:"22222222-2222-4222-8222-222222222222",p_query:"فاتورة",p_unread_only:true,p_before_created_at:"2026-10-01T10:00:00Z"}));
  });
  it("does not silently discard an incomplete cursor",async()=>{
    expect(await loadNotificationCenter("fr","22222222-2222-4222-8222-222222222222",{before:"2026-10-01T10:00:00Z"})).toEqual({status:"error",reason:"INVALID_RESPONSE"});
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("keeps a failed history read distinct from an empty inbox",async()=>{
    mocks.rpc.mockResolvedValue({data:null,error:{code:"08006"}});
    expect(await loadNotificationCenter("fr","22222222-2222-4222-8222-222222222222")).toEqual({status:"error",reason:"QUERY_FAILED"});
  });
  it("classifies an expired session separately from a service failure", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: { status: 503 } });
    expect(await loadNotificationCenter("fr")).toEqual({ status: "error", reason: "QUERY_FAILED" });
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: { status: 401 } });
    expect(await loadNotificationCenter("fr")).toEqual({ status: "error", reason: "UNAUTHENTICATED" });
  });
  it("charge le centre Client sans dépendre de la table des rôles plateforme", async () => {
    const result = await loadNotificationCenter("fr", "22222222-2222-4222-8222-222222222222");
    expect(result.status).toBe("success");
    expect(mocks.from).not.toHaveBeenCalledWith("platform_user_roles");
    if (result.status === "success") {
      expect(result.dashboard.canViewDeliveryOperations).toBe(false);
      expect(result.dashboard.templates).toEqual([]);
    }
    expect(mocks.from).not.toHaveBeenCalledWith("notification_template_versions");
  });
});

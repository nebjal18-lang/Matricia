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
    mocks.rpc.mockResolvedValue({ data: { preferences: [], notifications: [] }, error: null });
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
  it("classifies an expired session separately from a service failure", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: { status: 503 } });
    expect(await loadNotificationCenter("fr")).toEqual({ status: "error", reason: "QUERY_FAILED" });
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: { status: 401 } });
    expect(await loadNotificationCenter("fr")).toEqual({ status: "error", reason: "UNAUTHENTICATED" });
  });
  it("charge le centre Client sans dépendre de la table des rôles plateforme", async () => {
    const result = await loadNotificationCenter("fr");
    expect(result.status).toBe("success");
    expect(mocks.from).not.toHaveBeenCalledWith("platform_user_roles");
    if (result.status === "success") {
      expect(result.dashboard.canViewDeliveryOperations).toBe(false);
      expect(result.dashboard.templates).toEqual([]);
    }
    expect(mocks.from).not.toHaveBeenCalledWith("notification_template_versions");
  });
});

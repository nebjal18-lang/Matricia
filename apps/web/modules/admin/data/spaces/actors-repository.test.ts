import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn(), fiche: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }),
}));
vi.mock("@/app/[locale]/invitations/actions", () => ({ listInvitations: async () => ({ status: "success", organizations: [], invitations: [] }) }));
vi.mock("@/modules/admin/data/clients/repository", () => ({ loadAdminClients: vi.fn() }));
vi.mock("@/modules/admin/data/supervision/repository", () => ({
  loadAdminSupervisionDashboard: async () => ({ status: "success", value: { organizations: [] } }),
  loadAdminOrganizationFiche: mocks.fiche,
}));
vi.mock("./demo-overlay", () => ({ canApplyAdminDemo: () => false }));

import { loadAdminActorUser } from "./actors-repository";

const userId = "11111111-1111-4111-8111-111111111111";
const organizationA = "22222222-2222-4222-8222-222222222222";
const organizationB = "33333333-3333-4333-8333-333333333333";
const row = (organizationId: string) => ({
  user_id: userId, membership_id: "44444444-4444-4444-8444-444444444444",
  organization_id: organizationId, organization_name: organizationId,
  roles: ["CLIENT_OWNER"], status: "ACTIVE", updated_at: null,
  mfa_status: "DISABLED", session_count: 0,
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "admin" } } });
  mocks.rpc.mockResolvedValue({ data: { rows: [row(organizationB), row(organizationA)], total: 2 }, error: null });
  mocks.fiche.mockResolvedValue({ status: "success", value: { organization: { id: organizationA } } });
});

describe("admin actor user loading", () => {
  it("keeps an Auth503 technical instead of redirecting an authenticated actor to login", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } });
    expect(await loadAdminActorUser(userId)).toEqual({ status: "error", reason: "UNAVAILABLE" });
    expect(mocks.fiche).not.toHaveBeenCalled();
  });
  it.each([
    ["42501", "FORBIDDEN"],
    ["503", "UNAVAILABLE"],
  ])("preserves %s RPC errors instead of returning an empty user", async (code, reason) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code } });
    expect(await loadAdminActorUser(userId)).toEqual({ status: "error", reason });
    expect(mocks.fiche).not.toHaveBeenCalled();
  });

  it("preserves invalid response and expired authentication", async () => {
    mocks.rpc.mockResolvedValue({ data: { rows: [{}] }, error: null });
    expect(await loadAdminActorUser(userId)).toEqual({ status: "error", reason: "INVALID_RESPONSE" });
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect(await loadAdminActorUser(userId)).toEqual({ status: "error", reason: "UNAUTHENTICATED" });
  });

  it("selects only the requested membership, even when another is first", async () => {
    const result = await loadAdminActorUser(userId, organizationA);
    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Expected a loaded user");
    expect(result.rows.map((item) => item.organizationId)).toEqual([organizationA]);
    expect(mocks.fiche).toHaveBeenCalledExactlyOnceWith(organizationA);
  });

  it("keeps a missing scoped membership empty and never loads another organization", async () => {
    mocks.rpc.mockResolvedValue({ data: { rows: [row(organizationB)], total: 1 }, error: null });
    expect(await loadAdminActorUser(userId, organizationA)).toEqual({ status: "success", rows: [], fiche: null, organizations: [] });
    expect(mocks.fiche).not.toHaveBeenCalled();
  });

  it("distinguishes a genuinely absent user from a failed lookup", async () => {
    mocks.rpc.mockResolvedValue({ data: { rows: [], total: 0 }, error: null });
    expect(await loadAdminActorUser(userId)).toEqual({ status: "success", rows: [], fiche: null, organizations: [] });
  });

  it.each(["FORBIDDEN", "UNAVAILABLE", "NOT_FOUND"])("preserves %s errors from the selected organization fiche", async (reason) => {
    mocks.fiche.mockResolvedValue({ status: "error", reason });
    expect(await loadAdminActorUser(userId, organizationA)).toEqual({ status: "error", reason });
  });
});

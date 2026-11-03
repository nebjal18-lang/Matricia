import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), rpc: vi.fn(), from: vi.fn(), membershipEq: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ auth: { getUser: mocks.user }, rpc: mocks.rpc, from: mocks.from }) }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
import { readWorkspaceNavigation } from "./workspace-navigation-server";
function query(data: unknown, eq = vi.fn(), error: unknown = null) {
  const chain: Record<string, unknown> = {};
  for (const name of ["select", "order", "limit", "in", "is"]) chain[name] = vi.fn(() => chain);
  chain.eq = eq.mockImplementation(() => chain);
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve);
  return chain;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ data: { user: { id: "verified-user", email: "user@example.invalid" } }, error: null });
  mocks.rpc.mockResolvedValue({ data: [{ requirement_satisfied: true, matched_role_codes: [] }], error: null });
  mocks.from.mockImplementation(table => table === "organization_memberships" ? query([{ id: "member-client", organization_id: "org-client" }, { id: "member-provider", organization_id: "org-provider" }], mocks.membershipEq) : query([{ membership_id: "member-client", role_code: "CLIENT_ADMIN" }, { membership_id: "member-provider", role_code: "PROVIDER_OWNER" }]));
});
describe("server verified workspace choices", () => {
  it("reads only active memberships of the verified user and links each role to its organization", async () => {
    const result = await readWorkspaceNavigation("fr", undefined, "provider");
    expect(mocks.membershipEq).toHaveBeenCalledWith("user_id", "verified-user");
    expect(mocks.membershipEq).toHaveBeenCalledWith("status", "ACTIVE");
    expect(result).toMatchObject({ status: "ok", navigation: { landing: "provider", options: [{ kind: "client", href: "/fr/tableau-de-bord?workspace=client&organizationId=org-client" }, { kind: "provider", href: "/fr/tableau-de-bord?workspace=provider&organizationId=org-provider" }] } });
  });
  it("rejects an explicit Client organization paired with a Provider role from another organization", async () => {
    expect(await readWorkspaceNavigation("fr", "org-client", "provider")).toEqual({ status: "error", signedIn: true, reason: "FORBIDDEN" });
  });
  it("does not create an Admin choice from a forged preference", async () => {
    const result = await readWorkspaceNavigation("ar", undefined, "administration");
    expect(result).toMatchObject({ status: "ok", navigation: { landing: "client" } });
    if (result.status === "ok") expect(result.navigation.options.some(option => option.kind === "administration")).toBe(false);
  });
  it("does not silently replace an explicit foreign organization for an ordinary member", async () => {
    expect(await readWorkspaceNavigation("fr", "foreign-org")).toMatchObject({ status: "error", reason: "FORBIDDEN" });
  });
  it("keeps an AAL1 platform Admin in the Admin navigation without granting protected content", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ requirement_satisfied: false, matched_role_codes: ["SUPER_ADMIN"] }], error: null });
    const result = await readWorkspaceNavigation("ar", null, "administration");
    expect(result).toMatchObject({ status: "ok", requirementSatisfied: false, navigation: { landing: "administration" } });
  });
  it("distinguishes a service error from missing session and from absent roles", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "private detail must stay server-side" } });
    expect(await readWorkspaceNavigation("fr")).toEqual({ status: "error", signedIn: true, reason: "QUERY_FAILED" });
    mocks.user.mockResolvedValue({ data: { user: null }, error: null });
    expect(await readWorkspaceNavigation("fr")).toEqual({ status: "error", reason: "UNAUTHENTICATED" });
  });
});

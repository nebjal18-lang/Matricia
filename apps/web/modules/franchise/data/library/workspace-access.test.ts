import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFranchiseLibraryWorkspace } from "./workspace";

const mocks = vi.hoisted(() => ({ franchises: [] as unknown[], memberships: [] as unknown[], error: null as unknown, rpc: vi.fn() }));
const userId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const franchiseId = "33333333-3333-4333-8333-333333333333";
const libraryId = "44444444-4444-4444-8444-444444444444";
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: userId } } }) }, rpc: mocks.rpc,
  from: (table: string) => {
    const response = { data: table === "franchises" ? mocks.franchises : mocks.memberships, error: mocks.error };
    const query: Record<string, unknown> = { then: (resolve: (response: unknown) => void) => Promise.resolve(response).then(resolve) };
    for (const method of ["select", "eq", "order", "range"]) query[method] = () => query;
    return query;
  },
}) }));
vi.mock("./demo-overlay", () => ({ overlayFranchiseLibraryDemo: vi.fn((workspace) => workspace) }));

beforeEach(() => { mocks.franchises = []; mocks.memberships = []; mocks.error = null; mocks.rpc.mockReset(); });
for (const locale of ["fr", "ar"] as const) describe(`Franchise workspace access ${locale}`, () => {
  it("reports the absence of an active visible mandate without querying a fabricated franchise", async () => {
    expect(await loadFranchiseLibraryWorkspace({ locale })).toEqual({ status: "error", reason: "NO_MANDATE" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("keeps a failed membership/mandate read distinct from absence", async () => {
    mocks.error = { code: "08006" };
    expect(await loadFranchiseLibraryWorkspace({ locale })).toEqual({ status: "error", reason: "QUERY_FAILED" });
  });
  it("keeps an authorized-context RPC denial distinct from a server failure", async () => {
    mocks.franchises = [{ id: franchiseId, library_id: libraryId, operator_organization_id: organizationId, franchise_type: "STANDARD", operator_code: "SYNTHETIC", status: "ACTIVE" }];
    mocks.memberships = [{ organization_id: organizationId, organization_member_roles: [{ role_code: "FRANCHISE_OWNER", franchise_id: franchiseId, revoked_at: null }] }];
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "FRANCHISE_CATALOG_SCOPE_DENIED" } });
    expect(await loadFranchiseLibraryWorkspace({ locale, organizationId })).toEqual({ status: "error", reason: "FORBIDDEN" });
    expect(mocks.rpc).toHaveBeenCalledWith("franchise_catalog_page", expect.objectContaining({ p_franchise_id: franchiseId }));
  });
});

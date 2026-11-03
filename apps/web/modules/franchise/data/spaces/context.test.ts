import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveFranchiseSpace } from "./context";

const mocks = vi.hoisted(() => ({ user: { id: "11111111-1111-4111-8111-111111111111", email: "test@example.invalid" } as { id: string; email: string } | null, rows: [] as unknown[], error: null as unknown, authError: null as { name?: string; status?: number } | null, from: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: mocks.user }, error: mocks.authError }) }, from: mocks.from }) }));
const organizationA = "22222222-2222-4222-8222-222222222222";
const organizationB = "33333333-3333-4333-8333-333333333333";
const membership = (organizationId: string, role = "FRANCHISE_OWNER", revoked: string | null = null) => ({ organization_id: organizationId, organizations: { display_name: organizationId === organizationA ? "Organisation A" : "Organisation B", status: "ACTIVE" }, organization_member_roles: [{ role_code: role, revoked_at: revoked }] });

beforeEach(() => {
  mocks.user = { id: "11111111-1111-4111-8111-111111111111", email: "test@example.invalid" }; mocks.authError = null; mocks.from.mockClear();
  mocks.rows = [membership(organizationA)]; mocks.error = null;
  mocks.from.mockImplementation((table: string) => {
    const response = table === "organization_memberships" ? { data: mocks.rows, error: mocks.error } : { data: [{ display_name: "Organisation A" }], error: null };
    const query: Record<string, unknown> = { then: (resolve: (response: unknown) => void) => Promise.resolve(response).then(resolve) };
    for (const method of ["select", "eq", "is", "in", "order", "limit", "range"]) query[method] = () => query;
    return query;
  });
});

describe("verified Franchise organization context", () => {
  it.each([true, false])("preserves an Auth outage as a technical error with cached user=%s", async (cached) => {
    if (!cached) mocks.user = null;
    mocks.authError = { name: "AuthRetryableFetchError", status: 503 };
    expect(await resolveFranchiseSpace({ locale: "fr", organizationId: organizationA })).toMatchObject({ status: "success", selectedOrganizationId: null, errorReason: "QUERY_FAILED" });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each([{ status: 401 }, { name: "AuthSessionMissingError" }])("asks for login only for a known invalid session %j", async (error) => {
    mocks.authError = error;
    expect(await resolveFranchiseSpace({ locale: "ar" })).toEqual({ status: "unauthenticated" });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("keeps an absent session distinct from an outage", async () => {
    mocks.user = null;
    expect(await resolveFranchiseSpace({ locale: "fr" })).toEqual({ status: "unauthenticated" });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each(["fr", "ar"] as const)("recovers the sole active Franchise organization in %s without requiring a query string", async (locale) => {
    const result = await resolveFranchiseSpace({ locale });
    expect(result).toMatchObject({ status: "success", selectedOrganizationId: organizationA, selectedQuery: `?organizationId=${organizationA}`, organizations: [{ id: organizationA, name: "Organisation A" }] });
  });
  it("does not silently choose between several authorized organizations", async () => {
    mocks.rows = [membership(organizationA), membership(organizationB)];
    const result = await resolveFranchiseSpace({ locale: "fr" });
    expect(result).toMatchObject({ status: "success", selectedOrganizationId: null });
    expect(result.status === "success" && result.organizations).toHaveLength(2);
  });
  it("rejects a foreign query organization without falling back to the sole authorized one", async () => {
    const result = await resolveFranchiseSpace({ locale: "fr", organizationId: organizationB });
    expect(result).toMatchObject({ status: "success", selectedOrganizationId: null, errorReason: "FORBIDDEN" });
  });
  it("excludes revoked Franchise roles and memberships with only a Client role", async () => {
    mocks.rows = [membership(organizationA, "FRANCHISE_OWNER", "2026-01-01"), membership(organizationB, "CLIENT_OWNER")];
    const result = await resolveFranchiseSpace({ locale: "ar" });
    expect(result).toMatchObject({ status: "success", selectedOrganizationId: null, organizations: [] });
  });
  it("keeps a query failure distinct from having no organization", async () => {
    mocks.error = { code: "08006" };
    expect(await resolveFranchiseSpace({ locale: "fr" })).toMatchObject({ status: "success", selectedOrganizationId: null, errorReason: "QUERY_FAILED" });
  });
});

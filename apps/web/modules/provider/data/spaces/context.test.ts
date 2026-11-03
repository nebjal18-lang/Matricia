import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, from, response, query } = vi.hoisted(() => {
  const response = { value: { data: [] as unknown, error: null as unknown } };
  const query = {
    select: vi.fn(() => query), eq: vi.fn(() => query), is: vi.fn(() => query),
    in: vi.fn(() => query), order: vi.fn(() => query), limit: vi.fn(() => query),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(response.value).then(resolve),
  };
  return { response, query, from: vi.fn(() => query), getUser: vi.fn() };
});
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ auth: { getUser }, from }) }));
import { resolveProviderSpace } from "./context";
import { providerContextReadState } from "./organization-context";

const userId = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: userId, email: "provider@example.invalid" } } });
  response.value = { data: [], error: null };
});

describe("provider membership transport boundary", () => {
  it("keeps an Auth 503 unavailable while a known invalid session requires login", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } });
    const scope = await resolveProviderSpace({ locale: "fr" });
    if (scope.status !== "success") throw Error("AUTH_503_MUST_NOT_REDIRECT_TO_LOGIN");
    expect(scope.readError).toBe("AUTH_QUERY_FAILED");
    expect(providerContextReadState(scope)).toBe("unavailable");
    expect(from).not.toHaveBeenCalled();
    getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
    expect(await resolveProviderSpace({ locale: "fr" })).toEqual({ status: "unauthenticated" });
  });

  it.each([{ data: null, error: { code: "503" } }, { data: [{ organization_id: "invalid" }], error: null }])("preserves failed or malformed reads for the route instead of asserting absence", async (value) => {
    response.value = value;
    const scope = await resolveProviderSpace({ locale: "fr" });
    expect(scope.status).toBe("success");
    if (scope.status === "success") {
      expect(scope.readError).toBe(value.error ? "QUERY_FAILED" : "INVALID_RESPONSE");
      expect(providerContextReadState(scope)).toBe("unavailable");
      expect(scope.selectedOrganizationId).toBeNull();
    }
  });

  it("treats a successful empty membership list as absence and retains active non-revoked role filters", async () => {
    const scope = await resolveProviderSpace({ locale: "ar" });
    if (scope.status !== "success") throw Error("EXPECTED_AUTHENTICATED_SCOPE");
    expect(scope.readError).toBeNull();
    expect(providerContextReadState(scope)).toBe("no-organization");
    expect(query.eq).toHaveBeenCalledWith("user_id", userId);
    expect(query.eq).toHaveBeenCalledWith("status", "ACTIVE");
    expect(query.is).toHaveBeenCalledWith("organization_member_roles.revoked_at", null);
  });

  it("does not query memberships for an unauthenticated actor", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await resolveProviderSpace({ locale: "fr" })).toEqual({ status: "unauthenticated" });
    expect(from).not.toHaveBeenCalled();
  });
});

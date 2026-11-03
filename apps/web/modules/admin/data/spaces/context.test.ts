import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), redirect: vi.fn((path: string): never => { throw new Error(`REDIRECT:${path}`); }) }));
vi.mock("@/modules/shared/lib/account-security/platform-access", () => ({ loadMyPlatformAccess: mocks.access }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { resolveAdminSpace } from "./context";
beforeEach(() => { vi.clearAllMocks(); });
describe("admin authorization context failures", () => {
  it.each(["QUERY_FAILED", "INVALID_RESPONSE"])("keeps %s as a technical failure instead of denying a role", async reason => {
    mocks.access.mockResolvedValue({ status: "error", reason });
    await expect(resolveAdminSpace({ locale: "fr" })).rejects.toThrow("ADMIN_ACCESS_UNAVAILABLE");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("preserves unauthenticated state for the caller login flow", async () => {
    mocks.access.mockResolvedValue({ status: "error", reason: "UNAUTHENTICATED" });
    await expect(resolveAdminSpace({ locale: "fr" })).resolves.toEqual({ status: "unauthenticated" });
  });
  it("does not serve an admin shell to a user without a role", async () => {
    mocks.access.mockResolvedValue({ status: "ok", roles: new Set(), requirementSatisfied: true });
    await expect(resolveAdminSpace({ locale: "ar" })).rejects.toThrow("REDIRECT:/ar/tableau-de-bord");
  });
  it.each(["fr", "ar"] as const)("requires MFA before serving protected content in %s", async locale => {
    mocks.access.mockResolvedValue({ status: "ok", roles: new Set(["SUPER_ADMIN"]), requirementSatisfied: false });
    await expect(resolveAdminSpace({ locale })).rejects.toThrow(`REDIRECT:/${locale}/securite/compte`);
  });
  it.each(["fr", "ar"] as const)("preserves deep Admin intent without satisfying MFA in %s", async locale => {
    mocks.access.mockResolvedValue({ status: "ok", roles: new Set(["SUPER_ADMIN"]), requirementSatisfied: false });
    const next = `/${locale}/administration/entreprises/nouvelle?organizationId=org`;
    try { await resolveAdminSpace({ locale, returnPath: next }); } catch { /* redirect sentinel */ }
    const url = new URL(mocks.redirect.mock.calls[0]![0], "https://test.invalid");
    expect(url.pathname).toBe(`/${locale}/securite/compte`);
    expect(url.searchParams.get("next")).toBe(next);
    expect(url.searchParams.get("workspace")).toBe("administration");
  });
  it("preserves the selected organization exactly after successful authorization", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    mocks.access.mockResolvedValue({ status: "ok", roles: new Set(["SUPER_ADMIN"]), requirementSatisfied: true, email: "admin@example.invalid" });
    const result = await resolveAdminSpace({ locale: "fr", organizationId: id });
    expect(result).toMatchObject({ status: "success", selectedOrganizationId: id, selectedQuery: `?organizationId=${id}` });
  });
});

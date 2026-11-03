import { describe, expect, it } from "vitest";
import { workspaceSecurityHref } from "./security-href";

describe("security detour", () => {
  it.each(["fr", "ar"] as const)("preserves the organization, role, exact return and section (%s)", (locale) => {
    const url = new URL(workspaceSecurityHref(locale, `/${locale}/client/actions?approvalPage=2#pending`, "selected"), "https://matricia.invalid");
    expect(url.pathname).toBe(`/${locale}/securite/compte`);
    expect(url.searchParams.get("workspace")).toBe("client");
    expect(url.searchParams.get("organizationId")).toBe("selected");
    expect(url.searchParams.get("next")).toBe(`/${locale}/client/actions?approvalPage=2&organizationId=selected#pending`);
  });
  it("retains administration for the independent Finance reviewer", () => {
    const url = new URL(workspaceSecurityHref("fr", "/fr/administration/avantages/remboursements", null, "administration"), "https://matricia.invalid");
    expect(url.searchParams.get("workspace")).toBe("administration");
    expect(url.searchParams.get("next")).toBe("/fr/administration/avantages/remboursements");
  });
  it.each(["https://untrusted.invalid/", "//untrusted.invalid/", "/ar/client/actions"])("never carries an unauthorized return %s", (returnTo) => {
    const url = new URL(workspaceSecurityHref("fr", returnTo), "https://matricia.invalid");
    expect(url.searchParams.get("next")).toBe("/fr/tableau-de-bord");
  });
});

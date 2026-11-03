import { describe, expect, it } from "vitest";
import { availableWorkspaces, authorizedReturnPath, translateLocalPath } from "./workspace-navigation";

describe("authorized workspace navigation", () => {
  it("only recognizes declared membership and platform roles", () => {
    expect(availableWorkspaces(["CLIENT_ADMIN", "PROVIDER_OWNER"], ["SUPER_ADMIN"])).toEqual(["client", "provider", "administration"]);
    expect(availableWorkspaces(["CLIENT_FORGED", "SUPER_ADMIN"], ["CLIENT_ADMIN"])).toEqual([]);
  });
  it.each(["fr", "ar"] as const)("preserves an authorized Admin creation path and rejects cross-role paths in %s", locale => {
    const path = `/${locale}/administration/entreprises/nouvelle?organizationId=org`;
    expect(authorizedReturnPath(path, locale, ["administration"])).toBe(path);
    expect(authorizedReturnPath(path, locale, ["client"])).toBeUndefined();
    expect(authorizedReturnPath(`/${locale}/franchise/perimetre`, locale, ["client"])).toBeUndefined();
    expect(authorizedReturnPath(`/${locale}/sous-traitant/missions`, locale, ["client"])).toBeUndefined();
    expect(authorizedReturnPath(`/${locale}/franchise`, locale, [])).toBe(`/${locale}/franchise`);
  });
  it.each(["https://evil.invalid/fr/administration", "/fr/%5cevil", "/fr/%0aevil", "/ar/client/demandes", "/fr/connexion?next=/fr/connexion"])("rejects unsafe or looping next %s", path => {
    expect(authorizedReturnPath(path, "fr", ["administration", "client"])).toBeUndefined();
  });
  it("translates the exact security page and nested MFA destination", () => {
    const next = "/fr/administration/entreprises/nouvelle?organizationId=org";
    const path = `/fr/securite/compte?${new URLSearchParams({ next, organizationId: "org", workspace: "administration" })}`;
    const result = new URL(translateLocalPath(path, "fr", "ar"), "https://test.invalid");
    expect(result.pathname).toBe("/ar/securite/compte");
    expect(result.searchParams.get("next")).toBe("/ar/administration/entreprises/nouvelle?organizationId=org");
    expect(result.searchParams.get("organizationId")).toBe("org");
    expect(result.searchParams.get("workspace")).toBe("administration");
  });
});

import { describe, expect, it } from "vitest";
import { availableWorkspaces, authorizedReturnPath, translateLocalPath, withDashboardWorkspaceHint } from "./workspace-navigation";

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

describe("explicit Client and Provider dashboard hints",()=>{
  it.each(["fr","ar"] as const)("replaces repeated false hints and preserves tenant, filters and hash in %s",locale=>{
    const path=`/${locale}/tableau-de-bord?organizationId=selected&q=suivi+des+missions&page=3&workspace=client&workspace=administration#priorities`;
    for(const workspace of ["provider","client"] as const){
      const url=new URL(withDashboardWorkspaceHint(path,locale,workspace),"https://matricia.invalid");
      expect(url.searchParams.getAll("workspace")).toEqual([workspace]);expect(url.searchParams.get("organizationId")).toBe("selected");expect(url.searchParams.get("q")).toBe("suivi des missions");expect(url.searchParams.get("page")).toBe("3");expect(url.hash).toBe("#priorities");
    }
  });
  it.each(["fr","ar"] as const)("only forces the exact common dashboard and preserves detail destinations in %s",locale=>{
    for(const path of [`/${locale}/sous-traitant/missions/test?organizationId=selected&workspace=client#proofs`,`/${locale}/tableau-de-bord/details?organizationId=selected&workspace=client`])expect(withDashboardWorkspaceHint(path,locale,"provider")).toBe(path);
    expect(withDashboardWorkspaceHint("https://foreign.invalid/",locale,"provider")).toBe(`/${locale}/tableau-de-bord?workspace=provider`);
  });
});

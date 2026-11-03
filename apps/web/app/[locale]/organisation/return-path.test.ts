import { describe, expect, it } from "vitest";
import { organizationReturnPath } from "./return-path";

describe("organizationReturnPath", () => {
  it("keeps the diagnostic save resume path for the same locale", () => {
    expect(organizationReturnPath("fr", "/fr/diagnostic?reprendre=enregistrer")).toBe("/fr/diagnostic?reprendre=enregistrer");
    expect(organizationReturnPath("ar", "/ar/diagnostic?reprendre=enregistrer")).toBe("/ar/diagnostic?reprendre=enregistrer");
  });

  it("preserves only a safe same-language referral after company creation",()=>{
    expect(organizationReturnPath("fr","/fr/invitation/TESTCODE123")).toBe("/fr/invitation/TESTCODE123");
    for(const value of ["/ar/invitation/TESTCODE123","/fr/invitation/TESTCODE123?next=//evil.example","/fr/invitation/../admin"])expect(organizationReturnPath("fr",value)).toBeNull();
  });

  it("drops external, cross-locale and arbitrary destinations", () => {
    for (const value of [undefined, "", "https://evil.example", "//evil.example", "/ar/diagnostic?reprendre=enregistrer", "/fr/admin", "/fr/diagnostic"]) {
      expect(organizationReturnPath("fr", value)).toBeNull();
    }
  });

  it("resumes only the exact network invitation target with its two bounded credentials", () => {
    const suffix = `invitationId=11111111-1111-4111-8111-111111111111&token=${"a".repeat(43)}`;
    for (const locale of ["fr", "ar"] as const) expect(organizationReturnPath(locale, `/${locale}/rejoindre-reseau?${suffix}`)).toBe(`/${locale}/rejoindre-reseau?${suffix}`);
    for (const value of [
      `/ar/rejoindre-reseau?${suffix}`, `/fr/rejoindre-reseau?${suffix}&next=//evil.invalid`,
      `/fr/rejoindre-reseau?${suffix}&token=${"b".repeat(43)}`, `/fr/rejoindre-reseau?${suffix}#other`,
      `/fr/rejoindre-reseau?invitationId=invalid&token=${"a".repeat(43)}`, `/fr/rejoindre-reseau?invitationId=11111111-1111-4111-8111-111111111111&token=short`,
      `/fr/rejoindre-reseau?${suffix}&invitationId=11111111-1111-4111-8111-111111111111`,
    ]) expect(organizationReturnPath("fr", value)).toBeNull();
  });
});

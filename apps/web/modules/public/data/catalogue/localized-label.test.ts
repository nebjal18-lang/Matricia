import { describe, expect, it } from "vitest";
import { getPublicProviderTaxonomy } from "../provider-intent/model";
import { getStaticPublicCatalogue } from "./static-projection";
import { publicCatalogueLabel } from "./localized-label";

describe("public catalogue label provenance", () => {
  it("uses supplied approved Arabic content and explicitly labels a missing translation", () => {
    const approvedDomainName = getStaticPublicCatalogue("ar").libraries[0]!.name;
    expect(publicCatalogueLabel("Domaine", "ar", approvedDomainName)).toBe(approvedDomainName);
    expect(publicCatalogueLabel("Service français", "ar")).toBe("الاسم العربي غير متاح — بالفرنسية: Service français");
    expect(publicCatalogueLabel("Service français", "fr", approvedDomainName)).toBe("Service français");
  });

  it("preserves all canonical service codes while declaring every currently missing Arabic service/category label", () => {
    const fr = getPublicProviderTaxonomy("fr").libraries.flatMap((library) => library.categories);
    const ar = getPublicProviderTaxonomy("ar").libraries.flatMap((library) => library.categories);
    expect(ar.flatMap((category) => category.services.map((service) => service.code))).toEqual(fr.flatMap((category) => category.services.map((service) => service.code)));
    expect(ar.flatMap((category) => category.services)).toHaveLength(200);
    expect(ar.every((category) => category.name.startsWith("الاسم العربي غير متاح"))).toBe(true);
    expect(ar.flatMap((category) => category.services).every((service) => service.name.startsWith("الاسم العربي غير متاح"))).toBe(true);
  });
});

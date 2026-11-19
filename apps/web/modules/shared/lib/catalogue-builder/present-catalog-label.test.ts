import { describe, expect, it } from "vitest";
import {
  isCatalogFixtureCode,
  isCatalogOperatorLibrary,
  isCatalogScratchLabel,
  presentCatalogEntityLabel,
} from "./model";

describe("catalogue operator labels", () => {
  it("detects audit fixture library codes", () => {
    expect(isCatalogFixtureCode("A_P08_10B6E982")).toBe(true);
    expect(isCatalogFixtureCode("E2E_IT_LIB")).toBe(true);
    expect(isCatalogFixtureCode("IT")).toBe(false);
    expect(isCatalogFixtureCode("SANTE")).toBe(false);
  });

  it("detects scratch UI-save library labels", () => {
    expect(isCatalogScratchLabel("Bibliothèque sauvée")).toBe(true);
    expect(isCatalogScratchLabel("Bibliothèque service test")).toBe(true);
    expect(isCatalogScratchLabel("Cc")).toBe(true);
    expect(isCatalogScratchLabel("Informatique, cybersécurité et data")).toBe(false);
    expect(isCatalogScratchLabel("Achats, logistique et supply chain")).toBe(false);
  });

  it("keeps only operator-ready libraries in the picker pool", () => {
    expect(isCatalogOperatorLibrary({
      code: "IT",
      status: "PUBLISHED",
      nameFr: "Informatique, cybersécurité et data",
      nameAr: "المعلوميات",
    })).toBe(true);
    expect(isCatalogOperatorLibrary({
      code: "TMP_SAVE",
      status: "DRAFT",
      nameFr: "Bibliothèque sauvée",
      nameAr: "مكتبة محفوظة",
    })).toBe(false);
    expect(isCatalogOperatorLibrary({
      code: "A_P08_10B6E982",
      status: "PUBLISHED",
      nameFr: "Informatique PME",
      nameAr: "معلوميات",
      fixture: true,
    })).toBe(false);
  });

  it("prefers bilingual names over technical codes", () => {
    expect(presentCatalogEntityLabel("fr", { code: "A_P08_10B6E982", nameFr: "Informatique PME", nameAr: "معلوميات" })).toBe("Informatique PME");
    expect(presentCatalogEntityLabel("ar", { code: "IT", nameFr: "Informatique", nameAr: "المعلوميات" })).toBe("المعلوميات");
  });

  it("never dumps raw A_P08 hex codes when names are missing", () => {
    expect(presentCatalogEntityLabel("fr", { code: "A_P08_10B6E982", nameFr: null, nameAr: null })).toBe("Bibliothèque de test");
    expect(presentCatalogEntityLabel("fr", { code: "IT_AUDIT_SI", nameFr: null, nameAr: null })).toBe("It Audit Si");
  });
});

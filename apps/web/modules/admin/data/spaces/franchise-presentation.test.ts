import { describe, expect, it } from "vitest";
import {
  franchiseListTitle,
  franchiseOperatorLabel,
  franchiseTerritoryLabel,
  humanizeTechnicalCode,
} from "./franchise-presentation";

describe("franchise-presentation", () => {
  it("maps known operator codes to human labels", () => {
    expect(franchiseOperatorLabel("HATIM_AHMITECH", "fr")).toBe("Hatim Ahmitech");
    expect(franchiseOperatorLabel("FRANCHISEE", "fr")).toBe("Franchisé");
    expect(franchiseOperatorLabel("FRANCHISEE", "ar")).toBe("صاحب امتياز");
  });

  it("humanizes technical territory codes without dumping E2E noise", () => {
    expect(humanizeTechnicalCode("CASABLANCA_SETTAT", "fr")).toBe("Casablanca Settat");
    expect(humanizeTechnicalCode("E2E_SOUSS_ZONE", "fr")).toBe("Souss Zone");
  });

  it("prefers the localized territory version name when available", () => {
    expect(
      franchiseTerritoryLabel(
        {
          territoryCode: "CASABLANCA_SETTAT",
          territoryVersions: [{ code: "CASABLANCA_SETTAT", name: "Casablanca-Settat", version: 2 }],
        },
        "fr",
      ),
    ).toBe("Casablanca-Settat");
  });

  it("builds a readable list title for territoires rows", () => {
    expect(
      franchiseListTitle(
        {
          operatorCode: "HATIM_AHMITECH",
          libraryNameFr: "Informatique",
          libraryNameAr: "المعلوميات",
          territoryCode: "CASABLANCA_SETTAT",
          territoryVersions: [{ code: "CASABLANCA_SETTAT", name: "Casablanca-Settat", version: 1 }],
        },
        "fr",
      ),
    ).toBe("Hatim Ahmitech · Casablanca-Settat");
  });
});

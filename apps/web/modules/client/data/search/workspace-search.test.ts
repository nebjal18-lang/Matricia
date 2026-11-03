import { describe, expect, it } from "vitest";
import { matchesClientSearch, normalizeSearchQuery } from "@/modules/client/data/search/workspace-search";
import { buildClientNav, buildClientPrimaryNav, buildClientUtilityNav } from "@/modules/client/ui/client-nav";
import { clientDashboardCopy } from "@/modules/client/data/home/copy";

describe("Lot 0 — navigation et recherche Client", () => {
  it("conserve la nav maquette et ajoute le pilotage Gold Master", () => {
    const primary = buildClientPrimaryNav({ locale: "fr", selectedQuery: "?organizationId=abc" });
    const extra = buildClientUtilityNav({ locale: "fr", selectedQuery: "?organizationId=abc" });
    expect(primary.map((item) => item.key)).toEqual([
      "home", "needs", "requests", "missions", "documents", "messages", "finance", "rewards", "company",
    ]);
    expect(extra.map((item) => item.key)).toEqual(["actions", "contracts", "portfolio", "credits", "memberBoxes", "favorites"]);
    expect(buildClientNav({ locale: "fr", selectedQuery: "" })).toHaveLength(15);
    expect(extra.find((item) => item.key === "contracts")?.href).toContain("/client/contrats");
    expect(clientDashboardCopy.fr.navActions).toBe("À traiter");
    expect(clientDashboardCopy.ar.navContracts).toBe("العقود");
  });

  it("filtre la recherche globale sans inventer de résultat court", () => {
    expect(normalizeSearchQuery("  devis  comparé ")).toBe("devis comparé");
    expect(matchesClientSearch("Devis à comparer", "de")).toBe(true);
    expect(matchesClientSearch("Devis à comparer", "x")).toBe(false);
    expect(matchesClientSearch("Mission ouverte", "contrat")).toBe(false);
  });
});

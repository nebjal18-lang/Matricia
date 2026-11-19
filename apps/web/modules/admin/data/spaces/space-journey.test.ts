import { describe, expect, it } from "vitest";
import { governedMutationSpaces, spaceNextStep, spacePrevStep } from "./space-journey";
import { adminFilmForSpace, filmHubChain, parcoursDossierChain } from "./admin-film";

describe("space journey banners", () => {
  it("chains commercial spaces to the next admin screen", () => {
    expect(spaceNextStep("fr", "demandes", "?organizationId=org")?.href).toBe("/fr/administration/matching?organizationId=org");
    expect(spaceNextStep("fr", "devis", "")?.label).toMatch(/contrats/i);
    expect(spaceNextStep("ar", "missions", "")?.href).toBe("/ar/administration/jalons");
  });

  it("chains actor spaces into the film", () => {
    expect(spaceNextStep("fr", "providers", "")?.href).toBe("/fr/administration/qualification");
    expect(spaceNextStep("fr", "franchises", "")?.href).toBe("/fr/administration/candidatures-franchise");
    expect(spacePrevStep("fr", "qualification", "")?.href).toBe("/fr/administration/providers");
  });

  it("marks governed spaces so free-form modifier stays closed", () => {
    expect(governedMutationSpaces.has("demandes")).toBe(true);
    expect(governedMutationSpaces.has("gouvernance")).toBe(true);
    expect(governedMutationSpaces.has("providers")).toBe(false);
  });
});

describe("admin film registry", () => {
  it("exposes why/owner/next for spaces", () => {
    const film = adminFilmForSpace("fr", "matching", "");
    expect(film?.step).toBe(7);
    expect(film?.why).toMatch(/éligibilité/i);
    expect(film?.steps).toHaveLength(11);
    expect(film?.steps[6]?.state).toBe("current");
  });

  it("builds hub chain covering steps 1–11", () => {
    const chain = filmHubChain("fr");
    expect(chain.map((item) => item.step)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(chain.some((item) => item.id === "invitations-reseau")).toBe(true);
    expect(chain.some((item) => item.id === "candidatures-franchise")).toBe(true);
    expect(chain.some((item) => item.id === "facturation-clients")).toBe(true);
  });

  it("exposes the dossier chain with demandes, avenants, jalons, docs, messages, litiges", () => {
    const chain = parcoursDossierChain("fr");
    expect(chain.map((item) => item.id)).toEqual([
      "diagnostics",
      "demandes",
      "matching",
      "devis",
      "contrats",
      "avenants",
      "missions",
      "jalons",
      "documents",
      "messagerie",
      "litiges",
    ]);
  });
});

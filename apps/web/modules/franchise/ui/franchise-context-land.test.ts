import { describe, expect, it } from "vitest";
import { franchiseContextLandHash } from "./franchise-context-land";

describe("franchiseContextLandHash", () => {
  it("lands on volume propose, invite, definition, publish and dossier actions", () => {
    expect(franchiseContextLandHash("/fr/franchise/finance/volume")).toBe("#volume-propose");
    expect(franchiseContextLandHash("/fr/franchise/perimetre/utilisateurs")).toBe("#invite");
    expect(franchiseContextLandHash("/fr/franchise/qualite/definitions")).toBe("#definition-form");
    expect(franchiseContextLandHash("/ar/franchise/validations/publications")).toBe("#publish");
    expect(franchiseContextLandHash("/fr/franchise/fournisseurs/abc/qualification")).toBe("#dossier-actions");
  });

  it("returns empty hash for generic pages", () => {
    expect(franchiseContextLandHash("/fr/franchise/tableau-de-bord")).toBe("");
  });
});

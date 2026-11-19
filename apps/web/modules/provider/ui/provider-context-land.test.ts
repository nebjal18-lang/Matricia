import { describe, expect, it } from "vitest";
import { providerContextLandHash } from "./provider-context-land";

describe("providerContextLandHash", () => {
  it("lands on actionable section hashes for primary provider screens", () => {
    expect(providerContextLandHash("home")).toBe("#provider-treat-now");
    expect(providerContextLandHash("qualify")).toBe("#qualification");
    expect(providerContextLandHash("consult")).toBe("#consult-overview");
    expect(providerContextLandHash("quotes")).toBe("#devis-operation");
    expect(providerContextLandHash("missions")).toBe("#missions-operation");
    expect(providerContextLandHash("documents")).toBe("#docs");
    expect(providerContextLandHash("billing")).toBe("#facturation-operation");
    expect(providerContextLandHash("messages")).toBe("#messages");
    expect(providerContextLandHash("company")).toBe("#profil");
    expect(providerContextLandHash("settings")).toBe("#notifications");
  });

  it("returns empty hash when the screen has no dedicated unlock anchor", () => {
    expect(providerContextLandHash("questionnaires")).toBe("");
    expect(providerContextLandHash("contracts")).toBe("");
    expect(providerContextLandHash("planning")).toBe("");
    expect(providerContextLandHash("modeClient")).toBe("");
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { buildDemoBoxActorSpaceRows } from "./demo-box-actors";

afterEach(() => {
  delete process.env.MATRICIA_DEMO_ACCESS_ENABLED;
  delete process.env.APP_ENV;
});

describe("demo-box-actors", () => {
  it("reste inactif hors mode démo", () => {
    expect(buildDemoBoxActorSpaceRows("fr", "franchises", "")).toBeNull();
  });

  it("place les dossiers dans franchises / providers / capacite", () => {
    process.env.APP_ENV = "development";
    process.env.MATRICIA_DEMO_ACCESS_ENABLED = "true";

    const franchises = buildDemoBoxActorSpaceRows("fr", "franchises", "");
    const providers = buildDemoBoxActorSpaceRows("fr", "providers", "");
    const capacite = buildDemoBoxActorSpaceRows("fr", "capacite", "");
    const offres = buildDemoBoxActorSpaceRows("fr", "demandes", "");

    expect(offres).toBeNull();
    expect(franchises).toHaveLength(12 * 10);
    expect(providers).toHaveLength(12 * 10 * 3);
    expect(capacite!.length).toBe(12 * 10 * 3 * 9);

    expect(franchises![0]?.extras?.ice).toMatch(/^\d{15}$/u);
    expect(franchises![0]?.extras?.documents).toContain("ICE");
    expect(providers![0]?.extras?.documents).toContain("QUALIFICATION");
    expect(capacite![0]?.extras?.documentCode).toBeTruthy();
  });
});

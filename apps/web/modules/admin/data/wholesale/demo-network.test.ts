import { afterEach, describe, expect, it } from "vitest";
import {
  DEMO_BOX_SECTORS,
  DEMO_BOX_TERRITORIES,
  buildDemoWholesaleCatalog,
  demoNetworkSummary,
  isDemoWholesaleEnabled,
} from "./demo-network";
import { wholesaleCatalogSchema } from "./model";

afterEach(() => {
  delete process.env.MATRICIA_DEMO_ACCESS_ENABLED;
  delete process.env.MATRICIA_DEMO_PRODUCTION_ACCESS_ENABLED;
  delete process.env.APP_ENV;
  delete process.env.VERCEL_ENV;
});

describe("demo wholesale network", () => {
  it("reste désactivé hors environnement autorisé", () => {
    process.env.MATRICIA_DEMO_ACCESS_ENABLED = "true";
    process.env.APP_ENV = "production";
    expect(isDemoWholesaleEnabled()).toBe(false);
    process.env.MATRICIA_DEMO_PRODUCTION_ACCESS_ENABLED = "true";
    expect(isDemoWholesaleEnabled()).toBe(true);
  });

  it("couvre les 12 régions et les dossiers complets franchisé/ST", () => {
    process.env.APP_ENV = "development";
    process.env.MATRICIA_DEMO_ACCESS_ENABLED = "true";
    expect(isDemoWholesaleEnabled()).toBe(true);

    const summary = demoNetworkSummary();
    expect(summary.territories).toBe(12);
    expect(summary.sectors).toBe(10);
    expect(summary.providersPerFranchise).toBe(3);
    expect(summary.servicesPerProvider).toBe(3);
    expect(summary.documentsPerFranchisee).toBe(9);
    expect(summary.documentsPerProvider).toBe(9);
    expect(summary.totalOffers).toBe(12 * 10 * 3 * 3);

    const catalog = buildDemoWholesaleCatalog({ territoryCode: "CASABLANCA_SETTAT" });
    expect(wholesaleCatalogSchema.safeParse(catalog).success).toBe(true);
    expect(catalog.territories).toHaveLength(12);
    expect(catalog.offers.length).toBe(10 * 3 * 3);
    expect(catalog.actors.filter((actor) => actor.role === "FRANCHISEE")).toHaveLength(10);
    expect(catalog.actors.filter((actor) => actor.role === "PROVIDER")).toHaveLength(30);

    for (const actor of catalog.actors) {
      expect(actor.ice).toMatch(/^\d{15}$/u);
      expect(actor.documents.length).toBeGreaterThanOrEqual(9);
      expect(actor.documents.every((document) => document.status === "VERIFIED")).toBe(true);
      expect(actor.documents.some((document) => document.code === "ICE")).toBe(true);
      expect(actor.documents.some((document) => document.code === "RC")).toBe(true);
      expect(actor.documents.some((document) => document.code === "CIN_GERANT")).toBe(true);
      if (actor.role === "FRANCHISEE") {
        expect(actor.documents.some((document) => document.code === "FRANCHISE_CONTRACT")).toBe(true);
      } else {
        expect(actor.documents.some((document) => document.code === "RC_PRO")).toBe(true);
        expect(actor.documents.some((document) => document.code === "QUALIFICATION_DOSSIER")).toBe(true);
      }
    }

    for (const sector of DEMO_BOX_SECTORS) {
      const providers = new Set(
        catalog.offers.filter((item) => item.library_code === sector.code).map((item) => item.provider_organization_id),
      );
      expect(providers.size).toBe(3);
    }

    expect(DEMO_BOX_TERRITORIES.map((item) => item.code)).toContain("DAKHLA_OUED_ED_DAHAB");
  });

  it("filtre par sujet sans inventer d’offres hors territoire", () => {
    const empty = buildDemoWholesaleCatalog({ territoryCode: "ZZ_EMPTY" });
    expect(empty.offers).toHaveLength(0);
    expect(empty.actors).toHaveLength(0);

    const filtered = buildDemoWholesaleCatalog({ territoryCode: "RABAT_SALE_KENITRA", subject: "site" });
    expect(filtered.offers.length).toBeGreaterThan(0);
    expect(filtered.offers.every((item) => /site|موقع|WEB/iu.test(`${item.service_name_fr} ${item.sku_code}`))).toBe(true);
  });
});

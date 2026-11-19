import { afterEach, describe, expect, it } from "vitest";
import { adminFinanceDashboardSchema } from "@/modules/admin/data/finance/model";
import {
  adminCommerceCatalogSchema,
  adminDocumentVaultSchema,
  adminVolumeDemandSchema,
} from "@/modules/admin/data/catalog/model";
import {
  buildDemoCommandCenter,
  buildDemoCommerceCatalog,
  buildDemoDocumentVault,
  buildDemoFinanceDashboard,
  buildDemoOperationsDashboard,
  buildDemoVolumeDemand,
  canApplyAdminDemoHubs,
} from "./demo-hubs";
import { buildDemoSupervisionDashboard } from "./demo-supervision";

describe("demo hubs complets", () => {
  afterEach(() => {
    delete process.env.MATRICIA_DEMO_ACCESS_ENABLED;
    delete process.env.APP_ENV;
  });

  it("masque les hubs hors flag", () => {
    process.env.APP_ENV = "development";
    expect(canApplyAdminDemoHubs()).toBe(false);
    process.env.MATRICIA_DEMO_ACCESS_ENABLED = "true";
    expect(canApplyAdminDemoHubs()).toBe(true);
  });

  it("fournit un film parcours + hubs finance/pilotage/catalogue", () => {
    process.env.APP_ENV = "development";
    process.env.MATRICIA_DEMO_ACCESS_ENABLED = "true";
    const dash = buildDemoSupervisionDashboard();
    expect(dash.organizations.length).toBeGreaterThan(20);
    expect(dash.requests.length).toBe(12);
    expect(dash.quotes.length).toBe(12);
    expect(dash.contracts.length).toBe(12);
    // Variante démo : ≥1 contrat ACTIVE sans mission (prep) → 10 missions / 20 jalons.
    expect(dash.missions.length).toBe(10);
    expect(dash.milestones?.length).toBe(20);
    expect(dash.matching.length).toBe(12);
    expect(dash.diagnostics.length).toBe(12);
    expect(dash.quotes.some((item) => item.status === "SELECTED")).toBe(true);
    expect(dash.contracts.some((item) => item.status === "ACTIVE" && !item.mission_id)).toBe(true);
    expect(dash.amendments.every((item) => Boolean(item.object_fr) && Boolean(item.price_delta_minor))).toBe(true);
    expect(dash.requests.every((item) => Boolean(item.title_fr) && item.completeness_percent != null)).toBe(true);

    expect(buildDemoCommandCenter().workItems.length).toBe(12);
    expect(adminFinanceDashboardSchema.safeParse(buildDemoFinanceDashboard()).success).toBe(true);
    expect(adminCommerceCatalogSchema.safeParse(buildDemoCommerceCatalog()).success).toBe(true);
    expect(adminVolumeDemandSchema.safeParse(buildDemoVolumeDemand()).success).toBe(true);
    expect(adminDocumentVaultSchema.safeParse(buildDemoDocumentVault()).success).toBe(true);
    expect(buildDemoOperationsDashboard().events.length).toBeGreaterThan(0);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { demoRegionalSummary } from "@/app/[locale]/connexion/demo-regional-directory";
import { ADMIN_SPACE_IDS } from "./admin-nav";
import {
  buildDemoSpaceRows,
  canApplyAdminDemo,
  demoActorUsers,
  demoClientCases,
  demoComplianceCases,
  demoOrganizationFiche,
  listDemoSupervisionOrganizations,
} from "./demo-overlay";

describe("données démo admin Figma", () => {
  afterEach(() => {
    delete process.env.MATRICIA_DEMO_ACCESS_ENABLED;
    delete process.env.APP_ENV;
  });

  it("active le peuplement UI seulement hors production avec le flag démo", () => {
    process.env.APP_ENV = "development";
    process.env.MATRICIA_DEMO_ACCESS_ENABLED = "true";
    expect(canApplyAdminDemo()).toBe(true);
    process.env.APP_ENV = "production";
    expect(canApplyAdminDemo()).toBe(false);
  });

  it("remplit les organisations régionales et les tables de parcours", () => {
    const summary = demoRegionalSummary();
    const orgs = listDemoSupervisionOrganizations();
    expect(orgs).toHaveLength(summary.franchises + summary.providers + summary.clients);
    expect(orgs.some((row) => row.display_name === "Anfa Business Franchise")).toBe(true);
    expect(demoActorUsers()).toHaveLength(orgs.length);
    expect(demoClientCases().length).toBe(summary.clients);
    expect(demoComplianceCases().length).toBe(summary.clients);
    expect(demoOrganizationFiche(orgs[0]!.id)?.organization.display_name).toBe(orgs[0]!.display_name);
    for (const space of ADMIN_SPACE_IDS) {
      const rows = buildDemoSpaceRows("fr", space, "");
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0]?.cells.length).toBeGreaterThan(2);
      expect(JSON.stringify(rows).toLowerCase()).not.toContain("exemple illustratif");
    }
  });
});

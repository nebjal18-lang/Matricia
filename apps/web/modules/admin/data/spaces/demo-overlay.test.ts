import { afterEach, describe, expect, it } from "vitest";
import { ADMIN_SPACE_IDS } from "./admin-nav";
import {
  buildDemoSpaceRows,
  canApplyAdminDemo,
  demoActorUsers,
  demoClientCases,
  demoComplianceCases,
  demoOrganizationFiche,
  demoSupervisionOrganizations,
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

  it("remplit les organisations et les tables de parcours sans exemple illustratif", () => {
    const orgs = demoSupervisionOrganizations;
    expect(orgs.map((row) => row.display_name)).toEqual([
      "Studio Atlas",
      "Client · Communication",
      "Franchisé · Casablanca-Settat",
      "Conseil Anfa",
    ]);
    expect(demoActorUsers()).toHaveLength(4);
    expect(demoClientCases()[0]?.organizationName).toBe("Studio Atlas");
    expect(demoComplianceCases()[0]?.organizationName).toBe("Studio Atlas");
    expect(demoOrganizationFiche(demoSupervisionOrganizations[0]!.id)?.organization.display_name).toBe("Studio Atlas");
    for (const space of ADMIN_SPACE_IDS) {
      const rows = buildDemoSpaceRows("fr", space, "");
      expect(rows.length).toBe(4);
      expect(rows[0]?.cells.length).toBeGreaterThan(2);
      expect(JSON.stringify(rows).toLowerCase()).not.toContain("exemple illustratif");
    }
  });
});

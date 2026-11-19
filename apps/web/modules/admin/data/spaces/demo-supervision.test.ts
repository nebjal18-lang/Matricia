import { afterEach, describe, expect, it } from "vitest";
import { demoRegionalSummary } from "@/app/[locale]/connexion/demo-regional-directory";
import {
  buildDemoSupervisionDashboard,
  canApplyAdminDemoSupervision,
  replaceWithDemoSupervisionDashboard,
} from "./demo-supervision";

describe("demo supervision replace", () => {
  afterEach(() => {
    delete process.env.MATRICIA_DEMO_ACCESS_ENABLED;
    delete process.env.APP_ENV;
  });

  it("reste masqué hors flag / en production", () => {
    process.env.APP_ENV = "development";
    expect(canApplyAdminDemoSupervision()).toBe(false);
    process.env.MATRICIA_DEMO_ACCESS_ENABLED = "true";
    expect(canApplyAdminDemoSupervision()).toBe(true);
    process.env.APP_ENV = "production";
    expect(canApplyAdminDemoSupervision()).toBe(false);
  });

  it("remplace entièrement l’ancien snapshot par le catalogue régional", () => {
    process.env.APP_ENV = "development";
    process.env.MATRICIA_DEMO_ACCESS_ENABLED = "true";
    const summary = demoRegionalSummary();
    const stale = buildDemoSupervisionDashboard();
    stale.organizations = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        display_name: "Ancien seed",
        legal_name: "Ancien seed SARL",
        status: "ACTIVE",
        created_at: "2025-01-01T00:00:00.000Z",
        member_count: 9,
        open_requests: 9,
        open_disputes: 9,
      },
    ];
    const replaced = replaceWithDemoSupervisionDashboard(stale);
    expect(replaced.organizations).toHaveLength(
      summary.franchises + summary.providers + summary.clients,
    );
    expect(replaced.organizations.some((org) => org.display_name === "Ancien seed")).toBe(false);
  });

  it("renseigne l’identité légale complète sans champ à compléter", async () => {
    const { buildDemoOrganizationFiche } = await import("./demo-supervision");
    const org = buildDemoSupervisionDashboard().organizations.find(
      (row) => row.display_name === "Détroit Soft Services",
    );
    expect(org).toBeTruthy();
    const fiche = buildDemoOrganizationFiche(org!.id);
    const profile = fiche?.organization.client_legal_profile;
    expect(profile?.legal_form).toBe("SARL");
    expect(profile?.incorporation_date).toBe("2019-06-15");
    expect(profile?.activity).toContain("Prestations");
    expect(profile?.sector).toContain("Technologies");
    expect(profile?.registered_city).toBe("Tanger");
    expect(profile?.if_number).toMatch(/^\d{8}$/);
    expect(profile?.rc_number).toMatch(/^TAN\d{5}$/);
    expect(profile?.representative_name).toBe("Youssef Amrani");
    expect(fiche?.missions).toHaveLength(1);
    expect(fiche?.missions[0]?.as_provider).toBe(true);
    expect(fiche?.requests).toHaveLength(0);
    expect(fiche?.memberships).toHaveLength(2);
    expect(fiche?.memberships[0]?.display_name).toBe("Youssef Amrani");
    expect(fiche?.memberships[0]?.email).toContain("@");
    expect(fiche?.memberships[0]?.roles).toContain("PROVIDER_ADMIN");
    expect(fiche?.memberships[1]?.status).toBe("INVITED");
    expect(fiche?.memberships[1]?.display_name).toBe("Nada El Fassi");
  });
});

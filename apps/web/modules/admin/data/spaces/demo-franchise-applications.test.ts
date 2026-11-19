import { afterEach, describe, expect, it } from "vitest";
import {
  isFranchiseApplicationFixture,
  isFranchiseApplicationTreat,
} from "@/modules/admin/screens/franchise-applications/model";
import {
  buildDemoFranchiseApplicationOrganizationNames,
  buildDemoFranchiseApplications,
  canApplyAdminDemoFranchiseApplications,
} from "./demo-franchise-applications";

describe("demo franchise applications", () => {
  afterEach(() => {
    delete process.env.MATRICIA_DEMO_ACCESS_ENABLED;
    delete process.env.APP_ENV;
  });

  it("reste masqué hors flag / en production", () => {
    process.env.APP_ENV = "development";
    expect(canApplyAdminDemoFranchiseApplications()).toBe(false);
    process.env.MATRICIA_DEMO_ACCESS_ENABLED = "true";
    expect(canApplyAdminDemoFranchiseApplications()).toBe(true);
    process.env.APP_ENV = "production";
    expect(canApplyAdminDemoFranchiseApplications()).toBe(false);
  });

  it("produit une file non vide de dossiers ouverts @matricia.test", () => {
    const rows = buildDemoFranchiseApplications();
    expect(rows.length).toBeGreaterThanOrEqual(4);
    expect(rows.every((row) => row.reply_email.endsWith("@matricia.test"))).toBe(true);
    expect(rows.every((row) => !isFranchiseApplicationFixture(row))).toBe(true);
    expect(rows.every((row) => isFranchiseApplicationTreat(row.status))).toBe(true);
    expect(rows.some((row) => row.status === "REGISTERED")).toBe(true);
    expect(rows.some((row) => row.status === "COMPANY_REVIEW")).toBe(true);
    expect(rows.some((row) => row.status === "DOCUMENT_REVIEW")).toBe(true);
    expect(rows.some((row) => row.status === "CONTRACT_PENDING")).toBe(true);
    expect(rows.some((row) => row.domain_label.startsWith("IT —"))).toBe(true);
    expect(rows.every((row) => row.status !== "ACTIVE")).toBe(true);
  });

  it("rattache des organisations régionales cohérentes quand le statut le demande", () => {
    const rows = buildDemoFranchiseApplications();
    const linked = rows.filter((row) => row.organization_id);
    expect(linked.length).toBeGreaterThanOrEqual(3);
    const names = buildDemoFranchiseApplicationOrganizationNames();
    for (const row of linked) {
      expect(names.get(row.organization_id!)).toBeTruthy();
    }
    const pending = rows.find((row) => row.status === "CONTRACT_PENDING");
    expect(pending?.franchise_id).toBeTruthy();
    expect(pending?.organization_id).toBeTruthy();
  });
});

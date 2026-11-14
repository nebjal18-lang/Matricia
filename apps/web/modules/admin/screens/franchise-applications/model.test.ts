import { describe, expect, it } from "vitest";
import {
  filterFranchiseApplications,
  isFranchiseApplicationFixture,
  isFranchiseApplicationSettled,
  isFranchiseApplicationTreat,
  organizationDisplayName,
} from "./model";

const base = {
  id: "11111111-1111-4111-8111-111111111111",
  applicant_name: "Hatim Ahmitech",
  reply_email: "parcours.franchise@matricia.test",
  territory_code: "CASABLANCA_SETTAT",
  domain_label: "IT — Informatique",
  status: "ACTIVE",
  organization_id: "22222222-2222-4222-8222-222222222222",
  franchise_id: "33333333-3333-4333-8333-333333333333",
  row_version: 1,
  created_at: "2026-11-01T10:00:00.000Z",
};

describe("franchise application queue model", () => {
  it("flags fixtures and keeps operational demo accounts", () => {
    expect(isFranchiseApplicationFixture({ ...base, reply_email: "audit.franchise.20261105@example.com", applicant_name: "TEST AUDIT" })).toBe(true);
    expect(isFranchiseApplicationFixture({ ...base, reply_email: "candidat.verification@example.invalid" })).toBe(true);
    expect(isFranchiseApplicationFixture(base)).toBe(false);
  });

  it("filters treat queue and hides fixtures by default", () => {
    const rows = [
      base,
      { ...base, id: "44444444-4444-4444-8444-444444444444", status: "REGISTERED", franchise_id: null, organization_id: null, reply_email: "ok@matricia.test", applicant_name: "Candidat OK" },
      { ...base, id: "55555555-5555-4555-8555-555555555555", status: "REGISTERED", franchise_id: null, organization_id: null, reply_email: "audit@example.com", applicant_name: "TEST AUDIT" },
    ];
    const filtered = filterFranchiseApplications(rows, { vue: "treat" });
    expect(filtered.hiddenFixtures).toBe(1);
    expect(filtered.treatCount).toBe(1);
    expect(filtered.visible.map((row) => row.applicant_name)).toEqual(["Candidat OK"]);
  });

  it("labels organizations honestly", () => {
    expect(organizationDisplayName(null, new Map(), "fr")).toEqual({ linked: false, label: "Non liée" });
    expect(organizationDisplayName("22222222-2222-4222-8222-222222222222", new Map([["22222222-2222-4222-8222-222222222222", "Ahmitech"]]), "fr")).toEqual({ linked: true, label: "Ahmitech" });
    expect(organizationDisplayName("22222222-2222-4222-8222-222222222222", new Map(), "fr")).toEqual({ linked: true, label: "Nom indisponible" });
  });

  it("marks settled and treat statuses", () => {
    expect(isFranchiseApplicationSettled("ACTIVE")).toBe(true);
    expect(isFranchiseApplicationTreat("ACTIVE")).toBe(false);
    expect(isFranchiseApplicationTreat("CONTRACT_PENDING")).toBe(true);
  });
});

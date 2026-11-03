import { describe, expect, it } from "vitest";
import type { AdminWorkItem } from "./model";
import { dossierHref, summarizeAdminWork } from "./view-model";
const base: AdminWorkItem = { id: "1", queueKey: "OPS", queueLabelFr: "Ops", queueLabelAr: "عمليات", organizationId: null, sourceKind: "EXCEPTION", resourceType: "case", resourceId: "1", titleFr: "Cas", titleAr: "حالة", priority: "LOW", status: "OPEN", dueAt: "2026-09-13T12:00:00Z", assignedTo: null, rowVersion: 1 };
describe("summarizeAdminWork", () => {
  it("priorise le jour et la criticité", () => {
    const summary = summarizeAdminWork([base, { ...base, id: "2", priority: "CRITICAL", sourceKind: "RISK_FLAG", dueAt: "2026-09-12T11:00:00Z" }, { ...base, id: "3", priority: "HIGH", dueAt: "2026-09-12T15:00:00Z" }], "2026-09-12T14:00:00Z");
    expect(summary.ordered.map((item) => item.id)).toEqual(["2", "3", "1"]);
    expect(summary).toMatchObject({ critical: 1, overdue: 1, dueToday: 2, humanReview: 1, exceptions: 2 });
  });
});
describe("dossierHref", () => {
  it.each(["fr", "ar"] as const)("opens the governed plan and responsible member in %s", locale => {
    expect(dossierHref(locale, { ...base, resourceType: "franchise_control_plan_owner", resourceId: "a3731000-0000-4000-8000-000000000001" })).toBe(`/${locale}/administration/gouvernance-franchise/plans/a3731000-0000-4000-8000-000000000001/responsable`);
  });
  it.each(["fr", "ar"] as const)("opens the private purpose-bound review in %s", locale => {
    expect(dossierHref(locale, { ...base, resourceType: "franchise_governance_signal_review", resourceId: "a3711000-0000-4000-8000-000000000001" })).toBe(`/${locale}/administration/gouvernance-franchise/signalements/a3711000-0000-4000-8000-000000000001`);
  });
  it("ouvre l’espace métier du dossier, pas le seul centre de commandement", () => {
    expect(dossierHref("fr", { ...base, resourceType: "MISSION_DISPUTE", resourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })).toBe("/fr/administration/litiges/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(dossierHref("fr", { ...base, resourceType: "SERVICE_REQUEST", resourceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" })).toBe("/fr/administration/demandes/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(dossierHref("ar", { ...base, sourceKind: "FINANCE", resourceType: "PAYMENT_INTENT" })).toBe("/ar/administration/finance");
    expect(dossierHref("fr", { ...base, organizationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" })).toBe("/fr/administration/entreprises/cccccccc-cccc-4ccc-8ccc-cccccccccccc");
  });
});

describe("severity before deadline", () => {
  it("keeps an overdue critical alert ahead of today's low priority task without mutating input", () => {
    const items = [
      { ...base, id: "low", priority: "LOW" as const, dueAt: "2026-11-03T10:00:00Z" },
      { ...base, id: "critical", priority: "CRITICAL" as const, dueAt: "2026-11-02T10:00:00Z" },
      { ...base, id: "older", priority: "LOW" as const, dueAt: "2026-11-01T10:00:00Z" },
    ];
    const summary = summarizeAdminWork(items, "2026-11-03T11:00:00Z");
    expect(summary.ordered.map(item => item.id)).toEqual(["critical", "older", "low"]);
    expect(items.map(item => item.id)).toEqual(["low", "critical", "older"]);
    expect(summary).toMatchObject({ critical: 1, overdue: 3, dueToday: 1 });
  });

  it("counts today's tasks using the Moroccan date across UTC midnight", () => {
    const summary = summarizeAdminWork([
      { ...base, dueAt: "2026-11-02T23:30:00Z" },
      { ...base, id: "next", dueAt: "2026-11-03T23:30:00Z" },
    ], "2026-11-03T00:15:00Z");
    expect(summary.dueToday).toBe(1);
    expect(summary.overdue).toBe(1);
  });
});

for (const locale of ["fr", "ar"] as const) {
  describe(`typed dossier links in ${locale}`, () => {
    it.each([
      ["QUOTE", "devis"], ["MATCHING_RUN", "matching"], ["MISSION_MILESTONE", "jalons"],
      ["CONTRACT_AMENDMENT", "avenants"], ["MILESTONE", "jalons"], ["AMENDMENT", "avenants"],
      ["PROVIDER_DOCUMENT_VERSION", "documents"], ["SERVICE_REQUEST", "demandes"],
    ])("opens %s in its own projection", (resourceType, space) => {
      expect(dossierHref(locale, { ...base, resourceType, resourceId: "resource-1" })).toBe(`/${locale}/administration/${space}/resource-1`);
    });
    it.each([
      ["RFQ", "matching"], ["RFQ_PROVIDER", "matching"], ["DELIVERABLE", "missions"],
      ["MISSION_DELIVERABLE", "missions"], ["QUOTE_VERSION", "devis"], ["CONTRACT_VERSION", "contrats"],
      ["PROVIDER_DOCUMENT", "documents"],
    ])("does not reinterpret a %s ID as its parent", (resourceType, space) => {
      expect(dossierHref(locale, { ...base, resourceType })).toBe(`/${locale}/administration/${space}`);
    });
    it("preserves only organization context, encoding resource path delimiters", () => {
      const href = dossierHref(locale, { ...base, resourceType: "QUOTE", resourceId: "quote/part?x=1#fragment" }, "?organizationId=org-1&q=old&actionPage=3&actionStatus=FAILED");
      expect(href).toBe(`/${locale}/administration/devis/quote%2Fpart%3Fx%3D1%23fragment?organizationId=org-1`);
    });
    it.each(["", ".", ".."]) ("never builds a navigable dot segment for %s", resourceId => {
      expect(dossierHref(locale, { ...base, resourceType: "QUOTE", resourceId })).toBe(`/${locale}/administration/command-center`);
    });
    it.each(["constructor", "toString", "unrecognized_quote_record"])("does not guess a detail route for %s", resourceType => {
      expect(dossierHref(locale, { ...base, resourceType })).toBe(`/${locale}/administration/command-center`);
    });
  });
}

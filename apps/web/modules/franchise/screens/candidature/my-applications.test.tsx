import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { MyFranchiseApplication } from "@/modules/franchise/data/candidature/repository";

vi.mock("./actions", () => ({ linkMyFranchiseApplicationOrganization: vi.fn() }));
import { MyFranchiseApplications } from "./my-applications";

const base: MyFranchiseApplication = {
  id: "00000000-0000-4000-8000-000000000001",
  reference: "A1B2C3D4",
  status: "REGISTERED",
  territoryCode: "CASABLANCA_SETTAT",
  domainLabel: "IT — Informatique",
  organizationId: null,
  organizationName: null,
  invitationId: null,
  rowVersion: 1,
  createdAt: "2026-11-01T10:00:00Z",
};

describe("MyFranchiseApplications", () => {
  it("lets the candidate link an owned company or create one", () => {
    const html = renderToStaticMarkup(<MyFranchiseApplications locale="fr" applications={[base]} organizations={[{ id: "00000000-0000-4000-8000-000000000002", name: "Ahmitech SARL" }]} idempotencyKeys={{}} />);
    expect(html).toContain("A1B2C3D4");
    expect(html).toContain("Inscrit");
    expect(html).toContain("Ahmitech SARL");
    expect(html).toContain("Rattacher cette société au dossier");
    expect(html).toContain("/fr/organisation?role=franchise&amp;next=%2Ffr%2Ffranchise%2Fcandidature");
  });

  it("opens activation once the mandate is approved", () => {
    const html = renderToStaticMarkup(<MyFranchiseApplications locale="ar" applications={[{ ...base, status: "LIBRARY_ASSIGNED", organizationId: "00000000-0000-4000-8000-000000000002", organizationName: "Ahmitech", invitationId: "00000000-0000-4000-8000-000000000009" }]} organizations={[]} idempotencyKeys={{}} />);
    expect(html).toContain("تفعيل تفويضي");
    expect(html).toContain("/ar/franchise/invitations/00000000-0000-4000-8000-000000000009");
    expect(html).not.toContain("ربط هذه الشركة بالملف");
  });

  it("points an active franchisee to the franchise space", () => {
    const html = renderToStaticMarkup(<MyFranchiseApplications locale="fr" applications={[{ ...base, status: "ACTIVE", organizationId: "00000000-0000-4000-8000-000000000002" }]} organizations={[]} idempotencyKeys={{}} />);
    expect(html).toContain("/fr/franchise/accueil");
  });

  it("renders nothing without a dossier", () => {
    expect(renderToStaticMarkup(<MyFranchiseApplications locale="fr" applications={[]} organizations={[]} idempotencyKeys={{}} />)).toBe("");
  });
});

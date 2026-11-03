import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  createSite: vi.fn(),
  createProject: vi.fn(),
  saveTask: vi.fn(),
  saveBudget: vi.fn(),
  createCostCenter: vi.fn(),
  recordAllocation: vi.fn(),
  scheduleEvent: vi.fn(),
  linkContract: vi.fn(),
}));
vi.mock("@/modules/shared/ui/badge", () => ({ Badge: (props: React.HTMLAttributes<HTMLSpanElement>) => <span {...props} /> }));
vi.mock("@/modules/shared/ui/button", () => ({ Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} /> }));
vi.mock("@/modules/shared/ui/card", () => ({
  Card: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  CardHeader: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  CardTitle: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h3 {...props} />,
  CardDescription: (props: React.HTMLAttributes<HTMLParagraphElement>) => <p {...props} />,
  CardContent: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
}));
vi.mock("@/modules/shared/ui/input", () => ({ Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} /> }));
vi.mock("@/modules/shared/ui/textarea", () => ({ Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} /> }));

import { PortfolioPanel } from "./portfolio-panel";
import { getMessages } from "./messages";
import type { Portfolio } from "@/modules/client/data/portfolio/model";

const org = "11111111-1111-4111-8111-111111111111";
const site = "22222222-2222-4222-8222-222222222222";
const project = "33333333-3333-4333-8333-333333333333";
const budget = "44444444-4444-4444-8444-444444444444";
const center = "55555555-5555-4555-8555-555555555555";

const data: Portfolio = {
  organizations: [{ id: org, name: "Entreprise Test", capabilities: ["READ", "MANAGE_PORTFOLIO", "MANAGE_BUDGET"] }],
  sites: [{ id: site, organizationId: org, code: "CASABLANCA_HQ", nameFr: "Siège Casablanca", nameAr: "مقر الدار البيضاء" }],
  projects: [{ id: project, organizationId: org, code: "P1", siteId: site, status: "ACTIVE", version: 1, rowVersion: 1, progressBasisPoints: 8520, nameFr: "Conformité", nameAr: "امتثال", descriptionFr: "Mettre en conformité le SI.", descriptionAr: "امتثال النظام.", startedOn: "2026-01-01", targetEndOn: "2026-12-31" }],
  contracts: [],
  tasks: [],
  budgets: [{ id: budget, organizationId: org, fiscalYear: 2026, currency: "MAD", libraryId: null, siteId: site, projectId: project, status: "APPROVED", version: 1, amountMinor: "1000000", approvedAmountMinor: "1000000" }],
  costCenters: [{ id: center, organizationId: org, code: "IT", status: "ACTIVE", version: 1, nameFr: "Informatique", nameAr: "المعلوميات" }],
  allocations: [{ id: "66666666-6666-4666-8666-666666666666", organizationId: org, costCenterId: center, budgetId: budget, projectId: project, type: "ACTUAL", amountMinor: "800000", currency: "MAD", createdAt: "2026-04-01" }],
  calendar: [{ organizationId: org, projectId: project, itemId: "77777777-7777-4777-8777-777777777777", sourceKind: "RFQ_DEADLINE", eventType: "QUOTE", titleFr: "Date limite de remise des devis", titleAr: "الموعد النهائي", startsAt: "2026-10-01T00:00:00Z", endsAt: null, status: "OPEN", occursOn: null, allDay: false }],
  libraries: [],
};

it.each(["fr", "ar"] as const)("uses business choices and a real evidence file (%s)", locale => {
 const html=renderToStaticMarkup(<PortfolioPanel locale={locale} data={data} m={getMessages(locale)} keys={{site:"a",project:"b",task:"c",contract:"d",budget:"e",center:"f",allocation:"g",event:"h"}} />);
 expect(html).toContain('name="referenceChoice"');expect(html).toContain(`value="PROJECT:${project}"`);
 expect(html).toContain('name="evidenceFile"');expect(html).not.toContain('name="evidenceHash"');expect(html).not.toContain('name="referenceId"');
 expect(html).not.toContain('>COMMITMENT<');expect(html).not.toContain('>PROJECT_TASK<');
});

describe("PortfolioPanel", () => {
  it("shows sites, integer progress and a consumption alert without placeholders", () => {
    const html = renderToStaticMarkup(
      <PortfolioPanel
        locale="fr"
        data={data}
        m={getMessages("fr")}
        embedded
        keys={{ site: "a", project: "b", task: "c", contract: "d", budget: "e", center: "f", allocation: "g", event: "h" }}
      />,
    );
    expect(html).toContain("Siège Casablanca");
    expect(html).toContain("Créer un site");
    expect(html).toContain("85 %");
    expect(html).toContain("Seuil d’attention atteint");
    expect(html).toContain("Échéance devis");
    expect(html).toContain("Actif");
    expect(html).not.toContain("toFixed");
    expect(html).not.toMatch(/exemple illustratif/i);
    expect(html).not.toContain("placeholder=");
  });
});

it.each(["fr", "ar"] as const)("keeps native invoice targets and uses business history labels (%s)", locale => {
 const invoice="99999999-9999-4999-8999-999999999999";
 const html=renderToStaticMarkup(<PortfolioPanel locale={locale} data={{...data,allocationTargets:[{id:invoice,organizationId:org,type:"INVOICE",labelFr:"Facture liée au projet",labelAr:"فاتورة مرتبطة بالمشروع"}]}} m={getMessages(locale)} keys={{site:"a",project:"b",task:"c",contract:"d",budget:"e",center:"f",allocation:"g",event:"h"}} />);
 expect(html).toContain(`value="INVOICE:${invoice}"`);expect(html).not.toContain("ACTUAL ·");expect(html).toContain(locale==="ar"?"نفقة فعلية":"Dépense réalisée");
});

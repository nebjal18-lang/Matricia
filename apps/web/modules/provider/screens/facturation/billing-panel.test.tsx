import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { BillingDashboard } from "@/modules/provider/data/billing/model";
import { BillingPanel } from "./billing-panel";
import { getBillingMessages } from "./messages";

vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn()})}));
vi.mock("./actions", () => ({
  issueInvoice: async () => ({ status: "idle" }),
  issueStatement: async () => ({ status: "idle" }),
  reconcilePayment: async () => ({ status: "idle" }),
  recordPayable: async () => ({ status: "idle" }),
  recordPayment: async () => ({ status: "idle" }),
  requestPaymentPlan: async () => ({ status: "idle" }),
}));

const dashboard: BillingDashboard = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  organizationName: "Prestataire 167",
  payables: [],
  statements: [],
  invoices: [{
    id: "22222222-2222-4222-8222-222222222222",
    number: "INV-OVERDUE-167",
    currency: "MAD",
    totalMinor: "1200",
    paidMinor: "0",
    outstandingMinor: "1200",
    creditedMinor: "0",
    paymentStatus: "OVERDUE",
    dueOn: "2026-09-13",
  }],
  payments: [],
  allocations: [],
  accounts: [],
  creditNotes: [],
  paymentPlans: [],
};

describe("BillingPanel overdue hold", () => {
  it("alerte le prestataire sans inventer un arrêt de mission", () => {
    const html = renderToStaticMarkup(
      <BillingPanel
        dashboard={dashboard}
        missions={[]}
        locale="fr"
        m={getBillingMessages("fr")}
        keys={["a", "b", "c", "d", "e", "f"]}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("nouvelles consultations");
    expect(html).toContain("missions en cours continuent");
    expect(html).toContain("Échéance dépassée");
    expect(html).not.toMatch(/\bTODO\b|\bFIXME\b/);
  });
});

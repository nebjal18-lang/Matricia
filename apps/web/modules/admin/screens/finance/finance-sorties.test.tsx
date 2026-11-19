import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AdminFinanceDashboard } from "@/modules/admin/data/finance/model";
import { FinanceSorties } from "./finance-sorties";
import { getAdminFinanceMessages } from "./messages";

const dashboard: AdminFinanceDashboard = {
  as_of: "2026-09-18T12:00:00.000Z",
  payment_intents: [],
  payment_events: [],
  subscriptions: [],
  cycles: [],
  provider_payments: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      organization_id: "22222222-2222-4222-8222-222222222222",
      organization_name: "Prestataire Atlas",
      payment_reference: "PAY-88",
      currency: "MAD",
      amount_minor: "150000",
      allocated_minor: "50000",
      unallocated_minor: "100000",
      paid_on: "2026-09-10",
    },
  ],
  provider_invoices: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      organization_id: "22222222-2222-4222-8222-222222222222",
      organization_name: "Prestataire Atlas",
      invoice_number: "INV-12",
      currency: "MAD",
      total_minor: "200000",
      paid_minor: "50000",
      outstanding_minor: "150000",
      payment_status: "PARTIALLY_PAID",
      due_on: "2026-09-30",
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      organization_id: "55555555-5555-4555-8555-555555555555",
      organization_name: "Prestataire Rif",
      invoice_number: "INV-closed",
      currency: "MAD",
      total_minor: "80000",
      paid_minor: "80000",
      outstanding_minor: "0",
      payment_status: "PAID",
      due_on: "2026-08-01",
    },
  ],
};

describe("FinanceSorties", () => {
  it("affiche les sorties du ledger sans inventer de dépense", () => {
    const html = renderToStaticMarkup(
      createElement(FinanceSorties, { locale: "fr", dashboard, m: getAdminFinanceMessages("fr") }),
    );
    expect(html).toContain("Argent sortant");
    expect(html).toContain("INV-12");
    expect(html).toContain("PAY-88");
    expect(html).toContain("Prestataire Atlas");
    expect(html).not.toContain("INV-closed");
    expect(html).not.toMatch(/saisir une dépense|nouvelle dépense|créer une dépense/i);
  });

  it("reste lisible en arabe et signale l’absence de sorties", () => {
    const empty: AdminFinanceDashboard = { ...dashboard, provider_payments: [], provider_invoices: [] };
    const html = renderToStaticMarkup(
      createElement(FinanceSorties, { locale: "ar", dashboard: empty, m: getAdminFinanceMessages("ar") }),
    );
    expect(html).toContain("الأموال الخارجة");
    expect(html).toContain("لا يوجد شيء حالياً.");
    expect(html).toContain('role="status"');
  });
});

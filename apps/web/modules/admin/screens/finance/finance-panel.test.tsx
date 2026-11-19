import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AdminFinanceDashboard } from "@/modules/admin/data/finance/model";
import { FinancePanel } from "./finance-panel";
import { getAdminFinanceMessages } from "./messages";

vi.mock("./actions", () => ({
  reconcilePaymentAction: async () => ({ status: "idle" }),
}));

const id = "11111111-1111-4111-8111-111111111111";
const org = "22222222-2222-4222-8222-222222222222";

const dashboard: AdminFinanceDashboard = {
  as_of: "2026-09-18T12:00:00.000Z",
  payment_intents: [{
    id,
    organization_id: org,
    organization_name: "Client Atlas",
    plan_version_id: id,
    billing_interval: "MONTHLY",
    gateway: "DEMO",
    amount_minor: "12000",
    currency: "MAD",
    status: "PENDING_VERIFICATION",
    created_at: "2026-09-17T10:00:00.000Z",
  }],
  payment_events: [{
    id: "1",
    payment_intent_id: id,
    organization_id: org,
    organization_name: "Client Atlas",
    gateway: "DEMO",
    event_type: "PAYMENT_SUCCEEDED",
    amount_minor: "12000",
    currency: "MAD",
    paid_at: "2026-09-17T11:00:00.000Z",
    received_at: "2026-09-17T11:00:00.000Z",
  }],
  subscriptions: [{
    id: "55555555-5555-4555-8555-555555555555",
    organization_id: org,
    organization_name: "Client Atlas",
    status: "ACTIVE",
    plan_code: "PREMIUM",
    billing_interval: "MONTHLY",
    current_period_start: "2026-09-01T00:00:00.000Z",
    current_period_end: "2026-10-01T00:00:00.000Z",
    pending_plan_version_id: null,
    pending_change_effective_at: null,
    row_version: "1",
    updated_at: "2026-09-17T11:00:00.000Z",
  }],
  cycles: [],
  provider_payments: [{
    id: "33333333-3333-4333-8333-333333333333",
    organization_id: org,
    organization_name: "Prestataire Atlas",
    payment_reference: "PAY-88",
    currency: "MAD",
    amount_minor: "150000",
    allocated_minor: "50000",
    unallocated_minor: "100000",
    paid_on: "2026-09-10",
  }],
  provider_invoices: [{
    id: "44444444-4444-4444-8444-444444444444",
    organization_id: org,
    organization_name: "Prestataire Atlas",
    invoice_number: "INV-12",
    currency: "MAD",
    total_minor: "200000",
    paid_minor: "50000",
    outstanding_minor: "150000",
    payment_status: "PARTIALLY_PAID",
    due_on: "2026-09-30",
  }],
};

describe("FinancePanel mockup board", () => {
  it("montre KPI, file à traiter, rail rapprochement, sorties et historique", () => {
    const html = renderToStaticMarkup(
      createElement(FinancePanel, {
        locale: "fr",
        dashboard,
        m: getAdminFinanceMessages("fr"),
        identity: { idempotencyKey: id, correlationId: id },
      }),
    );
    expect(html).toContain("admin-finance-kpi");
    expect(html).toContain("Encaissements du jour");
    expect(html).toContain("Prestataires à payer");
    expect(html).toContain("Paiements à rapprocher");
    expect(html).toContain("À traiter aujourd’hui");
    expect(html).toContain("Entrées");
    expect(html).toContain("Sorties");
    expect(html).toContain("admin-org-layout");
    expect(html).toContain("admin-treat-rail");
    expect(html).toContain("Valider le rapprochement");
    expect(html).toContain("Argent sortant");
    expect(html).toContain("INV-12");
    expect(html).toContain("Historique et abonnements");
    expect(html).toContain("Paiements déjà validés");
  });
});

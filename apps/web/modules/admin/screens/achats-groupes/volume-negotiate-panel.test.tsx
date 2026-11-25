import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AdminVolumeDashboard } from "@/modules/admin/data/volume/model";
import { VolumeNegotiatePanel } from "./volume-negotiate-panel";

vi.mock("@/modules/admin/screens/finance/commerce-actions", () => ({
  commerceIdle: { status: "idle" },
  createFrameworkAction: async () => ({ status: "idle" }),
  activateFrameworkPoolAction: async () => ({ status: "idle" }),
}));

const dashboard: AdminVolumeDashboard = {
  generated_at: "2026-09-21T10:00:00.000Z",
  capabilities: { can_allocate: true, can_consume: true, can_negotiate: true, can_activate_pool: true },
  summary: { pool_count: 0, active_pool_count: 0, low_stock_count: 0, open_reservation_count: 0, client_count: 0, provider_count: 0, draft_agreement_count: 1 },
  pools: [],
  reservations: [],
  commitments: [],
  allocations: [],
  agreements: [{
    id: "11111111-1111-4111-8111-111111111111",
    agreement_code: "VOL_IT_2026",
    status: "DRAFT",
    sku_code: "IT_HOUR",
    currency: "MAD",
    valid_from: "2026-10-01",
    valid_to: "2026-12-31",
    forecast_units: "100",
    payment_model: "PAY_PER_USE",
    owner_organization_id: "22222222-2222-4222-8222-222222222222",
    agreement_version_id: "33333333-3333-4333-8333-333333333333",
    minimum_commitment_units: "0",
    maximum_units: "120",
    pool_id: null,
    pool_status: null,
  }],
  skus: [{ id: "44444444-4444-4444-8444-444444444444", code: "IT_HOUR", unit_code: "HOUR", currency: "MAD", reference_cost_minor: "25000" }],
  profitability: [],
};

describe("VolumeNegotiatePanel", () => {
  it("expose la commande d’activation de pool à partir d’un contrat brouillon", () => {
    const html = renderToStaticMarkup(
      <VolumeNegotiatePanel
        locale="fr"
        dashboard={dashboard}
        ownerOrganizationId="22222222-2222-4222-8222-222222222222"
        keys={{ negotiate: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", activate: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }}
      />,
    );
    expect(html).toContain("VOL_IT_2026");
    expect(html).toContain("Activer le contrat et ouvrir le stock");
    expect(html).not.toMatch(/\bTODO\b|\bFIXME\b|\bPOOL_ACTIVE\b/);
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AdminBoxesDashboard } from "@/modules/admin/data/boxes/model";
import { BoxesPanel } from "./boxes-panel";
import { getCommerceMessages } from "./commerce-messages";

vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn()})}));

vi.mock("./commerce-actions", () => ({
  commerceIdle: { status: "idle" },
  createBenefitAction: async () => ({ status: "idle" }),
  activateBenefitAction: async () => ({ status: "idle" }),
  createBoxAction: async () => ({ status: "idle" }),
  activateBoxAction: async () => ({ status: "idle" }),
  linkPlanBoxAction: async () => ({ status: "idle" }),
  issueCreditsAction: async () => ({ status: "idle" }),
  ensureWalletAction: async () => ({ status: "idle" }),
}));

const dashboard: AdminBoxesDashboard = {
  generated_at: "2026-09-21T08:00:00.000Z",
  capabilities: { can_write: true, can_activate: true },
  benefits: [{
    id: "11111111-1111-4111-8111-111111111111",
    benefit_id: "22222222-2222-4222-8222-222222222222",
    code: "CONSULT_IT",
    version: 1,
    status: "DRAFT",
    benefit_type: "CONSULTATION",
    fulfillment_mode: "RFQ",
    name_fr: "Consultation",
    name_ar: "استشارة",
    credit_cost: "10",
    reference_value_minor: "10000",
    internal_cost_minor: "4000",
    currency: "MAD",
    effective_from: "2026-09-21T00:00:00.000Z",
  }],
  boxes: [{
    id: "33333333-3333-4333-8333-333333333333",
    box_id: "44444444-4444-4444-8444-444444444444",
    code: "GOLD_BOX",
    version: 1,
    status: "DRAFT",
    box_type: "SEMI_CUSTOM",
    name_fr: "Box Gold",
    name_ar: "صندوق ذهب",
    credit_budget: "100",
    cost_low_minor: "1000",
    cost_expected_minor: "2000",
    cost_full_minor: "5000",
    currency: "MAD",
    approval_reference: null,
    effective_from: "2026-09-21T00:00:00.000Z",
    needs_approval: true,
    slots: [{ id: "55555555-5555-4555-8555-555555555555", slot_code: "CORE", slot_kind: "MANDATORY", minimum_selections: 1, maximum_selections: 1 }],
  }],
  plan_matrix: [],
  plans: [],
  wallets: [{
    wallet_id: "66666666-6666-4666-8666-666666666666",
    organization_id: "77777777-7777-4777-8777-777777777777",
    organization_name: "Client Atlas",
    wallet_type: "CLIENT",
    balance: "12",
  }],
  lots: [],
  redemptions: [],
};

describe("BoxesPanel", () => {
  it("affiche le catalogue, l’alerte de coût et les commandes versionnées", () => {
    const html = renderToStaticMarkup(
      <BoxesPanel
        locale="fr"
        dashboard={dashboard}
        m={getCommerceMessages("fr")}
        auditOrganizationId="77777777-7777-4777-8777-777777777777"
        keys={{ benefit: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", activateBenefit: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", box: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", activateBox: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", link: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", wallet: "ffffffff-ffff-4fff-8fff-ffffffffffff", credits: "99999999-9999-4999-8999-999999999999" }}
      />,
    );
    expect(html).toContain("Box Gold");
    expect(html).toContain("Approbation requise avant publication");
    expect(html).toContain("Ajouter un service (avantage)");
    expect(html).toContain("offre unique");
    expect(html).toContain("1. Services de l’offre");
    expect(html).toContain("2. Offre Box multi-services");
    expect(html).toContain("3. Lien plan ↔ Box");
    expect(html).toContain("4. Ouvrir le compte crédits de l’entreprise");
    expect(html).toContain("Composer l’offre : plusieurs services");
    expect(html).toContain('name="slotsJson"');
    expect(html).toContain("Service / catégorie");
    expect(html).toContain("/fr/administration/finance/credits?organizationId=");
    expect(html).toContain("Attributions de crédits et journal");
    expect(html).not.toContain("Attributions de crédits sous double contrôle");
    expect(html).not.toContain("Crédits du cycle d’abonnement payé");
    expect(html).toContain("/fr/administration/avantages/regles");
    expect(html).toContain("/fr/administration/avantages/livraisons");
    expect(html).toContain('data-state="current"');
    expect(html).not.toContain("v{item.version}");
    expect(html).not.toContain('value="SUBSCRIPTION_GRANT"');
    expect(html).not.toMatch(/\bTODO\b|\bFIXME\b/);
    expect(html).not.toMatch(/placeholder="/i);
  });

  it("place l’ouverture du compte crédits après le catalogue, sans attributions", () => {
    const html = renderToStaticMarkup(
      <BoxesPanel
        locale="fr"
        dashboard={dashboard}
        m={getCommerceMessages("fr")}
        auditOrganizationId="77777777-7777-4777-8777-777777777777"
        keys={{ benefit: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", activateBenefit: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", box: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", activateBox: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", link: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", wallet: "ffffffff-ffff-4fff-8fff-ffffffffffff", credits: "99999999-9999-4999-8999-999999999999" }}
      />,
    );
    const services = html.indexOf("1. Services de l’offre");
    const offer = html.indexOf("2. Offre Box multi-services");
    const lien = html.indexOf("3. Lien plan");
    const wallet = html.indexOf("4. Ouvrir le compte crédits");
    expect(services).toBeGreaterThan(-1);
    expect(offer).toBeGreaterThan(services);
    expect(lien).toBeGreaterThan(offer);
    expect(wallet).toBeGreaterThan(lien);
    expect(html.indexOf("Ouvrir le compte crédits client")).toBeGreaterThan(lien);
  });
});

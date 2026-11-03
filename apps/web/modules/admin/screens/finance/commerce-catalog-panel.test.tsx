import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AdminCommerceCatalog } from "@/modules/admin/data/catalog/model";
import { CommerceCatalogPanel } from "./commerce-catalog-panel";
import { getCommerceMessages } from "./commerce-messages";

vi.mock("./commerce-actions", () => ({
  commerceIdle: { status: "idle" },
  createCreditPackAction: async () => ({ status: "idle" }),
  activateCreditPackAction: async () => ({ status: "idle" }),
  grantCreditPackAction: async () => ({ status: "idle" }),
  createCreditPromotionAction: async () => ({ status: "idle" }),
  activateCreditPromotionAction: async () => ({ status: "idle" }),
  grantCreditPromotionAction: async () => ({ status: "idle" }),
  createPlatformParameterAction: async () => ({ status: "idle" }),
  activatePlatformParameterAction: async () => ({ status: "idle" }),
}));

const catalog: AdminCommerceCatalog = {
  generated_at: "2026-09-21T12:00:00.000Z",
  capabilities: { can_write: true, can_activate: true },
  packs: [{
    id: "11111111-1111-4111-8111-111111111111",
    pack_id: "22222222-2222-4222-8222-222222222222",
    code: "PACK_IT",
    version: 1,
    status: "DRAFT",
    name_fr: "Pack IT",
    name_ar: "حزمة",
    quantity: "20",
    price_minor: "50000",
    currency: "MAD",
    validity_days: 365,
  }],
  promotions: [],
  parameters: [],
};

describe("CommerceCatalogPanel", () => {
  it("expose packs, promotions et paramètres versionnés", () => {
    const html = renderToStaticMarkup(
      <CommerceCatalogPanel
        locale="fr"
        catalog={catalog}
        wallets={[]}
        m={getCommerceMessages("fr")}
        auditOrganizationId="33333333-3333-4333-8333-333333333333"
        keys={{ pack: "a", activatePack: "b", grantPack: "c", promotion: "d", activatePromotion: "e", grantPromotion: "f", parameter: "g", activateParameter: "h" }}
      />,
    );
    expect(html).toContain("PACK_IT");
    expect(html).toContain("Créer un pack de crédits");
    expect(html).toContain("Créer une promotion");
    expect(html).toContain("Achats de packs vérifiés");
    expect(html).not.toContain('name="paymentReference"');
    expect(html).toContain("DOCUMENT_EXPIRY_WARNING_DAYS");
    expect(html).not.toMatch(/\bTODO\b|\bFIXME\b/);
  });
});

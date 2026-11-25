import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { WholesaleCatalog } from "@/modules/admin/data/wholesale/model";
import { getCommerceMessages } from "./commerce-messages";
import { BoxWholesaleWorkshop } from "./box-wholesale-workshop";

vi.mock("./commerce-actions", () => ({
  commerceIdle: { status: "idle" },
  createBoxFromWholesaleAction: async () => ({ status: "idle" }),
}));

const catalog: WholesaleCatalog = {
  generated_at: "2026-11-18T12:00:00.000Z",
  territory_code: "CASABLANCA_SETTAT",
  subject: null,
  margin_bps: 1500,
  margin_source: "DEFAULT",
  territories: [
    { code: "CASABLANCA_SETTAT", name_fr: "Casablanca-Settat", name_ar: "الدار البيضاء سطات" },
  ],
  offers: [
    {
      commitment_id: "11111111-1111-4111-8111-111111111111",
      provider_organization_id: "22222222-2222-4222-8222-222222222222",
      provider_name: "Web Atlas",
      franchise_name: "Franchisé Démo IT",
      agreement_id: "33333333-3333-4333-8333-333333333333",
      agreement_code: "AGR-WEB",
      sku_id: "44444444-4444-4444-8444-444444444444",
      sku_code: "WEB_10",
      unit_code: "SITE",
      pack_quantity: "10",
      sku_currency: "MAD",
      reference_cost_minor: "3000000",
      wholesale_unit_price_minor: "2500000",
      currency: "MAD",
      capacity_units: "100",
      remaining_units: "80",
      region_codes: ["CASABLANCA_SETTAT"],
      library_code: "IT",
      category_code: "WEB",
      category_name_fr: "Sites web",
      category_name_ar: "مواقع",
      service_name_fr: "Pack 10 sites web",
      service_name_ar: "حزمة 10 مواقع",
      proposed_pack_price_minor: "2875000",
    },
  ],
  actors: [],
};

describe("BoxWholesaleWorkshop", () => {
  it("affiche le détail des offres sans dossiers franchisé/ST (espaces acteurs)", () => {
    const html = renderToStaticMarkup(
      <BoxWholesaleWorkshop
        locale="fr"
        catalog={catalog}
        auditOrganizationId="99999999-9999-4999-8999-999999999999"
        m={getCommerceMessages("fr")}
        createKey="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      />,
    );
    expect(html).toContain("CASABLANCA_SETTAT");
    expect(html).toContain("Pack 10 sites web");
    expect(html).toContain("Web Atlas");
    expect(html).toContain("Franchisé Démo IT");
    expect(html).toContain('id="box-compose"');
    expect(html.indexOf('id="box-compose"')).toBeLessThan(html.indexOf("Catalogue des offres de gros"));
    expect(html).toContain("Détails");
    expect(html).toContain("Prix de gros");
    expect(html).not.toContain("Dossiers et documents");
    expect(html).not.toContain("Documents de validation");
    expect(html).not.toContain("Attestation ICE");
    expect(html).not.toMatch(/\bTODO\b|\bFIXME\b/);
  });
});

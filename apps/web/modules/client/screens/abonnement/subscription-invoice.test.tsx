import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SubscriptionInvoice } from "./subscription-invoice";

const cycle = {
  id: "11111111-1111-4111-8111-111111111111",
  cycleNumber: 2,
  currency: "MAD",
  amountMinor: "149000",
  periodStart: "2026-09-01T00:00:00.000Z",
  periodEnd: "2026-10-01T00:00:00.000Z",
  paymentReference: "ORDER-97000001",
  plan: {
    id: "22222222-2222-4222-8222-222222222222",
    code: "GOLD" as const,
    version: 3,
    status: "ACTIVE" as const,
    currency: "MAD",
    monthlyPriceMinor: "149000",
    annualPriceMinor: "1490000",
    monthlyCreditGrant: "10",
    coreAllocationBasisPoints: 7000,
    benefitPoolAllocationBasisPoints: 3000,
    limitsSnapshot: {},
    boxVersionReference: null,
    contentHash: "a".repeat(64),
    validFrom: "2026-01-01",
    validTo: null,
    entitlements: [],
  },
};

describe("SubscriptionInvoice", () => {
  it("affiche le cycle réglé et sa référence de paiement", () => {
    const html = renderToStaticMarkup(
      <SubscriptionInvoice locale="fr" query="?organizationId=org" organizationName="Atelier Nord" cycle={cycle} />,
    );
    expect(html).toContain("Détail du cycle d’abonnement");
    expect(html).toContain("Atelier Nord");
    expect(html).toContain("GOLD · v3");
    expect(html).toContain("ORDER-97000001");
    expect(html).toContain("/fr/client/finances?organizationId=org#documents-commerciaux");
    expect(html).not.toMatch(/payment_proof|TODO|FIXME/);
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getClientRfqMessages } from "./messages";
import { ComparisonPanel } from "./comparison-panel";

const requestId = "11111111-1111-4111-8111-111111111111";
const rfqId = "22222222-2222-4222-8222-222222222222";

describe("ComparisonPanel", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("compose la comparaison en trois colonnes avec pondération, sans exemple illustratif", () => {
    vi.stubEnv("MATRICIA_DEMO_ACCESS_ENABLED", "true");
    vi.stubEnv("APP_ENV", "test");
    const html = renderToStaticMarkup(
      <ComparisonPanel
        locale="fr"
        requestId={requestId}
        rfqId={rfqId}
        messages={getClientRfqMessages("fr")}
        canManage
        initialComparison={null}
        nowIso="2026-09-20T12:00:00.000Z"
        compareKey="33333333-3333-4333-8333-333333333333"
        selectKeys={["44444444-4444-4444-8444-444444444444"]}
        selectedQuery=""
        requestTitle="Accompagnement pour la mise en conformité"
        requestHref={`/fr/client/demandes/${requestId}`}
        organizationName="Client · Communication, marketing et création"
      />,
    );
    expect(html).toContain("Générer la comparaison");
    expect(html).toContain("Aucune comparaison figée n’est encore disponible.");
    expect(html).not.toContain("Offre A");
    expect(html).not.toContain("illustrent une comparaison");
    expect(html).not.toContain('name="selectionReason"');
    expect(html).not.toContain("Choisir cette offre");
    expect(html).not.toMatch(/exemple illustratif/i);
    expect(html).not.toContain("Atlas Conseil");
  });

  it("affiche les totaux normalisés d’une comparaison réelle", () => {
    vi.stubEnv("MATRICIA_DEMO_ACCESS_ENABLED", "false");
    vi.stubEnv("APP_ENV", "production");
    const html = renderToStaticMarkup(
      <ComparisonPanel
        locale="fr"
        requestId={requestId}
        rfqId={rfqId}
        messages={getClientRfqMessages("fr")}
        canManage
        initialComparison={{
          snapshotId: "55555555-5555-4555-8555-555555555555",
          rfqId,
          normalizationVersion: "v1",
          currency: "MAD",
          createdAt: "2026-09-18T10:00:00.000Z",
          rows: [{
            quoteId: "66666666-6666-4666-8666-666666666666",
            quoteVersionId: "77777777-7777-4777-8777-777777777777",
            versionNumber: 1,
            currency: "MAD",
            subtotalMinor: "2000000",
            taxMinor: "400000",
            totalMinor: "2400000",
            recurringSubtotalMinor: "0",
            durationDays: 28,
            deliverablesCount: 3,
            validUntil: "2026-11-30T00:00:00.000Z",
            priceRank: 1,
          }],
        }}
        nowIso="2026-09-20T12:00:00.000Z"
        compareKey="33333333-3333-4333-8333-333333333333"
        selectKeys={["44444444-4444-4444-8444-444444444444"]}
        selectedQuery=""
        requestTitle="Audit du SI"
        requestHref={`/fr/client/demandes/${requestId}`}
        organizationName="Acme"
        offerFacts={{
          "77777777-7777-4777-8777-777777777777": {
            quoteVersionId: "77777777-7777-4777-8777-777777777777",
            completeness: {
              basisPoints: 10_000,
              checks: [
                { key: "solution", present: true },
                { key: "deliverables", present: true },
                { key: "warranty", present: true },
                { key: "corrections", present: true },
                { key: "start", present: true },
                { key: "duration", present: true },
                { key: "validity", present: true },
                { key: "lines", present: true },
              ],
            },
            deliverables: ["Rapport", "Plan d’action", "Restitution"],
            exclusions: [],
            warranty: "3 mois",
            corrections:"Une itération de correction",
            recurringLines:[{label:"Assistance trimestrielle",subtotalMinor:"9007199254740993",interval:"QUARTER"}],
          },
        }}
      />,
    );
    expect(html).toContain("Offre A");
    expect(html).toContain("4 semaines");
    expect(html).toContain("Rapport");
    expect(html).toContain("Rang de prix 1");
    expect(html).not.toContain("★ Offre recommandée");
    expect(html).toContain("Critères de comparaison");
    expect(html).not.toContain('type="range"');
    expect(html).toContain("Complétude du devis");
    expect(html).toContain("100 %");
    expect(html).toContain("Assistance trimestrielle");
    expect(html).toContain("trimestre");
    expect(html).toContain("Une itération de correction");
    expect(html).toContain("Maintenance / suivi");
    expect(html).toContain("Conditions de paiement");
    expect(html).toContain('name="selectionReason"');
    expect(html).toContain('name="confirmSelection"');
    expect(html).toContain("coordonnées");
    expect(html).not.toContain("provider_organization");
    expect(html).not.toContain("Structurer votre organisation");
    expect(html).not.toMatch(/exemple illustratif/i);
  });
});

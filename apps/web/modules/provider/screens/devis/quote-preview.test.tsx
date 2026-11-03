import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuotePreviewWorkbench } from "./quote-preview";

const id = (value: number) => `${String(value).padStart(8, "0")}-0000-4000-8000-000000000000`;

const invitation = {
  id: id(1),
  status: "ACCEPTED" as const,
  rowVersion: 1,
  rfqId: id(2),
  deadline: "2027-01-01T12:00:00.000Z",
  requestId: id(3),
  description: "Rénovation bureaux",
  regionCode: "RABAT",
  currency: "MAD",
  taxCategoryCode: "STANDARD_SERVICE",
  quote: { id: id(4), status: "DRAFT", currentVersionId: id(5), versionNumber: 1, currency: "MAD", subtotalMinor: "7750000", taxMinor: "1550000", totalMinor: "9300000" },
};

const prefill = {
  solution: "Cloisonnement et peinture",
  deliverables: "Plans\nRéception",
  inclusions: "Fourniture",
  exclusions: "Mobilier",
  prerequisites: "Accès chantier",
  warranty: "12 mois",
  correctionTerms: "Reprise incluse",
  proposedStartDate: "2026-10-01",
  durationDays: "21",
  validUntil: "2026-12-01T00:00",
  changeReason: "Première version",
  lines: [{ label: "Cloisons", quantity: "120", unitCode: "M2", unitPrice: "350,00", taxRuleVersionId: id(6), itemKind: "ONE_TIME" as const, recurrenceInterval: "" as const }],
};

describe("QuotePreviewWorkbench", () => {
  it("affiche la version serveur et refuse les montants inventés", () => {
    const html = renderToStaticMarkup(
      <QuotePreviewWorkbench locale="fr" query="" quoteId={invitation.quote.id} invitation={invitation} prefill={prefill} organizationName="Atlas BTP" submitPanel={<button type="submit">Soumettre ce devis</button>} />,
    );
    expect(html).toContain("Prévisualisation du devis");
    expect(html).toContain("Cloisons");
    expect(html).toContain("350,00");
    expect(html).toContain("Soumettre ce devis");
    expect(html).toContain("Retourner modifier");
    expect(html).not.toMatch(/exemple illustratif/i);
    expect(html).toContain(`/api/provider/quotes/${invitation.quote.id}/draft?locale=fr`);
    expect(html).toContain("Aucune pièce jointe — facultatives");
    expect(html).not.toContain("Plans</a>");
  });

  it("demande une version enregistrée plutôt que d’inventer un aperçu", () => {
    const html = renderToStaticMarkup(
      <QuotePreviewWorkbench locale="fr" query="" quoteId="nouveau" invitation={null} organizationName="Atlas BTP" />,
    );
    expect(html).toContain("Enregistrez une version serveur");
    expect(html).not.toContain("7750000");
  });
});

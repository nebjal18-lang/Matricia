import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { demoClientOfferDetail } from "@/modules/client/data/rfq/quote-detail-demo";
import { ClientOfferDetailView } from "./offer-detail";

describe("ClientOfferDetailView", () => {
  it("compose le détail d’offre avec retour sécurisé vers la comparaison", () => {
    const detail = demoClientOfferDetail({
      locale: "fr",
      requestId: "11111111-1111-4111-8111-111111111111",
      quoteId: "11111111-1111-4111-8111-111111111111-a",
      description: "Déploiement de la marque",
      organizationQuery: "?organizationId=org-1",
      rfqId: "22222222-2222-4222-8222-222222222222",
    });
    detail.revisionInProgress=true;detail.displayedVersionNumber=1;detail.publishedVersions=[{id:"77777777-7777-4777-8777-777777777777",version:1,submittedAt:"2026-11-02T00:00:00Z"}];detail.options=[{id:"opt1",label:"Suivi optionnel conservé",amountMinor:"125050"}];
    const html = renderToStaticMarkup(
      <ClientOfferDetailView locale="fr" selectedQuery="?organizationId=org-1" detail={detail} />,
    );
    expect(html).toContain("Détail de l’offre");
    expect(html).toContain("Offre A");
    expect(html).toContain("Ce que couvre cette offre");
    expect(html).toContain("Détail du devis");
    expect(html).toContain("Résumé pour comparer");
    expect(html).toContain("Pièces partagées");
    expect(html).toContain("Exclusions et points à clarifier");
    expect(html).toContain("Direction artistique");
    expect(html).toContain("Retour à la comparaison");
    expect(html).toContain("Poser une question");
    expect(html).toContain("client-offer-layout");
    expect(html).toContain("À examiner");
    expect(html).toContain("À clarifier");
    expect(html).toContain("/fr/client/demandes/11111111-1111-4111-8111-111111111111/offres?rfq=22222222-2222-4222-8222-222222222222");
    expect(html).toContain("/fr/messagerie?organizationId=org-1");
    expect(html).not.toMatch(/exemple illustratif/i);
    expect(html).toContain("Révision du devis en cours");expect(html).toContain("Versions publiées du devis");expect(html).toContain("Options hors total de base");expect(html).toContain("Suivi optionnel conservé");
  });
});

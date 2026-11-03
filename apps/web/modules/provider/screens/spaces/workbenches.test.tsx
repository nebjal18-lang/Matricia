import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  CompanySecurityWorkbench,
  ConsultationDetailWorkbench,
  InvoiceSettlementWorkbench,
  MessagesNotificationsWorkbench,
  MissionDeliveryWorkbench,
  ProviderOutOfScope,
  QuoteMultilineWorkbench,
  QuoteRevisionWorkbench,
} from "./workbenches";

describe("provider nested workbenches 09-15", () => {
  it("keeps unavailable team, sessions and security distinct from empty and verified states",()=>{
    const html=renderToStaticMarkup(<CompanySecurityWorkbench locale="fr" query="" membersUnavailable sessionsUnavailable securityUnavailable />);
    expect(html).toContain("Chargement de l’équipe indisponible");expect(html).toContain("Chargement des sessions indisponible");expect(html).toContain("État de protection du compte indisponible");expect(html).not.toContain("Aucun membre visible");expect(html).not.toContain("Aucune session");
  });
  it("compose les écrans de détail sans exemple illustratif ni devis concurrent", () => {
    const html = [
      renderToStaticMarkup(<ConsultationDetailWorkbench locale="fr" query="" consultationId="cr1" />),
      renderToStaticMarkup(<QuoteMultilineWorkbench locale="fr" query="" quoteId="d1" />),
      renderToStaticMarkup(<QuoteRevisionWorkbench locale="fr" query="" quoteId="d2" />),
      renderToStaticMarkup(<MissionDeliveryWorkbench locale="fr" query="" missionId="m1" />),
      renderToStaticMarkup(<InvoiceSettlementWorkbench locale="fr" query="" invoiceId="i1" />),
      renderToStaticMarkup(<MessagesNotificationsWorkbench locale="fr" query="" threadId="cr1" />),
      renderToStaticMarkup(<CompanySecurityWorkbench locale="fr" query="" organizationName="Studio Atlas" userEmail="pro@example.ma" />),
    ].join("\n");
    expect(html).toContain("provider-workbench");
    expect(html).toContain("Adéquation avec votre qualification");
    expect(html).toContain("Créer un devis multiligne");
    expect(html).toContain("Réviser et soumettre le devis");
    expect(html).toContain("Mission et livraison");
    expect(html).toContain("Facture et règlement");
    expect(html).toContain("Messages et notifications");
    expect(html).toContain("Authentification à deux facteurs");
    expect(html).toContain("Aucun devis d’un autre prestataire n’est visible");
    expect(html).toContain("Aucun montant de tiers");
    expect(html).toContain("calculés et sécurisés par le serveur");
    expect(html).toContain("MAD");
    expect(html).toContain("dir=\"ltr\"");
    expect(html).toContain("Montant indisponible");
    expect(html).toContain("Aucune notification pour le moment.");
    expect(html).not.toContain("Windows");
    expect(html).not.toContain("12 000");
    expect(html).not.toMatch(/exemple illustratif/i);
    expect(html).not.toMatch(/TODO:|FIXME:|\bTBD\b/);
    expect(html).not.toMatch(/parseFloat/);
    expect(html).not.toContain("TVA (20 %)");
  });

  it("expose un état FR/AR et un refus de périmètre sans redirection vide", () => {
    const ar = renderToStaticMarkup(<ConsultationDetailWorkbench locale="ar" query="" consultationId="cr1" />);
    const scope = renderToStaticMarkup(<ProviderOutOfScope locale="fr" query="" />);
    expect(ar).toMatch(/[\u0600-\u06ff]/u);
    expect(ar).toContain("لا يظهر أي عرض لمقدم خدمة آخر");
    expect(scope).toContain("n’est pas dans votre périmètre autorisé");
    expect(scope).toContain("Aucun devis concurrent");
  });

  it("affiche les pièces RFQ partagées et refuse les documents de qualification du prestataire", () => {
    const invitation = {
      id: "11111111-1111-4111-8111-111111111111",
      status: "INVITED" as const,
      rowVersion: 1,
      rfqId: "22222222-2222-4222-8222-222222222222",
      deadline: "2027-01-01T12:00:00.000Z",
      requestId: "33333333-3333-4333-8333-333333333333",
      description: "Rénovation lot CVC",
      regionCode: "RABAT",
      currency: "MAD",
      taxCategoryCode: null,
      quote: null,
      pack: {
        objective: "Mettre à niveau le CVC",
        scope: ["Lot CVC"],
        deliverables: ["Devis détaillé"],
        constraints: ["Horaires scolaires"],
        documents: [
          { id: "55555555-5555-4555-8555-555555555555", title: "Cahier des charges", type: "PDF", size: "2,4 Mo" },
          { title: "Note interne sans fichier" },
        ],
      },
    };
    const withPack = renderToStaticMarkup(<ConsultationDetailWorkbench locale="fr" query="" consultationId={invitation.id} invitation={invitation} />);
    expect(withPack).toContain("Cahier des charges");
    expect(withPack).toContain("2,4 Mo");
    expect(withPack).toContain("Mettre à niveau le CVC");
    expect(withPack).toContain(`/api/provider/consultations/${invitation.id}/documents/55555555-5555-4555-8555-555555555555`);
    expect(withPack).toContain(`/sous-traitant/messages?rfq=${invitation.rfqId}`);
    expect(withPack).toContain("client-feed-download");
    expect(withPack).toContain("Télécharger");
    expect(withPack).not.toContain("Extrait d’immatriculation");
    expect(withPack.match(/client-feed-download/g)?.length).toBe(1);
    const empty = renderToStaticMarkup(<ConsultationDetailWorkbench locale="fr" query="" consultationId={invitation.id} invitation={{ ...invitation, pack: { objective: null, scope: [], deliverables: [], constraints: [], documents: [] } }} />);
    expect(empty).toContain("Aucun document n’a encore été partagé");
    expect(empty).not.toContain("Extrait d’immatriculation");
    expect(empty).not.toContain("Attestation fiscale");

    const panel = <div>panel</div>;
    const open = renderToStaticMarkup(<ConsultationDetailWorkbench locale="fr" query="" consultationId={invitation.id} invitation={invitation} quotePanel={panel} />);
    expect(open).toContain("href=\"#invitation-decision\"");
    expect(open).not.toContain("data-state=\"done\"");
    const submitted = renderToStaticMarkup(
      <ConsultationDetailWorkbench
        locale="fr"
        query=""
        consultationId={invitation.id}
        invitation={{ ...invitation, status: "ACCEPTED", quote: { id: "77777777-7777-4777-8777-777777777777", status: "SUBMITTED", currentVersionId: null, versionNumber: 1, currency: "MAD", subtotalMinor: "100", taxMinor: "20", totalMinor: "120" } }}
        quotePanel={panel}
      />,
    );
    expect(submitted).not.toContain("href=\"#invitation-decision\"");
    expect(submitted.match(/data-state="done"/g)?.length).toBe(1);
    expect(submitted.match(/data-state="current"/g)?.length).toBe(1);
  });

  it("affiche une facture réelle sans inventer de montant ni de téléchargement", () => {
    const invoice = {
      id: "66666666-6666-4666-8666-666666666666",
      number: "F-2026-01",
      currency: "MAD",
      totalMinor: "1250",
      paidMinor: "0",
      outstandingMinor: "1250",
      creditedMinor: "0",
      paymentStatus: "OPEN",
      dueOn: "2026-10-01",
    };
    const html = renderToStaticMarkup(<InvoiceSettlementWorkbench locale="fr" query="" invoiceId={invoice.id} invoice={invoice} />);
    expect(html).toContain("F-2026-01");
    expect(html).toContain("12,50");
    expect(html).not.toContain("Montant indisponible");
    expect(html).not.toMatch(/client-feed-download/);
    expect(html).not.toContain("TVA (20 %)");
  });
  it.each(["fr", "ar"] as const)("translates both selected quote status labels while preserving free text in %s", locale => {
    const id="ab970000-0000-4000-8000-000000000001";
    const invitation={id,status:"ACCEPTED" as const,rowVersion:1,rfqId:id,deadline:"2026-11-03T23:50:00Z",requestId:id,description:"SELECTED saisi librement par le client",regionCode:"CASABLANCA_SETTAT",currency:"MAD",taxCategoryCode:null,quote:{id,status:"SELECTED",currentVersionId:id,versionNumber:2,currency:"MAD",subtotalMinor:"175050",taxMinor:"35010",totalMinor:"210060",createdAt:"2026-11-02T12:00:00Z",validUntil:"2026-12-02T12:00:00Z"}};
    const html=renderToStaticMarkup(<QuoteMultilineWorkbench locale={locale} query={`?organizationId=${id}`} quoteId={id} invitation={invitation}/>);
    const label=locale==="ar"?"مختار":"Sélectionné";
    expect(html).toContain(`class="client-status-chip" data-tone="mint">${label}</span>`);
    expect(html).toContain(`${locale==="ar"?"حالة النسخة المحفوظة":"État de la version enregistrée"} : ${label}`);
    expect(html).toContain(invitation.description);expect(html.match(/\bSELECTED\b/gu)).toHaveLength(1);
    expect(invitation.quote.status).toBe("SELECTED");expect(invitation.quote.totalMinor).toBe("210060");
  });

});

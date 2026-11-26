import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BillingBoard, ConsultationsBoard, ProviderDocumentsBoard, ProviderHomeBoard, ProviderMissionsBoard, QualificationBoard, QuotesBoard, ReputationBoard, ServicesBoard } from "./boards";

describe("provider space boards", () => {
  it.each(["fr", "ar"] as const)("describes actual private document access without promising public or discretionary sharing in %s", (locale) => {
    const html = renderToStaticMarkup(<ProviderDocumentsBoard locale={locale} query="" documents={[]} />);
    expect(html).toContain(locale === "ar" ? "وثائقكم خاصة" : "Vos documents sont privés");
    expect(html).toContain(locale === "ar" ? "فرق Matricia المخولة" : "équipes Matricia habilitées");
    expect(html).toContain(locale === "ar" ? "أصحاب الامتياز المفوضين" : "franchisés mandatés");
    expect(html).not.toMatch(/acteurs publics|الفاعلين العموميين|Vous gardez le contrôle/u);
  });

  it("compose le cycle prestataire sans exemple illustratif", () => {
    const html = [
      renderToStaticMarkup(<ProviderHomeBoard locale="fr" query="" />),
      renderToStaticMarkup(<QualificationBoard locale="fr" query="" />),
      renderToStaticMarkup(<ServicesBoard locale="fr" query="" />),
      renderToStaticMarkup(<ConsultationsBoard locale="fr" query="" />),
      renderToStaticMarkup(<QuotesBoard locale="fr" query="" />),
      renderToStaticMarkup(<ProviderMissionsBoard locale="fr" query="" />),
      renderToStaticMarkup(<ProviderDocumentsBoard locale="fr" query="" documents={[{ id: "11111111-1111-4111-8111-111111111111", kind: "LEGAL", code: "RC_ATLAS", version: 1, status: "VERIFIED", expiresOn: "2027-01-01" }]} />),
      renderToStaticMarkup(<BillingBoard locale="fr" query="" />),
      renderToStaticMarkup(<ReputationBoard locale="fr" query="" />),
    ].join("\n");
    expect(html).toContain("À traiter maintenant");
    expect(html).toContain("Aucune action à traiter pour le moment.");
    expect(html).not.toContain("Répondre à une consultation");
    // Home without snapshot must not flash "Complétez votre profil" beside an unknown journey state.
    expect(html).not.toContain("Complétez votre profil pour accéder");
    expect(html).toContain("Checklist de qualification");
    expect(html).toContain("Informations de l’activité");
    expect(html).toContain("Questionnaire de service");
    expect(html).toContain("Décision Matricia");
    expect(html).toContain("Vos services déclarés");
    expect(html).toContain("Aucun service n’est encore déclaré.");
    expect(html).not.toContain("Appui et conseil");
    expect(html).toContain("Créer une proposition structurée");
    expect(html).not.toContain("Accompagnement stratégique");
    expect(html).toContain("RC_ATLAS");
    expect(html).toContain("Privé");
    expect(html).not.toContain("Extrait d’immatriculation");
    expect(html).toContain("Rapprochement et paiements");
    expect(html).toContain("Comment les retours apparaissent");
    expect(html).not.toContain("/sous-traitant/consultations/cr1");
    expect(html).toContain("/sous-traitant/devis/nouveau");
    expect(html).not.toMatch(/exemple illustratif/i);
  });

  it("n’invente pas de listes quand le métier est chargé", () => {
    const liveHome = renderToStaticMarkup(<ProviderHomeBoard locale="fr" query="" actionItems={[]} />);
    expect(liveHome).toContain("Aucune action à traiter pour le moment.");
    expect(liveHome).toContain("Aucune consultation adaptée");
    expect(liveHome).not.toContain("Répondre à une consultation");
    expect(liveHome).not.toContain("/sous-traitant/consultations/cr1");

    const liveQual = renderToStaticMarkup(<QualificationBoard locale="fr" query="" dashboard={null} />);
    expect(liveQual).toContain("Informations de l’activité");
    expect(liveQual).toContain("Décision Matricia");
    expect(liveQual).toContain("Questionnaire de service");
    expect(liveQual).toContain("À compléter");
    expect(liveQual).not.toContain("Exemple illustratif");

    const liveServices = renderToStaticMarkup(<ServicesBoard locale="fr" query="" services={[]} />);
    expect(liveServices).toContain("Aucun service n’est encore déclaré.");
    expect(liveServices).not.toContain("Appui stratégique");

    const liveRep = renderToStaticMarkup(<ReputationBoard locale="fr" query="" dashboard={null} />);
    expect(liveRep).toContain("Aucun retour anonymisé");
    expect(liveRep).not.toContain("Mission clôturée — accompagnement");

    const liveMissions = renderToStaticMarkup(<ProviderMissionsBoard locale="fr" query="" rows={[]} />);
    expect(liveMissions).toContain("Aucune mission en cours pour votre organisation.");
    expect(liveMissions).not.toContain("Accompagnement stratégique");

    const liveBilling = renderToStaticMarkup(<BillingBoard locale="fr" query="" dashboard={null} />);
    expect(liveBilling).not.toContain("Facture — acompte mission");
    expect(liveBilling).toContain("Aucune facture dans ce périmètre");
    expect(liveBilling).not.toContain("événements confirmés");

    const liveHomeSnap = renderToStaticMarkup(
      <ProviderHomeBoard
        locale="fr"
        query=""
        actionItems={[]}
        snapshot={{
          status: "success",
          stage: "qualified",
          profileComplete: true,
          counts: { consultationsDue: 1, quotesInProgress: 0, activeMissions: 0, deliverablesDue: 0, invoicesOutstanding: 0 },
          blockers: [],
          organizationName: "Studio Atlas",
          organizationId: "11111111-1111-4111-8111-111111111111",
          treatItems: [],
          consultations: [{ id: "c1", title: "Lot CVC Rabat", status: "À répondre", href: "/fr/sous-traitant/consultations/11111111-1111-4111-8111-111111111111", tone: "peach" }],
          capacity: { status: "AVAILABLE", domains: "Digital et IT", zones: "—" },
          reputation: { published: 0, latest: null },
        }}
      />,
    );
    expect(liveHomeSnap).toContain("Lot CVC Rabat");
    expect(liveHomeSnap).toContain("Ouvert aux opportunités");
    expect(liveHomeSnap).toContain("Digital et IT");
    expect(liveHomeSnap).not.toContain("/sous-traitant/consultations/cr1");
    expect(liveHomeSnap).not.toContain("AVAILABLE");
  });

  it("n’affiche pas de tâches admin et oriente le devis vers le dossier prestataire", () => {
    const invitationId = "11111111-1111-4111-8111-111111111111";
    const quoteId = "22222222-2222-4222-8222-222222222222";
    const domainQuote = {
      id: `quote:${quoteId}`,
      kind: "NOTIFICATION" as const,
      title: "Demande IT avec devis à comparer",
      detail: "Devis à finaliser",
      organizationName: "Prestataire · Assurance",
      organizationId: "33333333-3333-4333-8333-333333333333",
      priority: "HIGH" as const,
      mandatory: false,
      href: `/fr/sous-traitant/devis/${quoteId}`,
      occurredAt: "2026-11-10T00:00:00Z",
      dueAt: "2026-11-12T00:00:00Z",
      requiresHumanReview: false,
    };
    const html = renderToStaticMarkup(
      <ProviderHomeBoard
        locale="fr"
        query="?organizationId=33333333-3333-4333-8333-333333333333"
        actionItems={[
          {
            ...domainQuote,
            id: "work:admin",
            kind: "WORK_ITEM",
            title: "Score diagnostic IT à instruire",
            href: "/fr/administration/command-center",
            organizationId: null,
            organizationName: null,
          },
          {
            ...domainQuote,
            id: "work:personal",
            kind: "WORK_ITEM",
            title: "Demande d’accès aux données personnelles",
            href: "/fr/administration/command-center",
            organizationId: null,
            organizationName: null,
          },
        ]}
        snapshot={{
          status: "success",
          stage: "new",
          profileComplete: true,
          counts: { consultationsDue: 0, quotesInProgress: 1, activeMissions: 0, deliverablesDue: 0, invoicesOutstanding: 0 },
          blockers: [],
          organizationName: "Prestataire · Assurance",
          organizationId: "33333333-3333-4333-8333-333333333333",
          treatItems: [domainQuote],
          consultations: [],
          capacity: { status: "NOT_DECLARED", domains: "—", zones: "—" },
          reputation: { published: 0, latest: null },
        }}
      />,
    );
    expect(html).toContain("Préparer mon devis");
    expect(html).toContain(`/fr/sous-traitant/devis/${quoteId}`);
    expect(html).not.toContain("/administration/command-center");
    expect(html).not.toContain("Score diagnostic IT");
    expect(html).not.toContain("données personnelles");
    expect(html).toContain("Profil");
    expect(html).toContain("Complété");
    expect(html).toContain("qualification en cours");
    expect(html).not.toContain("Complétez votre profil pour accéder");
    expect(html).toContain(`/fr/sous-traitant/devis?organizationId=33333333-3333-4333-8333-333333333333&amp;tab=drafts`);
    expect(html).not.toContain(`/fr/sous-traitant/consultations/${invitationId}`);
  });

  it("ignore l’action-center même après chargement si le snapshot métier est vide", () => {
    const html = renderToStaticMarkup(
      <ProviderHomeBoard
        locale="fr"
        query="?organizationId=33333333-3333-4333-8333-333333333333"
        actionItems={[
          {
            id: "work:1",
            kind: "WORK_ITEM",
            title: "Avenant contractuel à instruire",
            detail: "Command center",
            organizationName: null,
            organizationId: null,
            priority: "HIGH",
            mandatory: true,
            href: "/fr/administration/command-center",
            occurredAt: "2026-11-10T00:00:00Z",
            dueAt: null,
            requiresHumanReview: true,
          },
        ]}
        snapshot={{
          status: "success",
          stage: "qualified",
          profileComplete: true,
          counts: { consultationsDue: 0, quotesInProgress: 0, activeMissions: 0, deliverablesDue: 0, invoicesOutstanding: 0 },
          blockers: [],
          organizationName: "Prestataire · Assurance",
          organizationId: "33333333-3333-4333-8333-333333333333",
          treatItems: [],
          consultations: [],
          capacity: { status: "AVAILABLE", domains: "Assurance", zones: "—" },
          reputation: { published: 0, latest: null },
        }}
      />,
    );
    expect(html).toContain("Aucune action à traiter pour le moment.");
    expect(html).not.toContain("/administration/command-center");
    expect(html).not.toContain("Avenant contractuel");
  });
});

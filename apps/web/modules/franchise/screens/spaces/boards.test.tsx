import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocumentsBoard, FollowupsBoard, FranchiseFinanceBoard, FranchiseHomeBoard, FranchiseRequestsBoard, GovernanceBoard, MessagesBoard, NetworkBoard, PerformanceBoard, PerimeterBoard, QualityBoard } from "./boards";
import { buildFranchiseSpaceBoard } from "@/modules/franchise/data/spaces/live";
import type { FranchiseCrmDashboard } from "@/modules/franchise/data/crm/model";

const crm: FranchiseCrmDashboard = {
  currentUserId: "11111111-1111-4111-8111-111111111111",
  canWrite: true,
  canRecordPerformance: false,
  franchises: [{
    id: "22222222-2222-4222-8222-222222222222",
    operatorCode: "OP",
    type: "IT",
    canWrite: true,
    territory: { id: "33333333-3333-4333-8333-333333333333", code: "CASA", nameFr: "Casablanca-Settat", nameAr: "الدار البيضاء-سطات", version: 1 },
  }],
  prospects: [
    { id: "44444444-4444-4444-8444-444444444444", franchiseId: "22222222-2222-4222-8222-222222222222", territoryVersionId: "33333333-3333-4333-8333-333333333333", type: "PROVIDER", displayName: "Studio Atlas", contactEmail: "a@example.invalid", organizationName: "Studio Atlas", sourceCode: "NETWORK", stage: "VERIFIED", nextFollowupAt: null, rowVersion: 1, activities: [{ id: "1", type: "INVITATION", occurredAt: "2026-09-10T10:00:00.000Z", summary: "Invitation envoyée", evidenceRefs: [{ reference: "invite://atlas" }] }], pipelineEvents: [] },
    { id: "55555555-5555-4555-8555-555555555555", franchiseId: "22222222-2222-4222-8222-222222222222", territoryVersionId: "33333333-3333-4333-8333-333333333333", type: "CLIENT", displayName: "Conseil stratégique", contactEmail: "c@example.invalid", organizationName: "Conseil stratégique", sourceCode: "RFQ", stage: "RFQ_STARTED", nextFollowupAt: null, rowVersion: 1, activities: [{ id: "3", type: "NOTE", occurredAt: "2026-09-15T09:00:00.000Z", summary: "Besoin cadré", evidenceRefs: [] }], pipelineEvents: [] },
    { id: "55555555-5555-4555-8555-555555555556", franchiseId: "22222222-2222-4222-8222-222222222222", territoryVersionId: "33333333-3333-4333-8333-333333333333", type: "PROVIDER", displayName: "Conseil Anfa", contactEmail: "anfa@example.invalid", organizationName: "Conseil Anfa", sourceCode: "NETWORK", stage: "PROFILE_STARTED", nextFollowupAt: "2026-09-21T00:00:00.000Z", rowVersion: 1, activities: [], pipelineEvents: [] },
  ],
  metrics: [],
  snapshots: [],
  alerts: [],
  objectives: [{
    id: "88888888-8888-4888-8888-888888888888",
    franchiseId: "22222222-2222-4222-8222-222222222222",
    code: "COVERAGE",
    version: 1,
    titleFr: "Couverture du réseau",
    titleAr: "تغطية الشبكة",
    targetValue: "100",
    currentValue: "40",
    unitCode: "BPS",
    status: "ACTIVE",
    startsOn: "2026-01-01",
    dueOn: "2026-12-31",
    ruleVersion: "1",
  }],
};

describe("franchise space boards", () => {
  it("compose le pilotage de périmètre à partir des données du mandat", () => {
    const board = buildFranchiseSpaceBoard({ locale: "fr", query: "", crm, libraryName: "Informatique" });
    const html = [
      renderToStaticMarkup(<FranchiseHomeBoard locale="fr" query="" board={board} />),
      renderToStaticMarkup(<PerimeterBoard locale="fr" query="" board={board} />),
      renderToStaticMarkup(<NetworkBoard locale="fr" query="" board={board} />),
      renderToStaticMarkup(<FranchiseRequestsBoard locale="fr" query="" board={board} />),
      renderToStaticMarkup(<QualityBoard locale="fr" query="" board={board} />),
      renderToStaticMarkup(<PerformanceBoard locale="fr" query="" board={board} />),
      renderToStaticMarkup(<FollowupsBoard locale="fr" query="" board={board} />),
      renderToStaticMarkup(<GovernanceBoard locale="fr" query="" board={board} />),
      renderToStaticMarkup(<FranchiseFinanceBoard locale="fr" query="" board={board} />),
    ].join("\n");
    expect(html).toContain("À traiter maintenant");
    expect(html).toContain("Casablanca-Settat");
    expect(html).toContain("Studio Atlas");
    expect(html).toContain("Conseil stratégique");
    expect(html).toContain("Vous ne pouvez pas auto-valider");
    expect(html).toContain("Couverture du réseau");
    expect(html).toContain("Conseil Anfa");
    expect(html).toContain("Aucun montant, solde ou donnée financière");
    expect(html).toContain("/fr/franchise/fournisseurs/inviter");
    expect(html).toContain("/fr/franchise/clients/inviter");
    expect(html).toContain("/fr/franchise/fournisseurs/accompagnement");
    expect(html).toContain("franchise-workbench");
    expect(html).toContain("franchise-mandate-banner");
    expect(html).not.toMatch(/exemple illustratif/i);
    expect(html).not.toMatch(/50\s*%|Hatim Ahmitech|Jalil-NEOXA/i);
    expect(html).not.toMatch(/Rabat|Marrakech|Tanger|Fès/i);
  });

  it("ouvre le dossier fournisseur et le matching de demande", () => {
    const board = buildFranchiseSpaceBoard({ locale: "fr", query: "", crm, libraryName: "Informatique" });
    const folder = renderToStaticMarkup(<NetworkBoard locale="fr" query="" board={board} itemId="44444444-4444-4444-8444-444444444444" view="qualification" />);
    expect(folder).toContain("invite://atlas");
    expect(folder).toContain("/fr/franchise/fournisseurs/44444444-4444-4444-8444-444444444444/capacite");
    expect(folder).toContain("Consigner une activité");
    const matching = renderToStaticMarkup(<FranchiseRequestsBoard locale="fr" query="" board={board} itemId="55555555-5555-4555-8555-555555555555" view="matching" />);
    expect(matching).toContain("name=\"q\"");
    expect(matching).toContain("Matching");
    expect(matching).toContain("Studio Atlas");
    expect(matching).toContain("/fr/franchise/fournisseurs/44444444-4444-4444-8444-444444444444");
    const documents = renderToStaticMarkup(<DocumentsBoard locale="fr" query="" board={board} />);
    expect(documents).toContain("invite://atlas");
    expect(documents).toContain("name=\"q\"");
    const messages = renderToStaticMarkup(<MessagesBoard locale="fr" query="" board={board} />);
    expect(messages).not.toContain("Invitation envoyée");
    expect(messages).toContain("Aucun message lié");
    expect(messages).not.toMatch(/50\s*%|Hatim Ahmitech|Jalil-NEOXA/i);
  });

  it("filtre le réseau et n’expose que la part franchisé", () => {
    const board = buildFranchiseSpaceBoard({
      locale: "fr",
      query: "",
      crm,
      libraryName: "Informatique",
      governance: {
        canApprove: false,
        canManageFinance: false,
        franchises: [],
        approvals: [],
        invitations: [],
        rules: [],
        books: [{
          id: "99999999-9999-4999-8999-999999999999",
          libraryId: "22222222-2222-4222-8222-222222222222",
          organizationId: "22222222-2222-4222-8222-222222222222",
          type: "STANDARD",
          operatorCode: "OP",
          currency: "MAD",
          ruleVersionId: "22222222-2222-4222-8222-222222222222",
          status: "OPEN",
          entryFee: null,
          latestClosure: null,
          closures: [{
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            version: 1,
            periodStart: "2026-09-01",
            periodEnd: "2026-09-30",
            supersedesClosureId: null,
            ruleVersionId: "22222222-2222-4222-8222-222222222222",
            cutoffAt: "2026-09-30T23:59:59.000Z",
            revenueMinor: "10000",
            costsMinor: "2000",
            profitMinor: "8000",
            contentHash: "a".repeat(64),
            closedAt: "2026-09-30T23:59:59.000Z",
            allocations: [
              { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", beneficiaryCode: "FRANCHISEE", shareBps: 5000, amountMinor: "4000", roundingAdjustmentMinor: 0 },
              { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", beneficiaryCode: "NEOXA_JALIL", shareBps: 2500, amountMinor: "2000", roundingAdjustmentMinor: 0 },
            ],
          }],
          allocations: [],
          balances: [],
          ledgerEntries: [{
            id: "1",
            closureVersionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            beneficiaryCode: "FRANCHISEE",
            entryType: "PAYOUT",
            amountMinor: "-1500",
            referenceType: "JOURNAL",
            referenceId: "PAY-1",
            proofHash: "b".repeat(64),
            createdAt: "2026-09-20T00:00:00.000Z",
          }],
          entryFeeLedger: [],
        }],
      },
    });
    const qualified = renderToStaticMarkup(<NetworkBoard locale="fr" query="" board={board} view="qualifies" />);
    expect(qualified).toContain("Studio Atlas");
    expect(qualified).not.toContain("Conseil Anfa");
    const finance = renderToStaticMarkup(<FranchiseFinanceBoard locale="fr" query="" board={board} />);
    expect(finance).toContain("Votre part");
    expect(finance).toContain("40,00");
    expect(finance).toContain("Seule votre part vous est présentée");
    expect(finance).not.toMatch(/50\s*%|Hatim Ahmitech|Jalil-NEOXA|NEOXA_JALIL/i);
    const devis = renderToStaticMarkup(<FranchiseRequestsBoard locale="fr" query="" board={board} view="devis" />);
    expect(devis).toContain("Devis");
    expect(devis).toContain("Aucun devis n’est visible");
    const users = renderToStaticMarkup(<PerimeterBoard locale="fr" query="" board={board} view="utilisateurs" />);
    expect(users).toContain("Utilisateurs du mandat");
    const volume = renderToStaticMarkup(<FranchiseFinanceBoard locale="fr" query="" board={board} view="volume" />);
    expect(volume).toContain("Services éligibles au volume");
    const qualityDefs = renderToStaticMarkup(<QualityBoard locale="fr" query="" board={board} view="definitions" />);
    expect(qualityDefs).toContain("Définitions");
    const incidents = renderToStaticMarkup(<QualityBoard locale="fr" query="" board={board} view="incidents" />);
    expect(incidents).toContain("Incidents");
    const payments = renderToStaticMarkup(<FranchiseFinanceBoard locale="fr" query="" board={board} view="paiements" />);
    expect(payments).toContain("Paiements");
    expect(payments).toContain("15,00");
    expect(payments).toContain("Les paiements sont enregistrés par la plateforme");
    expect(payments).not.toMatch(/50\s*%|Hatim Ahmitech|Jalil-NEOXA|NEOXA_JALIL/i);
    const preStatement = renderToStaticMarkup(<FranchiseFinanceBoard locale="fr" query="" board={board} view="pre-releve" />);
    expect(preStatement).toContain("Pré-relevé");
    expect(preStatement).toContain("Les paiements sont enregistrés par la plateforme");
    expect(volume).not.toMatch(/50\s*%|Hatim Ahmitech|Jalil-NEOXA/i);
  });

  it("affiche les builders d’anomalie, risque, reco, incident, invitation et volume", () => {
    const libraryId = "22222222-2222-4222-8222-222222222222";
    const organizationId = "22222222-2222-4222-8222-222222222222";
    const board = buildFranchiseSpaceBoard({
      locale: "fr",
      query: `?organizationId=${organizationId}`,
      crm,
      libraryName: "Informatique",
      operations: {
        requests: [],
        matching: [],
        quotes: [],
        missions: [],
        anomalies: [],
        recommendations: [],
        opportunities: [],
        qualifications: [{ id: "15151515-1515-4151-8151-151515151515", serviceId: libraryId, serviceCode: "IT_BACKUP", status: "PENDING", rowVersion: 1 }],
        capacities: [],
        documents: [],
        threads: [],
        members: [],
        disputes: [{ id: "19191919-1919-4191-8191-191919191919", status: "WARNING_LEVEL_1", urgency: "URGENT", obligationKey: "SLA_RESPONSE" }],
        skus: [{ id: "20202020-2020-4202-8202-202020202020", code: "IT_BACKUP_SKU", status: "ACTIVE", serviceId: libraryId }],
        anomalyDefinitions: [{ id: "31313131-3131-4313-8313-313131313131", titleFr: "Score critique", titleAr: "درجة حرجة", severity: "CRITICAL", status: "PUBLISHED" }],
      },
    });
    const defs = renderToStaticMarkup(<QualityBoard locale="fr" query={`?organizationId=${organizationId}`} board={board} view="definitions" libraryId={libraryId} organizationId={organizationId} />);
    expect(defs).toContain("Enregistrer la définition");
    expect(defs).toContain("Clé de définition");
    const risks = renderToStaticMarkup(<QualityBoard locale="fr" query={`?organizationId=${organizationId}`} board={board} view="risques" libraryId={libraryId} organizationId={organizationId} />);
    expect(risks).toContain("Enregistrer le modèle de risque");
    const recos = renderToStaticMarkup(<QualityBoard locale="fr" query={`?organizationId=${organizationId}`} board={board} view="recommandations" libraryId={libraryId} organizationId={organizationId} services={[{ id: libraryId, title: "Sauvegarde" }]} />);
    expect(recos).toContain("Associer la recommandation à un service");
    expect(recos).toContain("Anomalie source");
    const incidents = renderToStaticMarkup(<QualityBoard locale="fr" query={`?organizationId=${organizationId}`} board={board} view="incidents" libraryId={libraryId} organizationId={organizationId} />);
    expect(incidents).toContain("Seul le client ouvre un incident");
    expect(incidents).toContain("Consigner l’instruction");
    const users = renderToStaticMarkup(<PerimeterBoard locale="fr" query={`?organizationId=${organizationId}`} board={board} view="utilisateurs" organizationId={organizationId} />);
    expect(users).toContain("Inviter un utilisateur du mandat");
    board.people[0]!.dossier={organizationId:"21212121-2121-4212-8212-212121212121",name:"Studio Atlas",companyStatus:"VERIFIED",status:"ACTIVE",createdAt:"2026-01-01T00:00:00Z",teamSize:5,regions:[],capacities:[],documents:[],qualifications:[{id:"15151515-1515-4151-8151-151515151515",serviceId:libraryId,serviceCode:"IT_BACKUP",status:"PENDING",rowVersion:1}]};
    const folder = renderToStaticMarkup(<NetworkBoard locale="fr" query={`?organizationId=${organizationId}`} board={board} itemId="44444444-4444-4444-8444-444444444444" view="qualification" organizationId={organizationId} />);
    expect(folder).toContain("Décider la qualification de service");
    const volumeForm = renderToStaticMarkup(<FranchiseFinanceBoard locale="fr" query={`?organizationId=${organizationId}`} board={board} view="volume" libraryId={libraryId} organizationId={organizationId} />);
    expect(volumeForm).toContain("Proposer l’achat groupé");
    expect(volumeForm).toContain("Le contrat-cadre est créé ensuite par l’administration");
    const ar = renderToStaticMarkup(<QualityBoard locale="ar" query={`?organizationId=${organizationId}`} board={board} view="definitions" libraryId={libraryId} organizationId={organizationId} />);
    expect(ar).toContain("تسجيل التعريف");
  });

  it("préserve les mesures et documents disponibles quand une autre source est en panne",()=>{
    const board=buildFranchiseSpaceBoard({locale:"fr",query:"",unavailableSections:["CRM"]});
    board.pipeline[1]!.detail="297";
    board.documents.push({id:"22222222-2222-4222-8222-222222222223",title:"Attestation privée réelle",owner:"Prestataire du mandat",status:"VERIFIED",href:"/fr/franchise/documents/22222222-2222-4222-8222-222222222223",kind:"evidence"});
    const home=renderToStaticMarkup(<FranchiseHomeBoard locale="fr" query="" board={board}/>);expect(home).toContain("297");expect(home).toContain("Certaines sections sont temporairement indisponibles");
    const docs=renderToStaticMarkup(<DocumentsBoard locale="fr" query="" board={board}/>);expect(docs).toContain("Attestation privée réelle");expect(docs).toContain("Certaines sections sont temporairement indisponibles");
  });

  it("affiche un état vide hors démo sans inventer un réseau", () => {
    const previous = process.env.MATRICIA_DEMO_ACCESS_ENABLED;
    delete process.env.MATRICIA_DEMO_ACCESS_ENABLED;
    const html = renderToStaticMarkup(<NetworkBoard locale="fr" query="" />);
    expect(html).toContain("Aucun professionnel n’est encore rattaché à votre périmètre.");
    expect(html).not.toContain("Studio Atlas");
    if (previous) process.env.MATRICIA_DEMO_ACCESS_ENABLED = previous;
  });
});

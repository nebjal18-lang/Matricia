import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompanyBoard, DiagnosticsBoard, DocumentsBoard, FinancesBoard, MessagesBoard, MissionsBoard, RequestsBoard, SpaceActions } from "./boards";
import { DisputesBoard } from "./disputes-board";
import { FollowBoard } from "./follow-board";
import { JalonsBoard } from "./milestones-board";
import { RewardsBoard } from "./rewards-board";
import { SecurityBoard } from "./security-board";
import { SubscriptionBoard } from "./subscription-board";
import { getDisputeMessages } from "@/modules/client/screens/litiges/messages";
import { getMissionMessages } from "@/modules/client/screens/missions/messages";
import type { RewardsDashboard } from "@/modules/shared/lib/rewards-referrals-roi/model";
import type { SubscriptionDashboard } from "@/modules/shared/lib/subscriptions/model";

const emptyRewards = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  organizationName: "Client · Communication",
  currentUserId: "00000000-0000-4000-8000-000000000002",
  aal: "aal1",
  canCreateReferral: false,
  canSubmitBaseline: false,
  canReviewSensitive: false,
  canCalculateRoi: false,
  rules: [],
  grants: [],
  links: [],
  conversions: [],
  conversionEvents: [],
  sourceEvents: [],
  approvals: [],
  submissions: [],
  decisions: [],
  baselines: [],
  roiSnapshots: [],
  recommendations: [],
  wallets: [],
} as RewardsDashboard;

const emptySubscription: SubscriptionDashboard = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  organizationName: "Client · Communication",
  plans: [],
  subscription: null,
  capabilities: { canStartTrial: false, canChangePlan: false },
};

describe("client space boards", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("affiche la conversation réelle au centre hors mode démo", () => {
    vi.stubEnv("MATRICIA_DEMO_ACCESS_ENABLED", "false");
    vi.stubEnv("APP_ENV", "production");
    const html = renderToStaticMarkup(
      <MessagesBoard locale="fr" query="" threads={[{ id: "t1", title: "Clarification devis", meta: "Prestataire protégé", href: "/fr/messagerie?fil=t1" }]} organizationName="Acme">
        <p>conversation réelle</p>
      </MessagesBoard>,
    );
    expect(html).toContain("conversation réelle");
    expect(html).not.toContain("client-ops");
    const disputes = renderToStaticMarkup(
      <DisputesBoard locale="fr" query="" organizationName="Acme" cases={[]} selected={null} messages={getDisputeMessages("fr")} canOpen />,
    );
    expect(disputes).toContain("Aucun litige accessible.");
    expect(disputes).not.toContain("Retard de livraison livrables");
  });

  it("aligne le chrome ClientAppShell sur l’accueil (art, FR | AR, marque)", async () => {
    const shell = await readFile(new URL("../../ui/client-app-shell.tsx", import.meta.url), "utf8");
    expect(shell).toContain('/scenes/arch-city.png');
    expect(shell).toContain("brandTagline");
    expect(shell).toContain("brandFooter");
    expect(shell).toContain("languagePair");
    expect(shell).toContain("client-account-named");
    expect(shell).toContain("client-lang-pair");
    expect(shell).toContain("client-shell-topbar");
  });

  it("compose les menus client sur la structure des maquettes", () => {
    vi.stubEnv("MATRICIA_DEMO_ACCESS_ENABLED", "true");
    vi.stubEnv("APP_ENV", "test");
    const html = [
      renderToStaticMarkup(<DiagnosticsBoard locale="fr" questionnaireHref="/fr/client/questionnaires" evolutionHref="/fr/client/diagnostics/evolution" score={null} ratingLabel={null} libraryScores={[]} findings={[]} opportunities={[]} runs={[]} hasSubmittedAssessment={false} />),
      renderToStaticMarkup(<RequestsBoard locale="fr" query="" compareHref="/fr/client/demandes" rows={[{ id: "x", title: "Demande de démonstration à ignorer", status: "Brouillon", last: "Hier", next: "Ouvrir", href: "/fr/client/demandes", tone: "violet" }]} organizationName="Client · Communication" />),
      renderToStaticMarkup(<MissionsBoard locale="fr" query="" />),
      renderToStaticMarkup(<DocumentsBoard locale="fr" query="" />),
      renderToStaticMarkup(<FinancesBoard locale="fr" query="" />),
      renderToStaticMarkup(<CompanyBoard locale="fr" query="" organizationName="Client · Communication" alternate="ar" />),
      renderToStaticMarkup(<MessagesBoard locale="fr" query="" threads={[]}><p>conversation réelle</p></MessagesBoard>),
    ].join("\n");
    expect(html).toContain("Vos priorités du moment");
    expect(html).toContain("Ce que Matricia a compris");
    expect(html).toContain("Reprendre le bilan");
    expect(html).toContain("Mes bilans");
    expect(html).toContain("Avancez à votre rythme");
    expect(html).not.toContain("Structurer votre organisation");
    expect(html).toContain("Toutes vos demandes");
    expect(html).toContain("Demande de démonstration à ignorer");
    expect(html).not.toContain("Conseil stratégique");
    expect(html).toContain("Tous les statuts");
    expect(html).not.toContain("Valider un livrable");
    expect(html).toContain("Une collaboration en toute confiance");
    expect(html).toContain("Plus loin aujourd’hui, pour demain.");
    expect(html).toContain("Documents récents par dossier");
    expect(html).toContain("Factures à examiner");
    expect(html).toContain("client-kpi-cta");
    expect(html).toContain("Voir tous les documents");
    expect(html).toContain("Inviter une personne");
    expect(html).toContain("Profil entreprise");
    expect(html).toContain("Personnes et rôles");
    expect(html).toContain("conversation réelle");
    expect(html).not.toContain("Échange lié à un dossier");
    expect(html).toContain("Client · Communication");
    expect(html).not.toMatch(/exemple illustratif/i);
    expect(html).toContain("Aucun élément à afficher pour le moment.");
    expect(renderToStaticMarkup(<SpaceActions href="/fr/besoin" label="Créer un besoin" />)).toContain("client-cta");
    const disputes = renderToStaticMarkup(
      <DisputesBoard locale="fr" query="" organizationName="Client · Communication" cases={[]} selected={null} messages={getDisputeMessages("fr")} canOpen />,
    );
    expect(disputes).toContain("Aucun litige accessible.");
    expect(disputes).toContain("Ouvrir un litige");
    expect(disputes).not.toContain("Retard de livraison livrables");
    expect(disputes).not.toMatch(/exemple illustratif/i);
  });

  it("tonifie les priorités diagnostic selon la maquette 01", () => {
    const html = renderToStaticMarkup(
      <DiagnosticsBoard
        locale="fr"
        questionnaireHref="/fr/client/questionnaires"
        evolutionHref="/fr/client/diagnostics/evolution"
        score="72.00"
        ratingLabel="À surveiller"
        libraryScores={[]}
        findings={[
          { id: "a1", title: "Sauvegardes non testées", severity: "HIGH", blocking: true, action: "Plan de reprise", why: "Règle versionnée", href: "/fr/client/diagnostics/run-1", cta: "plan" },
          { id: "a2", title: "Démarches à sécuriser", severity: "MEDIUM", blocking: false, action: "Cadrer le besoin", why: "Pièces incomplètes", href: "/fr/besoin", cta: "need" },
          { id: "a3", title: "Opportunités à activer", severity: "LOW", blocking: false, action: "Voir le plan", why: "Potentiel dormant", href: "/fr/client/diagnostics/run-1", cta: "plan" },
        ]}
        opportunities={[]}
        runs={[{ id: "run-1", title: "12 sept. 2026 · 72.00/100", href: "/fr/client/diagnostics/run-1" }]}
        hasSubmittedAssessment
      />,
    );
    expect(html).toContain('data-tone="peach"');
    expect(html).toContain('data-tone="violet"');
    expect(html).toContain('data-tone="sky"');
    expect(html).toContain("Sauvegardes non testées");
    expect(html).toContain("Décrire mon besoin");
    expect(html).toContain("client-resume-card");
    expect(html).not.toMatch(/exemple illustratif/i);
  });

  it("le chrome client utilise le décor Figma et des CTA violets", async () => {
    const css = await readFile(new URL("../../ui/client-experience.css", import.meta.url), "utf8");
    expect(css).toContain("/scene/pattern-bl.png");
    expect(css).toContain("/scene/pattern-tl.png");
    expect(css).toContain("/scene/pattern-br.png");
    expect(css).toContain(".client-shell-topbar");
    expect(css).toContain(".client-lang-pair");
    expect(css).toContain(".client-account-named");
    expect(css).toContain(".client-collab-banner");
    expect(css).toMatch(/\.client-dark-cta[\s\S]*background:\s*var\(--client-cta\)/);
    expect(css).toContain(".client-compare-grid");
    expect(css).toContain(".client-dispute-layout");
    expect(css).toContain(".client-kpi-cta");
    expect(css).toContain(".client-mission-mast");
    expect(css).toContain(".client-brief-kpis");
    expect(css).toContain(".client-follow-triple");
    expect(css).toContain(".client-wizard");
    expect(css).toContain(".client-home-spark");
    expect(css).toContain(".client-insight-kpi");
    expect(css).toContain(".client-assistance-cue");
  });

  it("affiche les constats réels d’un diagnostic, jamais un exemple", () => {
    const html = renderToStaticMarkup(
      <DiagnosticsBoard
        locale="fr"
        questionnaireHref="/fr/client/questionnaires"
        evolutionHref="/fr/client/diagnostics/evolution"
        score="72.00"
        ratingLabel="À surveiller"
        libraryScores={[{ key: "IT", score: "68.00" }]}
        findings={[{ id: "a1", title: "Sauvegardes non testées", severity: "HIGH", blocking: true, action: "Plan de reprise", why: "Règle de diagnostic versionnée", href: "/fr/client/diagnostics/run-1" }]}
        opportunities={[{ id: "o1", title: "Audit du SI", status: "Détectée", href: "/fr/client/diagnostics/run-1" }]}
        runs={[{ id: "run-1", title: "12 sept. 2026 · 72.00/100", href: "/fr/client/diagnostics/run-1" }]}
        hasSubmittedAssessment
      />,
    );
    expect(html).toContain("72.00/100");
    expect(html).toContain("IT");
    expect(html).toContain("68.00/100");
    expect(html).toContain("Sauvegardes non testées");
    expect(html).toContain("Audit du SI");
    expect(html).toContain("Plan de reprise");
    expect(html).toContain("Évolution des diagnostics");
    expect(html).not.toContain("Structurer votre organisation");
  });

  it("affiche la continuité du bilan : évolution, revalidation et assistance", () => {
    const html = renderToStaticMarkup(
      <DiagnosticsBoard
        locale="fr"
        questionnaireHref="/fr/client/questionnaires"
        evolutionHref="/fr/client/diagnostics/evolution"
        score="72.00"
        ratingLabel="À surveiller"
        libraryScores={[{ key: "IT", score: "68.00" }]}
        findings={[{ id: "a1", title: "Sauvegardes non testées", severity: "HIGH", blocking: true, action: "Plan de reprise", why: "Règle de diagnostic versionnée", href: "/fr/client/diagnostics/run-1" }]}
        opportunities={[{ id: "o1", title: "Audit du SI", status: "Prête pour devis", href: "/fr/client/demandes/nouvelle?opportunityId=o1" }]}
        runs={[{ id: "run-1", title: "12 sept. 2026 · 72.00/100", href: "/fr/client/diagnostics/run-1" }]}
        hasSubmittedAssessment
        continuity={{
          evolution: [{ libraryCode: "IT", score: "72.00", delta: "+2.00", href: "/fr/client/diagnostics/run-1" }],
          expiredAnswerCount: 3,
          expiringAnswerCount: 1,
          questionnaireHref: "/fr/client/questionnaires?session=s1",
          proposedCount: 2,
          reassessmentCount: 1,
          assistanceHref: "/fr/client/diagnostics/assistance",
          solutionsHref: "/fr/client/diagnostics/solutions",
        }}
      />,
    );
    expect(html).toContain("Continuité du bilan");
    expect(html).toContain("+2.00");
    expect(html).toContain("Revalider les réponses expirées");
    expect(html).toContain("Comparer Essentielle / Standard / Avancée");
    expect(html).toContain("Examiner l’assistance");
    expect(html).toContain("/fr/client/demandes/nouvelle?opportunityId=o1");
  });

  it("aligne suivi, jalons, abonnement, récompenses et sécurité sur les maquettes", () => {
    vi.stubEnv("MATRICIA_DEMO_ACCESS_ENABLED", "true");
    vi.stubEnv("APP_ENV", "test");
    const follow = renderToStaticMarkup(<FollowBoard locale="fr" query="" organizationName="Client · Communication" mission={null} />);
    expect(follow).toContain("À traiter maintenant");
    expect(follow).toContain("Mes dossiers en cours");
    expect(follow).toContain("Offres à comparer");
    expect(follow).toContain("Mes demandes et missions");
    expect(follow).toContain("Prochaine décision");
    expect(follow).toContain("Documents et renouvellements");
    expect(follow).not.toMatch(/exemple illustratif/i);
    const jalons = renderToStaticMarkup(<JalonsBoard locale="fr" query="" organizationName="Client · Communication" mission={null} messages={getMissionMessages("fr")} />);
    expect(jalons).toContain("Jalons et livrables");
    expect(jalons).toContain("Aucun élément disponible.");
    expect(jalons).toContain("Version signée et immuable");
    expect(jalons).not.toContain("Diagnostic initial");
    expect(jalons).not.toMatch(/exemple illustratif/i);
    const sub = renderToStaticMarkup(
      <SubscriptionBoard locale="fr" query="" dashboard={emptySubscription} credits={{ balance: "0", unitCode: "CRD", memberCount: 1, boxes: [], operations: [] }} />,
    );
    expect(sub).toContain("Mon abonnement");
    expect(sub).toContain("Mes crédits");
    const rewards = renderToStaticMarkup(<RewardsBoard locale="fr" query="" dashboard={emptyRewards} />);
    expect(rewards).toContain("Mes badges");
    expect(rewards).toContain("Parrainez votre réseau");
    const security = renderToStaticMarkup(
      <SecurityBoard
        locale="fr"
        query=""
        organizationName="Client · Communication"
        security={{ status: "success", factors: [], mfaRequired: false, passwordAllowed: true, currentAal: "aal1", requirementSatisfied: true, matchedRoleCodes: [] }}
        sessions={[]}
        members={[]}
      />,
    );
    expect(security).toContain("Authentification multi-facteurs");
    expect(security).toContain("Inviter un membre");
    expect(security).toContain("Préférences de notification");
    expect(security).toContain("Historique de sécurité");
    expect(security).toContain("Adresse e-mail");
    expect(security).toContain("Profil entreprise");
  });

  it("affiche un vide réel hors mode démo, sans overlay illustratif", () => {
    vi.stubEnv("MATRICIA_DEMO_ACCESS_ENABLED", "false");
    vi.stubEnv("APP_ENV", "production");
    const requests = renderToStaticMarkup(<RequestsBoard locale="fr" query="" compareHref="/fr/client/demandes" rows={[]} organizationName="Acme" />);
    expect(requests).toContain("Toutes vos demandes");
    expect(requests).toContain("Aucun élément à afficher");
    expect(requests).not.toContain("Conseil stratégique");
    const missions = renderToStaticMarkup(<MissionsBoard locale="fr" query="" organizationName="Acme" />);
    expect(missions).toContain("Vos prochaines validations");
    expect(missions).not.toContain("Valider un livrable");
    const documents = renderToStaticMarkup(<DocumentsBoard locale="fr" query="" organizationName="Acme" documents={[]} />);
    expect(documents).toContain("Documents récents par dossier");
    expect(documents).not.toContain("Contrat de prestation");
    const finances = renderToStaticMarkup(<FinancesBoard locale="fr" query="" organizationName="Acme" rows={[]} />);
    expect(finances).toContain("Factures à examiner");
    expect(finances).not.toContain("Abonnement Matricia");
    expect(`${requests}${missions}${documents}${finances}`).not.toMatch(/exemple illustratif/i);
  });
});

describe("server-filtered message pages",()=>{
 it("keeps a conversation matched by its private message body even when subject differs",()=>{const html=renderToStaticMarkup(<MessagesBoard locale="fr" query="?organizationId=own" search="texte dans le corps" serverFiltered threads={[{id:"old-thread",title:"Ancien dossier",meta:"Prestataire",href:"/fr/messagerie?fil=old-thread"}]}><p>Conversation disponible</p></MessagesBoard>);expect(html).toContain("Ancien dossier");expect(html).toContain("Conversation disponible");});
 it("shows a failed inbox independently from its healthy open conversation",()=>{const html=renderToStaticMarkup(<MessagesBoard locale="fr" query="" serverFiltered inboxError threads={[]}><p>Conversation disponible</p></MessagesBoard>);expect(html).toContain('role="alert"');expect(html).toContain("Conversation disponible");expect(html).not.toContain("Aucun élément à afficher");});
});

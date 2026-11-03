import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FranchiseLibraryHomeBoard, FranchiseLibraryOverviewBoard, FranchiseWorkQueueBoard } from "./library-boards";
import { validationChipLabel } from "./library-chrome";
import { FranchiseQuestionnairesWorkbench, FranchiseRulesWorkbench, FranchiseServicesWorkbench } from "./library-workbenches";
import {
  FranchiseClientPreviewBranches,
  FranchiseQuestionnaireConstructor,
  FranchiseRuleConstructor,
  FranchiseServiceConstructor,
} from "./constructors";
import { FranchiseValidationsWorkbench } from "./validations-workbench";
import {
  DocumentsBoard,
  FollowupsBoard,
  FranchiseFinanceBoard,
  FranchiseRequestsBoard,
  GovernanceBoard,
  MessagesBoard,
  NetworkBoard,
  PerformanceBoard,
  QualityBoard,
} from "../spaces/boards";
import { resolveFranchiseNestedView, FRANCHISE_NESTED_NAV_PATHS } from "@/modules/franchise/data/spaces/nested-views";
import { demoFranchiseSpaces } from "@/modules/franchise/data/spaces/demo";
import type { FranchiseLibraryWorkspace } from "@/modules/franchise/data/library/workspace";

vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn()}),usePathname:()=>"/fr/franchise/services",useSearchParams:()=>new URLSearchParams()}));

const empty: FranchiseLibraryWorkspace = {
  mandate: {
    franchiseId: "11111111-1111-4111-8111-111111111111",
    operatorCode: "HATIM_AHMITECH",
    type: "IT",
    libraryId: "22222222-2222-4222-8222-222222222222",
    libraryCode: "IT",
    libraryName: "Informatique",
    libraryStatus: "PUBLISHED",
    libraryRowVersion: 1,
    currentReleaseId: null,
  },
  counts: { drafts: 0, inReview: 0, published: 0, returns: 0 },
  categories: [],
  services: [],
  questionnaires: [],
  rules: [],
  questions: [],
  releases: [],
};

const catalog: FranchiseLibraryWorkspace = {
  ...empty,
  counts: { drafts: 1, inReview: 1, published: 1, returns: 0 },
  categories: [{
    id: "cat-1",
    title: "Infrastructure",
    status: "PUBLISHED",
    children: [{ id: "sub-1", title: "Sauvegarde", status: "PUBLISHED" }],
  }],
  services: [{
    id: "33333333-3333-4333-8333-333333333333",
    kind: "SERVICE",
    title: "Sauvegarde gérée",
    code: "IT-BACKUP",
    status: "IN_REVIEW",
    versionLabel: "v1",
    href: "/fr/franchise/services",
    category: "Infrastructure",
    subcategory: "Sauvegarde",
    subcategoryId: "sub-1",
    description: "Sauvegarde managée",
    nameFr: "Sauvegarde gérée",
    nameAr: "نسخ احتياطي مُدار",
  }],
  questionnaires: [{
    id: "44444444-4444-4444-8444-444444444444",
    kind: "QUESTIONNAIRE",
    title: "Diagnostic initial",
    code: "IT-Q1",
    status: "DRAFT",
    versionLabel: "v1",
    href: "/fr/franchise/questionnaires",
    category: "Infrastructure",
    subcategory: "Sauvegarde",
    subcategoryId: "sub-1",
    description: null,
    nameFr: "Diagnostic initial",
    nameAr: null,
  }],
  releases: [{ id: "rel-1", key: "v1.0", status: "PUBLISHED" }],
};

const command = { idempotencyKey: "11111111-1111-4111-8111-111111111111", correlationId: "11111111-1111-4111-8111-111111111112" };
const splitPattern = /50\s*%|Hatim Ahmitech|Jalil-NEOXA/;

describe("alignement maquettes franchise (00–05)", () => {
  it("reproduit la structure accueil bibliothèque mandatée", () => {
    const html = renderToStaticMarkup(<FranchiseLibraryHomeBoard locale="fr" query="" workspace={catalog} />);
    expect(html).toContain("franchise-kpi-tile");
    expect(html).toContain("franchise-pipe-icon");
    expect(html).toContain("File de travail");
    expect(html).toContain("/fr/franchise/actions");
    expect(html).toContain("Soumise");
    expect(html).toContain("franchise-tool-primary");
    expect(html).toContain("franchise-mandate-ok");
    expect(html).toContain("Informatique");
    expect(html).not.toMatch(/exemple illustratif/i);
    expect(html).not.toMatch(splitPattern);
  });

  it("compose la file de travail (04) avec activité et filtres", () => {
    const html = renderToStaticMarkup(<FranchiseWorkQueueBoard locale="fr" query="" workspace={catalog} />);
    expect(html).toContain("À traiter");
    expect(html).toContain("En attente de Matricia");
    expect(html).toContain("Éléments à traiter");
    expect(html).toContain("Filtrer la file de travail");
    expect(html).toContain("Activité récente");
    expect(html).toContain("Informatique");
    expect(html).not.toMatch(/exemple illustratif/i);
  });

  it("compose la bibliothèque mandatée (05) avec arborescence et versions", () => {
    const html = renderToStaticMarkup(<FranchiseLibraryOverviewBoard locale="fr" query="" workspace={catalog} />);
    expect(html).toContain("Arborescence de la bibliothèque");
    expect(html).toContain("Version publiée");
    expect(html).toContain("Couverture du contenu");
    expect(html).toContain("Historique des publications");
    expect(html).toContain("Préparer une nouvelle version");
    expect(html).toContain("Informatique");
    expect(html).not.toMatch(/exemple illustratif/i);
  });

  it("reproduit services, questionnaires et règles en trois colonnes", () => {
    const workspace = catalog;
    const services = renderToStaticMarkup(
      <FranchiseServicesWorkbench locale="fr" query="" workspace={workspace} selectedId={workspace.services[0]!.id} createMode={false} organizationId={null} commandIdentity={command} />,
    );
    const questionnaires = renderToStaticMarkup(
      <FranchiseQuestionnairesWorkbench locale="fr" query="" workspace={workspace} selectedId={null} createMode={false} commandIdentity={command} />,
    );
    const rules = renderToStaticMarkup(
      <FranchiseRulesWorkbench locale="fr" query="" workspace={workspace} selectedId={null} createMode={false} commandIdentity={command} />,
    );
    expect(services).toContain("franchise-workbench");
    expect(services).toContain("franchise-pagination");
    expect(services).toContain("franchise-scope-info");
    expect(services).toContain("Créer une catégorie");
    expect(services).toContain("Créer une sous-catégorie");
    expect(questionnaires).toContain("franchise-mini-pipe");
    expect(questionnaires).toContain("franchise-mandate-banner");
    expect(rules).toContain("#simulation");
    expect(rules).toContain("franchise-workbench");
    expect(rules).toContain("franchise-mandate-banner");
    expect(validationChipLabel("IN_REVIEW", "fr")).toBe("Soumise");
  });

  it("le shell franchise reprend le chrome Figma et le dock mobile", async () => {
    const shell = await readFile(new URL("../../ui/franchise-app-shell.tsx", import.meta.url), "utf8");
    const css = await readFile(new URL("../../ui/franchise-experience.css", import.meta.url), "utf8");
    const nav = await readFile(new URL("../../ui/franchise-nav.ts", import.meta.url), "utf8");
    expect(shell).toContain("brandSpace");
    expect(shell).toContain("franchise-mandate-chip");
    expect(shell).toContain("WorkspaceAccountMenu");
    expect(shell).toContain("franchise-mobile-dock");
    expect(shell).toContain("Contenus");
    expect(shell).toContain("BookOpen");
    expect(shell).not.toContain("franchise/finance");
    expect(nav).toContain("fournisseurs");
    expect(nav).toContain("documents");
    expect(nav).toContain("messages");
    expect(nav).toContain("franchise/finance");
    expect(css).toContain("franchise-security-panel");
    expect(css).toContain("franchise-mandate-ok");
    expect(css).toContain("franchise-workbench");
    expect(css).toContain("franchise-mobile-dock");
    expect(css).toContain("franchise-kanban");
    expect(css).toContain("franchise-library-grid");
    expect(css).toContain("franchise-dense-table");
    expect(css).toContain("franchise-mini-calendar");
  });
  it("expose le dir RTL arabe et le dock mobile dans le shell", async () => {
    const shell = await readFile(new URL("../../ui/franchise-app-shell.tsx", import.meta.url), "utf8");
    expect(shell).toContain('dir={locale === "ar" ? "rtl" : "ltr"}');
    expect(shell).toContain("franchise-mobile-dock");
    expect(shell).toContain("client-lang-switch");
    const homeAr = renderToStaticMarkup(<FranchiseLibraryHomeBoard locale="ar" query="" workspace={catalog} />);
    expect(homeAr).toContain("مسودات للإكمال");
    expect(homeAr).toContain("Informatique");
    expect(homeAr).not.toMatch(/exemple illustratif/i);
  });
});

describe("alignement maquettes constructeurs et espaces (06–20)", () => {
  it("compose les constructeurs service, questionnaire, règle et aperçu branches", () => {
    const html = [
      renderToStaticMarkup(
        <FranchiseServiceConstructor locale="fr" query="" workspace={catalog} service={catalog.services[0]!} createMode={false} commandIdentity={command} organizationId={null} />,
      ),
      renderToStaticMarkup(
        <FranchiseQuestionnaireConstructor locale="fr" query="" workspace={catalog} selectedId={catalog.questionnaires[0]!.id} createMode={false} commandIdentity={command} />,
      ),
      renderToStaticMarkup(
        <FranchiseClientPreviewBranches locale="fr" query="" workspace={catalog} questionnaireId={catalog.questionnaires[0]!.id} />,
      ),
      renderToStaticMarkup(
        <FranchiseRuleConstructor locale="fr" query="" workspace={catalog} selectedId={null} createMode commandIdentity={command} />,
      ),
    ].join("\n");
    expect(html).toContain("franchise-stepper");
    expect(html).toContain("Créer un service");
    expect(html).toContain("Aperçu Client");
    expect(html).toContain("Livrables inclus");
    expect(html).toContain("Composition et version du questionnaire");
    expect(html).toContain("Simulation du questionnaire");
    expect(html).toContain("ne modifie aucun diagnostic réel");
    expect(html).toContain("sur le serveur");
    expect(html).toContain("Conditions et actions de la règle");
    expect(html).toContain("Soumettre à Matricia");
    expect(html).toContain("Informatique");
    expect(html).not.toMatch(/exemple illustratif/i);
  });

  it("compose demandes, fournisseurs, qualité, performance et relances en workbench mandatée", () => {
    const board = demoFranchiseSpaces("fr", "");
    const html = [
      renderToStaticMarkup(<FranchiseRequestsBoard locale="fr" query="" mandateName="Informatique" itemId="d1" view="matching" board={board} />),
      renderToStaticMarkup(<NetworkBoard locale="fr" query="" mandateName="Informatique" board={board} />),
      renderToStaticMarkup(<NetworkBoard locale="fr" query="" mandateName="Informatique" itemId="pr1" view="qualification" board={board} />),
      renderToStaticMarkup(<QualityBoard locale="fr" query="" mandateName="Informatique" board={board} />),
      renderToStaticMarkup(<PerformanceBoard locale="fr" query="" mandateName="Informatique" board={board} />),
      renderToStaticMarkup(<FollowupsBoard locale="fr" query="" mandateName="Informatique" view="pipeline" board={board} />),
    ].join("\n");
    expect(html).toContain("franchise-mandate-banner");
    expect(html).toContain("Vous voyez uniquement votre bibliothèque mandatée");
    expect(html).toContain("/fr/franchise/fournisseurs");
    expect(html).toContain("/fr/franchise/qualite/revues");
    expect(html).toContain("Panier de consultation");
    expect(html).toContain("franchise-kanban");
    expect(html).toContain("Professionnels de votre périmètre");
    expect(html).toContain("Ouvrir le dossier fournisseur");
    expect(html).toContain("Signalements disponibles");
    expect(html).not.toContain("Revues à réaliser");
    expect(html).toContain("franchise-dense-table");
    expect(html).toContain("franchise-perf-kpis");
    expect(html).toContain("Volume de demandes");
    expect(html).toContain("Dossiers ouverts");
    expect(html).toContain("Informatique");
    expect(html).not.toMatch(/exemple illustratif/i);
    expect(html).not.toMatch(splitPattern);
  });

  it("aligne validations, documents, messages et gouvernance sans affichage de répartition", () => {
    const board = demoFranchiseSpaces("fr", "");
    const html = [
      renderToStaticMarkup(<FranchiseValidationsWorkbench locale="fr" query="" workspace={catalog} bucket="approuves" commandIdentity={command} />),
      renderToStaticMarkup(<DocumentsBoard locale="fr" query="" mandateName="Informatique" board={board} />),
      renderToStaticMarkup(<MessagesBoard locale="fr" query="" mandateName="Informatique" board={board} />),
      renderToStaticMarkup(<GovernanceBoard locale="fr" query="" mandateName="Informatique" />),
      renderToStaticMarkup(<FranchiseFinanceBoard locale="fr" query="" mandateName="Informatique" />),
    ].join("\n");
    expect(html).toContain("franchise-pill-tabs");
    expect(html).toContain("Brouillons à soumettre");
    expect(html).toContain("Revue de l’élément sélectionné");
    expect(html).toContain("Expire bientôt");
    expect(html).toContain("Prochains renouvellements");
    expect(html).toContain("franchise-docs-layout");
    expect(html).toContain("franchise-mini-calendar");
    expect(html).toContain("Sensibilité");
    expect(html).toContain("franchise-messages-layout");
    expect(html).toContain("Conversations");
    expect(html).toContain("/fr/franchise/documents/renouvellements");
    expect(html).toContain("/fr/franchise/notifications");
    expect(html).toContain("Vérification financière indisponible");
    expect(html).toContain("Aucun solde ni absence de données ne peut être certifié");
    expect(html).toContain("Demander une modification");
    expect(html).toContain("Informatique");
    expect(html).not.toMatch(splitPattern);
    expect(html).not.toMatch(/exemple illustratif/i);
  });

  it("résout toutes les destinations NAVIGATION imbriquées", () => {
    expect(resolveFranchiseNestedView(["bibliotheque", "categories"])?.kind).toBe("library");
    expect(resolveFranchiseNestedView(["demandes", "d1", "matching"])?.tool).toBe("matching");
    expect(resolveFranchiseNestedView(["notifications"])?.view).toBe("notifications");
    expect(FRANCHISE_NESTED_NAV_PATHS).toHaveLength(57);
    expect(resolveFranchiseNestedView(["clients", "inviter"])?.view).toBe("inviter");
    expect(resolveFranchiseNestedView(["demandes", "devis"])?.view).toBe("devis");
    expect(resolveFranchiseNestedView(["qualite", "anomalies"])?.view).toBe("anomalies");
    expect(resolveFranchiseNestedView(["qualite", "incidents"])?.view).toBe("incidents");
    expect(resolveFranchiseNestedView(["perimetre", "utilisateurs"])?.view).toBe("utilisateurs");
    expect(resolveFranchiseNestedView(["finance", "volume"])?.view).toBe("volume");
    expect(resolveFranchiseNestedView(["finance", "paiements"])?.view).toBe("paiements");
    for (const path of FRANCHISE_NESTED_NAV_PATHS) {
      expect(resolveFranchiseNestedView(path.split("/")), path).not.toBeNull();
    }
  });
});

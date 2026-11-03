import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_SPACE_IDS } from "@/modules/admin/data/spaces/admin-nav";
import { adminCopy } from "@/modules/admin/data/spaces/copy";
import { buildAdminNav } from "@/modules/admin/ui/admin-nav";
import { clientDashboardCopy } from "@/modules/client/data/home/copy";
import { buildClientNav, buildClientPrimaryNav } from "@/modules/client/ui/client-nav";
import { libraryCopy } from "@/modules/franchise/data/library/copy";
import { buildFranchiseNav } from "@/modules/franchise/ui/franchise-nav";
import { providerCopy } from "@/modules/provider/data/spaces/copy";
import { buildProviderNav } from "@/modules/provider/ui/provider-nav";
import { providerFallbackPath } from "@/modules/shared/lib/connected-space/nested-fallbacks";
import { FRANCHISE_NESTED_NAV_PATHS, resolveFranchiseNestedView } from "@/modules/franchise/data/spaces/nested-views";
import { PROVIDER_NESTED_NAV_PATHS, resolveProviderNestedView } from "@/modules/provider/data/spaces/nested-views";

const designRoot = join(process.cwd(), "..", "..", "docs", "design");
const appRoot = join(process.cwd(), "app", "[locale]");

const spaces = [
  { id: "client", dir: "client-dashboard-mockups", entry: "/tableau-de-bord", navCount: 9 },
  { id: "provider", dir: "provider-dashboard-mockups", entry: "/sous-traitant/qualification", navCount: 15 },
  { id: "franchise", dir: "franchise-dashboard-mockups", entry: "/franchise/accueil", navCount: 14 },
  { id: "admin", dir: "admin-dashboard-mockups", entry: "/administration/command-center", navCount: 7 },
] as const;

function page(relative: string) {
  return join(appRoot, relative, "page.tsx");
}

function source(relative: string) {
  return readFileSync(page(relative), "utf8");
}

describe("quatre espaces connectés — documentation et nav", () => {
  it("possède un index design et NAVIGATION.md par espace", () => {
    expect(readFileSync(join(designRoot, "README.md"), "utf8")).toContain("Client");
    for (const space of spaces) {
      const base = join(designRoot, space.dir);
      expect(existsSync(join(base, "NAVIGATION.md"))).toBe(true);
      expect(existsSync(join(base, "README.md"))).toBe(true);
      expect(readFileSync(join(base, "NAVIGATION.md"), "utf8")).toContain(space.entry);
    }
  });

  it("conserve toutes les maquettes PNG documentées", () => {
    const clientPng = [
      "00-accueil-client.png", "01-priorites-diagnostic.png", "02-demandes-devis.png", "03-detail-offre.png",
      "04-projets-missions.png", "05-suivi-projet.png", "06-documents.png", "07-messages.png", "08-finances.png",
      "09-mon-entreprise.png", "10-nouvelle-demande.png", "11-comparer-offres.png", "12-mission-jalons-livrables.png",
      "13-litiges-assistance.png", "14-abonnement-credits-boxes.png", "15-recompenses-parrainage-roi.png",
      "16-entreprise-acces-securite.png",
    ];
    for (const file of clientPng) expect(existsSync(join(designRoot, "client-dashboard-mockups", file))).toBe(true);

    const providerPng = [
      "00-accueil-prestataire.png", "01-qualification.png", "03-consultations.png", "04-devis.png",
      "05-missions-livrables.png", "06-documents.png", "07-facturation.png", "08-reputation.png",
      "09-consultation-detail.png", "10-devis-multiligne.png", "11-devis-revision-soumission.png",
      "12-mission-livraison.png", "13-facture-reglement.png", "14-messages-notifications.png",
      "15-entreprise-acces-securite.png",
    ];
    for (const file of providerPng) expect(existsSync(join(designRoot, "provider-dashboard-mockups", file))).toBe(true);
    expect(
      existsSync(join(designRoot, "provider-dashboard-mockups", "02-services-capacite.png"))
      || existsSync(join(designRoot, "provider-dashboard-mockups", "02-services-capacites.png")),
    ).toBe(true);

    for (const file of [
      "00-accueil-bibliotheque-mandatee.png",
      "01-services-bibliotheque-mandatee.png",
      "02-questions-questionnaires-bibliotheque-mandatee.png",
      "03-regles-simulation-validation-matricia.png",
    ]) {
      expect(existsSync(join(designRoot, "franchise-dashboard-mockups", file))).toBe(true);
    }
  });

  it("expose des libellés FR sans exemple illustratif dans les copies d’espace", () => {
    const blob = [
      clientDashboardCopy.fr.navNeeds,
      clientDashboardCopy.fr.navRewards,
      providerCopy("fr").homeTitle,
      providerCopy("fr").treatNow,
      adminCopy("fr").space,
      libraryCopy("fr").navHome,
    ].join(" ");
    expect(blob.toLowerCase()).not.toContain("exemple illustratif");
  });

  it("aligne client et prestataire sur buildClientNav / buildProviderNav", () => {
    expect(buildClientPrimaryNav({ locale: "fr", selectedQuery: "" })).toHaveLength(9);
    expect(buildClientNav({ locale: "fr", selectedQuery: "" })).toHaveLength(15);
    expect(buildClientNav({ locale: "fr", selectedQuery: "?organizationId=test" }).find((item) => item.key === "memberBoxes")?.href).toBe("/fr/client/boxes/mon-enveloppe?organizationId=test");
    expect(buildClientNav({ locale: "fr", selectedQuery: "" }).some((item) => item.key === "contracts")).toBe(true);
    expect(buildClientNav({ locale: "fr", selectedQuery: "" }).some((item) => item.key === "actions")).toBe(true);
    expect(buildClientNav({ locale: "ar", selectedQuery: "" }).find((item) => item.key === "portfolio")?.label).toBe("المحفظة");
    expect(buildProviderNav("fr", "")).toHaveLength(19);
    for (const locale of ["fr", "ar"] as const) {
      const nav = buildProviderNav(locale, "?organizationId=test");
      expect(nav.find(item => item.key === "contracts")?.href).toBe(`/${locale}/sous-traitant/contrats?organizationId=test`);
      expect(nav.find(item => item.key === "questionnaires")?.href).toBe(`/${locale}/sous-traitant/questionnaires?organizationId=test`);
      for (const item of nav) expect(new URL(item.href, "https://matricia.invalid").searchParams.get("organizationId")).toBe("test");
      expect(new URL(nav.find(item => item.key === "home")!.href, "https://matricia.invalid").searchParams.get("workspace")).toBe("provider");
    }
    expect(buildProviderNav("ar", "").find((item) => item.key === "marketing")).toMatchObject({ label: "التسويق", href: "/ar/sous-traitant/marketing" });
    expect(buildProviderNav("fr", "").some((item) => item.key === "settings")).toBe(true);
    expect(buildProviderNav("fr", "").some((item) => item.key === "messages")).toBe(true);
    expect(buildProviderNav("fr", "").some((item) => item.key === "reputation")).toBe(true);
    expect(buildProviderNav("fr", "").find((item) => item.key === "quotes")?.label).toBe("Mes devis");
  });

  it("aligne admin et franchisé sur buildAdminNav / buildFranchiseNav", () => {
    expect(buildAdminNav("fr", "")).toHaveLength(7);
    expect(buildAdminNav("fr", "").some((item) => item.href.includes("/administration/command-center"))).toBe(true);
    expect(buildFranchiseNav("fr", "")).toHaveLength(17);
    expect(buildFranchiseNav("fr", "").find((item) => item.key === "marketing")).toMatchObject({ label: "Marketing", href: "/fr/franchise/marketing" });
    expect(buildFranchiseNav("fr", "").some((item) => item.href.includes("/franchise/finance"))).toBe(true);
    expect(buildFranchiseNav("fr", "").some((item) => item.href.includes("/franchise/accueil"))).toBe(true);
  });

  it("branche les écrans maquettes client dans ClientAppShell", () => {
    const shelled = [
      "client/diagnostics",
      "client/demandes",
      "client/demandes/[requestId]",
      "client/demandes/[requestId]/offres",
      "client/missions",
      "client/missions/[missionId]",
      "client/missions/[missionId]/jalons",
      "client/documents",
      "messagerie",
      "client/finances",
      "organisation",
      "organisation/roles",
      "client/litiges",
      "client/abonnement",
      "client/credits",
      "client/recompenses",
      "securite/compte",
      "client/diagnostics/evolution",
      "client/actions",
      "client/contrats",
      "client/recherche",
      "client/portefeuille",
      "client/favoris",
      "client/demandes/recurrence",
      "client/diagnostics/assistance",
      "client/diagnostics/solutions",
      "client/achats-groupes",
      "client/onboarding",
      "client/litiges/nouveau",
    ];
    for (const relative of shelled) {
      expect(existsSync(page(relative)), relative).toBe(true);
      const code = source(relative);
      const viaShell = code.includes("ClientAppShell") || code.includes("ConnectedAppShell") || /export \{ default \} from "\.\.\/page"/.test(code);
      expect(viaShell, relative).toBe(true);
    }
    expect(readFileSync(join(process.cwd(), "modules", "client", "ui", "client-app-shell.tsx"), "utf8")).toContain("/client/recherche");
  });

  it("branche les écrans prestataire et les détails imbriqués", () => {
    for (const relative of [
      "sous-traitant/qualification",
      "sous-traitant/services",
      "sous-traitant/consultations",
      "sous-traitant/devis",
      "sous-traitant/missions",
      "sous-traitant/documents",
      "sous-traitant/facturation",
      "sous-traitant/reputation",
      "sous-traitant/planning",
      "sous-traitant/litiges",
      "sous-traitant/achats",
      "sous-traitant/marketing",
    ]) {
      expect(source(relative)).toContain("ProviderAppShell");
    }
    expect(source("sous-traitant/[...slug]")).toContain("providerFallbackPath");
    expect(source("sous-traitant/[...slug]")).toContain("ProviderNestedPage");
    expect(providerFallbackPath(["consultations", "abc"])).toBe("consultations");
    expect(providerFallbackPath(["devis", "abc", "revision"])).toBe("devis");
    expect(resolveProviderNestedView(["consultations", "abc", "documents"])?.view).toBe("documents");
    expect(resolveProviderNestedView(["notifications"])?.view).toBe("notifications");
    for (const path of PROVIDER_NESTED_NAV_PATHS) {
      expect(resolveProviderNestedView(path.split("/")), path).not.toBeNull();
    }
  });

  it("branche l’espace franchisé et rend les sous-routes documentées", () => {
    for (const relative of ["franchise/accueil", "franchise/bibliotheque", "franchise/services", "franchise/questionnaires", "franchise/regles"]) {
      expect(source(relative)).toContain("FranchiseAppShell");
    }
    expect(source("franchise/[...slug]")).toContain("FranchiseNestedPage");
    expect(resolveFranchiseNestedView(["actions"])?.view).toBe("actions");
    expect(resolveFranchiseNestedView(["bibliotheque", "categories"])?.view).toBe("categories");
    expect(resolveFranchiseNestedView(["services", "svc-1", "simulation"])?.tool).toBe("simulation");
    for (const path of FRANCHISE_NESTED_NAV_PATHS) {
      expect(resolveFranchiseNestedView(path.split("/")), path).not.toBeNull();
    }
  });

  it("couvre les routes admin documentées par une page dédiée ou [space]", () => {
    expect(source("administration/command-center")).toContain("AdminAppShell");
    expect(existsSync(page("administration/[space]"))).toBe(true);
    expect(ADMIN_SPACE_IDS).toContain("qualification");
    expect(ADMIN_SPACE_IDS).toContain("litiges");
    for (const route of ["entreprises", "utilisateurs", "clients", "conformite-clients", "providers", "catalogue", "finance", "anti-abus", "operations"]) {
      expect(existsSync(page(`administration/${route}`))).toBe(true);
    }
  });
});

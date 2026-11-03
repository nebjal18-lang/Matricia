import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { adminCopy } from "@/modules/admin/data/spaces/copy";
import { adminActorLinks, adminParcoursLinks } from "@/modules/admin/data/spaces/admin-nav";
import { ADMIN_MOCKUP_SCREENS, genericMockups, matchingMockups } from "@/modules/admin/data/spaces/mockup-coverage";
import { spaceLayoutFamily } from "@/modules/admin/data/spaces/layout-blueprint";
import { buildAdminNav } from "@/modules/admin/ui/admin-nav";
import { SpaceQueueBoard } from "@/modules/admin/screens/spaces/queue-kit";
import { ConsultationSendBoard, DocumentReuseBoard, NotificationPreferencesBoard } from "@/modules/admin/screens/spaces/special-boards";
import { specialBoardCopy } from "@/modules/admin/data/spaces/special-copy";

const mockupDir = join(process.cwd(), "..", "..", "docs", "design", "admin-dashboard-mockups");
const kitSource = readFileSync(new URL("./spaces/queue-kit.tsx", import.meta.url), "utf8");
const blueprintSource = readFileSync(new URL("../data/spaces/layout-blueprint.ts", import.meta.url), "utf8");
const renderSource = readFileSync(new URL("./spaces/render-admin-space.tsx", import.meta.url), "utf8");
const governancePage = readFileSync(new URL("../../../app/[locale]/administration/gouvernance-franchise/page.tsx", import.meta.url), "utf8");

describe("admin dashboard mockups", () => {
  it("documente la navigation et le command center", () => {
    const nav = readFileSync(join(mockupDir, "NAVIGATION.md"), "utf8");
    expect(nav).toContain("/administration/command-center");
    expect(nav).toContain("/administration/catalogue");
    expect(readFileSync(join(mockupDir, "README.md"), "utf8")).toContain("00");
  });

  it("aligne la nav applicative sur les groupes Acteurs et Parcours", () => {
    const actors = adminActorLinks("fr", "");
    const parcours = adminParcoursLinks("fr", "");
    expect(actors.some((link) => link.href.includes("/administration/clients"))).toBe(true);
    expect(parcours.some((link) => link.href.includes("/administration/litiges"))).toBe(true);
    expect(adminCopy("fr").navHome).toBeTruthy();
    expect(buildAdminNav("fr", "")).toHaveLength(7);
    expect(buildAdminNav("fr", "").find((item) => item.key === "parcours")?.href).toContain("/administration/parcours");
  });

  it("couvre les 57 maquettes 00-56 avec un écran list/detail/decision", () => {
    expect(ADMIN_MOCKUP_SCREENS).toHaveLength(57);
    expect(ADMIN_MOCKUP_SCREENS.map((item) => item.id)).toEqual(
      Array.from({ length: 57 }, (_, index) => String(index).padStart(2, "0")),
    );
    for (const screen of ADMIN_MOCKUP_SCREENS) {
      expect(existsSync(join(mockupDir, screen.file)), screen.file).toBe(true);
      expect(screen.route).toContain("/administration/");
    }
    expect(matchingMockups().map((item) => item.id)).toHaveLength(57);
    expect(genericMockups()).toEqual([]);
  });

  it("compose les layouts Figma file, fiche, décision, assistant et comparaison", () => {
    const queue = renderToStaticMarkup(
      <SpaceQueueBoard locale="fr" query="" space="providers" rows={[]} treat={[]} />,
    );
    const diagnostics = renderToStaticMarkup(
      <SpaceQueueBoard locale="fr" query="" space="diagnostics" rows={[]} treat={[]} />,
    );
    expect(queue).toContain("data-admin-layout=\"queue\"");
    expect(queue).toContain("data-admin-family=\"actor-pipeline\"");
    expect(queue).toContain("Parcours prestataire");
    expect(queue).toContain("Dossiers nécessitant une action");
    expect(diagnostics).toContain("data-admin-family=\"parcours-cycle\"");
    expect(diagnostics).toContain("Cycle du diagnostic");
    expect(kitSource).toContain("data-admin-layout=\"detail\"");
    expect(kitSource).toContain("data-admin-layout=\"decision\"");
    expect(kitSource).toContain("data-admin-layout=\"wizard\"");
    expect(kitSource).toContain("data-admin-layout=\"compare\"");
    expect(blueprintSource).toContain("État du dossier");
    expect(kitSource).toContain("Conversation du dossier");
    expect(kitSource).toContain("Aperçu et versions");
    expect(kitSource).toContain("Plan de réaffectation contrôlée");
    expect(blueprintSource).toContain("Objet de la demande");
    expect(renderSource).toContain("gouvernance");
    expect(renderSource).toContain("ConsultationSendBoard");
    expect(renderSource).toContain("DocumentReuseBoard");
    expect(renderSource).toContain("NotificationPreferencesBoard");
    expect(governancePage).toContain("/administration/gouvernance");
    expect(kitSource).not.toMatch(/exemple illustratif/i);
    expect(blueprintSource).not.toMatch(/exemple illustratif/i);
  });

  it("sépare les familles visuelles Acteurs et Parcours", () => {
    expect(spaceLayoutFamily("providers").list).toBe("actor-pipeline");
    expect(spaceLayoutFamily("diagnostics").list).toBe("parcours-cycle");
    expect(spaceLayoutFamily("qualification").decision).toBe("qualification");
    expect(spaceLayoutFamily("litiges").decision).toBe("dispute");
    expect(spaceLayoutFamily("messagerie").detail).toBe("thread");
    expect(spaceLayoutFamily("documents").detail).toBe("document");
  });

  it("compose les écrans consultation, réutilisation et préférences", () => {
    const row = { id: "m1", href: "/fr/administration/matching/m1", title: "Studio Atlas", cells: ["Demande", "Communication", "3", "—", "Revue", "Prêt", "0", "ACTIVE"], status: "ACTIVE", tone: "mint" as const, organizationId: "org-1" };
    const consultation = renderToStaticMarkup(<ConsultationSendBoard locale="fr" query="" row={row} />);
    const reuse = renderToStaticMarkup(<DocumentReuseBoard locale="fr" query="" row={row} />);
    const prefs = renderToStaticMarkup(<NotificationPreferencesBoard locale="fr" query="" />);
    const prefsWithTemplates = renderToStaticMarkup(
      <NotificationPreferencesBoard
        locale="fr"
        query=""
        templates={[{
          id: "11111111-1111-4111-8111-111111111111",
          template_code: "NEW_MESSAGE",
          event_type: "MESSAGE_CREATED",
          category_code: "OPERATIONAL",
          locale: "fr",
          version: 1,
          status: "ACTIVE",
          mandatory: false,
          channels: ["EMAIL", "IN_APP"],
        }]}
      />,
    );
    expect(consultation).toContain("data-admin-layout=\"consultation\"");
    expect(consultation).toContain("Destinataires sélectionnés");
    expect(consultation).toContain("Ouvrir la consultation après approbation");
    expect(reuse).toContain("data-admin-layout=\"document-reuse\"");
    expect(reuse).toContain("Demander le consentement du propriétaire");
    expect(reuse).not.toContain("Destination interdite (autre organisation)");
    expect(reuse).not.toContain("Enregistrer le brouillon");
    expect(prefs).toContain("data-admin-layout=\"notification-preferences\"");
    expect(prefs).toContain("Modèles de notification publiés");
    expect(prefs).toContain("Aucun modèle actif");
    expect(prefs).not.toContain("Créer une règle");
    expect(prefsWithTemplates).toContain("NEW_MESSAGE");
    expect(prefsWithTemplates).toContain("EMAIL · IN_APP");
    expect(specialBoardCopy("fr", "consultation").title).toBe("Préparer et envoyer une consultation");
    expect(consultation).not.toMatch(/exemple illustratif/i);
    expect(reuse).not.toMatch(/exemple illustratif/i);
    expect(prefs).not.toMatch(/exemple illustratif/i);
  });

  it("ancre les tuiles catalogue, finance et opérations du répertoire", () => {
    const finance = readFileSync(new URL("../../../app/[locale]/administration/finance/page.tsx", import.meta.url), "utf8");
    const catalogue = readFileSync(new URL("../../../app/[locale]/administration/catalogue/page.tsx", import.meta.url), "utf8");
    const operations = readFileSync(new URL("./operations/operations-dashboard.tsx", import.meta.url), "utf8");
    const commandCenter = readFileSync(new URL("../../../app/[locale]/administration/command-center/page.tsx", import.meta.url), "utf8");
    const parcours = readFileSync(new URL("../../../app/[locale]/administration/parcours/page.tsx", import.meta.url), "utf8");
    expect(finance).toContain('id="boxes"');
    expect(finance).toContain('id="credits"');
    expect(finance).toContain('id="centres-couts"');
    expect(finance).toContain('hubGroup="finance"');
    expect(catalogue).toContain('id="domaines"');
    expect(catalogue).toContain('id="questions"');
    expect(catalogue).toContain('id="questionnaires"');
    expect(catalogue).toContain('groupId="catalog"');
    expect(operations).toContain('id="outbox"');
    expect(operations).toContain('id="webhooks"');
    expect(operations).toContain('id="parametres"');
    expect(parcours).toContain("AdminHubBoard");
    expect(parcours).toContain('groupId="parcours"');
    expect(commandCenter.indexOf("<AdminDirectoryBoard")).toBeLessThan(commandCenter.indexOf("<CommandCenterPanel"));
    expect(commandCenter).toContain('title={c.space}');
    expect(commandCenter).toContain("id=\"command-today\"");
  });
});

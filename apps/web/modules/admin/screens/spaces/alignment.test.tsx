import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const routePages = new URL("../../../../app/[locale]/administration/", import.meta.url);

async function source(relative: string): Promise<string> {
  return readFile(new URL(relative, routePages), "utf8");
}

describe("alignement visuel de l’espace admin", () => {
  it("le centre de commandement compose l’annuaire Figma et conserve la file opérationnelle", async () => {
    const home = await source("./command-center/page.tsx");
    expect(home).toContain("AdminAppShell");
    expect(home).toContain("AdminDirectoryBoard");
    expect(home).toContain("CommandCenterPanel");
    expect(home).not.toContain("CockpitHero");
    expect(home).not.toContain("admin-shell");
  });

  it("les fiches organisations passent par le shell admin crème", async () => {
    const pages = ["./entreprises/page.tsx", "./entreprises/[organizationId]/page.tsx", "./entreprises/[organizationId]/modifier/page.tsx", "./entreprises/[organizationId]/archiver/page.tsx", "./entreprises/nouvelle/page.tsx"];
    for (const page of pages) {
      const code = await source(page);
      expect(code).toContain("AdminAppShell");
      expect(code).not.toContain("AdminModuleChrome");
      expect(code).not.toContain("admin-shell");
    }
  });

  it("les parcours Acteurs passent par le shell admin crème", async () => {
    const pages = [
      "./utilisateurs/page.tsx",
      "./utilisateurs/inviter/page.tsx",
      "./utilisateurs/[userId]/page.tsx",
      "./utilisateurs/[userId]/roles/page.tsx",
      "./clients/page.tsx",
      "./clients/[organizationId]/page.tsx",
      "./conformite-clients/page.tsx",
      "./conformite-clients/[caseId]/page.tsx",
    ];
    for (const page of pages) {
      const code = await source(page);
      expect(code).toContain("AdminAppShell");
      expect(code).not.toContain("AdminModuleChrome");
      expect(code).not.toContain("admin-shell");
    }
  });

  it("les tableaux Parcours métier passent par le renderer Figma", async () => {
    const page = await source("./[space]/page.tsx");
    const item = await source("./[space]/[itemId]/page.tsx");
    const action = await source("./[space]/[itemId]/[action]/page.tsx");
    expect(page).toContain("renderAdminSpacePage");
    expect(item).toContain("renderAdminSpacePage");
    expect(action).toContain("renderAdminSpacePage");
  });

  it("les CTA d’en-tête admin sont violets et le décor reprend les coins Figma", async () => {
    const kit = await readFile(new URL("../../../../modules/admin/screens/spaces/queue-kit.tsx", import.meta.url), "utf8");
    const css = await readFile(new URL("../../../../modules/admin/ui/admin-experience.css", import.meta.url), "utf8");
    const shell = await readFile(new URL("../../../../modules/admin/ui/admin-app-shell.tsx", import.meta.url), "utf8");
    expect(kit).toContain("admin-primary-cta");
    expect(kit).not.toContain("client-dark-cta");
    expect(kit).toContain("PipelineGlyph");
    expect(shell).toContain("admin-primary-cta");
    expect(shell).not.toContain("client-dark-cta");
    expect(css).toContain("/admin/scene/pattern-bl.png");
    expect(css).toContain("/admin/scene/pattern-tl.png");
    expect(css).toContain("/admin/scene/pattern-br.png");
  });

  it("le shell admin possède le landmark main unique et les boards n’ajoutent pas de main imbriqué", async () => {
    const shell = await readFile(new URL("../../../../modules/admin/ui/admin-app-shell.tsx", import.meta.url), "utf8");
    const boards = await readFile(new URL("../../../../modules/admin/screens/spaces/boards.tsx", import.meta.url), "utf8");
    const kit = await readFile(new URL("../../../../modules/admin/screens/spaces/queue-kit.tsx", import.meta.url), "utf8");
    const modulePage = await readFile(new URL("../../../../modules/admin/ui/admin-module-page.tsx", import.meta.url), "utf8");
    expect(shell).toContain("mainLandmark = true");
    expect(boards).not.toMatch(/<main\b/);
    expect(kit).not.toMatch(/<main\b/);
    expect(modulePage).toContain("useBoard ? undefined : title");
  });
});


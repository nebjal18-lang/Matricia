import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("Version A scene hero on identity hubs", () => {
  it("garde SpaceSceneHero branché sur la fiche org admin", async () => {
    const hero = await readFile(new URL("../../admin/screens/spaces/organization-fiche-hero.tsx", import.meta.url), "utf8");
    expect(hero).toContain("SpaceSceneHero");
    expect(hero).toContain("admin-org-hero");
    expect(hero).toContain("/scenes/arch-city.png");
  });

  it("active sceneHero sur les hubs Client / Provider / Franchise prioritaires", async () => {
    const files = await Promise.all([
      readFile(new URL("../../../app/[locale]/organisation/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../../app/[locale]/client/demandes/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../../app/[locale]/sous-traitant/identite/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../../app/[locale]/sous-traitant/missions/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../../app/[locale]/sous-traitant/devis/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../../app/[locale]/franchise/accueil/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../../app/[locale]/franchise/perimetre/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../../app/[locale]/franchise/finance/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../client/screens/dashboard.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../../app/[locale]/administration/providers/[organizationId]/identite/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../../app/[locale]/administration/conformite-clients/[caseId]/identite/page.tsx", import.meta.url), "utf8"),
    ]);
    for (const source of files) {
      expect(source).toMatch(/sceneHero|SpaceSceneHero/);
    }
    expect(files[8]).toContain("SpaceSceneHero");
    expect(files[8]).toContain("client-home-scene-hero");
  });

  it("expose sceneHero dans les shells partagés", async () => {
    const client = await readFile(new URL("../../client/ui/client-app-shell.tsx", import.meta.url), "utf8");
    const provider = await readFile(new URL("../../provider/ui/provider-app-shell.tsx", import.meta.url), "utf8");
    const franchise = await readFile(new URL("../../franchise/ui/franchise-app-shell.tsx", import.meta.url), "utf8");
    const admin = await readFile(new URL("../../admin/ui/admin-app-shell.tsx", import.meta.url), "utf8");
    for (const shell of [client, provider, franchise, admin]) {
      expect(shell).toContain("sceneHero");
      expect(shell).toContain("SpaceSceneHero");
      expect(shell).toContain("/scenes/arch-city.png");
    }
  });
});

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const routePages = new URL("../../../app/[locale]/franchise/", import.meta.url);
const pages = {
  home: new URL("./accueil/page.tsx", routePages),
  library: new URL("./bibliotheque/page.tsx", routePages),
  services: new URL("./services/page.tsx", routePages),
  questionnaires: new URL("./questionnaires/page.tsx", routePages),
  rules: new URL("./regles/page.tsx", routePages),
  validations: new URL("./validations/page.tsx", routePages),
  validationBucket: new URL("./validations/[bucket]/page.tsx", routePages),
  perimeter: new URL("./perimetre/page.tsx", routePages),
  network: new URL("./reseau/page.tsx", routePages),
  requests: new URL("./demandes/page.tsx", routePages),
  quality: new URL("./qualite/page.tsx", routePages),
  governance: new URL("./gouvernance/page.tsx", routePages),
  performance: new URL("./performance/page.tsx", routePages),
  followups: new URL("./relances/page.tsx", routePages),
  documents: new URL("./documents/page.tsx", routePages),
  messages: new URL("./messages/page.tsx", routePages),
  finance: new URL("./finance/page.tsx", routePages),
  digest: new URL("./digest/page.tsx", routePages),
} as const;

async function source(url: URL): Promise<string> {
  return readFile(url, "utf8");
}

describe("alignement cockpit SIP de l’espace franchisé", () => {
  it("l’accueil franchise compose le shell de périmètre et charge le CRM autorisé", async () => {
    const home = await source(pages.home);
    expect(home).toContain("FranchiseAppShell");
    expect(home).toContain("FranchiseLibraryHomeBoard");
    expect(home).toContain("requireFranchiseLibrary");
    expect(home).not.toContain("bg-muted/40");
    expect(home).not.toContain("CockpitHero");
  });

  it("chaque module franchise passe par FranchiseAppShell, sans ancien chrome", async () => {
    for (const url of Object.values(pages)) {
      const code = await source(url);
      expect(code).toContain("FranchiseAppShell");
      expect(code).not.toContain("AdminModuleChrome");
      expect(code).not.toContain("bg-muted/40");
    }
  });

  it("les pages opérationnelles exposent le bandeau de mandat et le workbench visuel", async () => {
    expect(await source(pages.validations)).toContain("FranchiseValidationsWorkbench");
    expect(await source(pages.validationBucket)).toContain("FranchiseValidationsWorkbench");
    expect(await source(pages.documents)).toContain("DocumentsBoard");
    expect(await source(pages.messages)).toContain("loadFranchiseMessaging");
    expect(await source(pages.messages)).toContain("SendFranchiseMessageForm");
    expect(await source(pages.requests)).toContain("mandateName");
    expect(await source(pages.network)).toContain("mandateName");
    expect(await source(pages.quality)).toContain("mandateName");
    expect(await source(pages.governance)).toContain("GovernanceBoard");
    expect(await source(pages.performance)).toContain("PerformanceBoard");
    expect(await source(pages.followups)).toContain("FollowupsBoard");
    expect(await source(pages.library)).toContain("FranchiseLibraryOverviewBoard");
  });

  it("les modules franchise restent dans l’espace /franchise", async () => {
    for (const url of [pages.governance, pages.performance, pages.followups, pages.digest]) {
      const code = await source(url);
      expect(code).toContain("/franchise/");
    }
  });

  it("l’accueil reste protégé par le préfixe franchise du proxy", async () => {
    const proxy = await readFile(new URL("../../shared/lib/supabase/proxy.ts", import.meta.url), "utf8");
    expect(proxy).toContain('"franchise"');
  });
});

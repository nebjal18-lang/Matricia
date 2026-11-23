import { existsSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { openLocalMarketingChain } from "./helpers/local-marketing-chain.mjs";
import { settleVisualState } from "./helpers/settled-visual-state";

test.describe("P24 Marketing completion",()=>{
  for(const locale of ["fr","ar"] as const){
    test(`${locale.toUpperCase()} authenticated Marketing is responsive, localized and accessible`,async({browser},testInfo)=>{
      const state=process.env.E2E_ADMIN_STORAGE_STATE;
      test.skip(!state||!existsSync(state),"E2E_ADMIN_STORAGE_STATE must reference a generated authenticated admin state");
      const context=await browser.newContext({baseURL:process.env.E2E_BASE_URL??"http://localhost:5173",storageState:state!,locale:locale==="ar"?"ar-MA":"fr-MA",timezoneId:"Africa/Casablanca",viewport:testInfo.project.name.includes("mobile")?{width:360,height:800}:{width:1280,height:900}});
      const page=await context.newPage();
      try{
        await page.goto(`/${locale}/administration/marketing-autopilot`);
        await expect(page).toHaveURL(new RegExp(`/${locale}/administration/marketing-autopilot/?$`));
        await expect(page.locator("html")).toHaveAttribute("dir",locale==="ar"?"rtl":"ltr");
        await expect(page.getByRole("heading",{level:1,name:locale==="ar"?"التسويق الآلي":"Marketing Autopilot"})).toBeVisible();
        await expect(page.getByText(locale==="ar"?"القوالب التجارية":"Templates commerciaux",{exact:true})).toBeVisible();
        await expect(page.getByText(locale==="ar"?"المحتويات المولدة":"Contenus générés",{exact:true}).first()).toBeVisible();
        await expect(page.getByRole("heading",{name:locale==="ar"?"تفويضات وأمان النشر":"Autorisations et sécurité des publications"})).toBeVisible();
        await expect(page.getByRole("button",{name:locale==="ar"?"حفظ النسخة المسودة":"Enregistrer le brouillon versionné",exact:true})).toBeVisible();
        await expect(page.getByRole("button",{name:locale==="ar"?"تطبيق القرار":"Appliquer la décision",exact:true})).toBeVisible();
        const dimensions=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth}));
        expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
        await page.keyboard.press("Tab");await expect(page.locator(":focus")).toBeVisible();
        await settleVisualState(page);
        const audit=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze();
        const violations=audit.violations.map(({id,impact,nodes})=>({id,impact,targets:nodes.flatMap(node=>node.target),contrast:nodes[0]?.any.map(check=>check.data)}));
        expect(violations,`MARKETING_ACCESSIBILITY ${JSON.stringify(violations)}`).toEqual([]);
      }finally{await context.close()}
    });
  }

  test("local authenticated fixture proves generation to publication to attribution chain",async({request}, info)=>{
    const secret=process.env.E2E_CRON_SECRET,fixtureText=process.env.E2E_MARKETING_CHAIN_FIXTURE;
    test.skip(!secret||!fixtureText,"E2E_CRON_SECRET and E2E_MARKETING_CHAIN_FIXTURE are required for the local chain");
    let fixture:{content:Record<string,unknown>;attribution:Record<string,unknown>};
    try{fixture=JSON.parse(fixtureText!)}catch{throw new Error("E2E_MARKETING_CHAIN_FIXTURE must be valid JSON")}
    const headers={authorization:`Bearer ${secret}`};
    const chain = await openLocalMarketingChain(fixture, info.project.name.includes("mobile") ? "FR" : "AR");
    try {
      const generated=await request.post("/api/workers/marketing-content",{headers});
      expect(generated.status()).toBe(200);
      expect(await generated.json(), "MARKETING_GENERATION_RESPONSE").toMatchObject({outcome:"MARKETING_CONTENT_BATCH_GENERATED",count:3});
      const dueAt = await chain.approveAndSchedule();
      await expect.poll(() => Date.now(), {timeout:5000}).toBeGreaterThanOrEqual(dueAt);
      const publication=await request.post("/api/workers/marketing-publications?limit=1",{headers});
      expect(publication.status()).toBe(200);
      const publicationResult=await publication.json() as {processed:number;skipped:number;published:number;sandboxed:number;failed:number;reconciliationRequired:number};
      expect(publicationResult, `MARKETING_PUBLICATION_SANDBOX_RESPONSE processed=${publicationResult.processed} failed=${publicationResult.failed} skipped=${publicationResult.skipped} sandboxed=${publicationResult.sandboxed} reconciliation=${publicationResult.reconciliationRequired}`).toMatchObject({processed:1,skipped:0,published:0,sandboxed:1});
      await chain.verifyPublication();
      const attribution=await request.post("/api/workers/marketing-attribution",{headers,data:{...fixture.attribution,campaignId:chain.campaignId,occurredAt:new Date().toISOString(),idempotencyKey:crypto.randomUUID()}});
      expect(attribution.status()).toBe(200);
      expect(await attribution.json(), "MARKETING_ATTRIBUTION_RESPONSE").toMatchObject({outcome:"MARKETING_ATTRIBUTION_INGESTED",attributed_campaign_id:chain.campaignId});
      await chain.verifyAttribution();
    } finally { await chain.close(); }
  });

  test("anonymous access remains denied in FR and AR",async({page})=>{
    for(const locale of ["fr","ar"] as const){await page.goto(`/${locale}/administration/marketing-autopilot`);await expect(page).toHaveURL(url=>url.pathname===`/${locale}/connexion` && url.searchParams.get("next")===`/${locale}/administration/marketing-autopilot`);await expect(page.locator("html")).toHaveAttribute("dir",locale==="ar"?"rtl":"ltr")}
  });
});

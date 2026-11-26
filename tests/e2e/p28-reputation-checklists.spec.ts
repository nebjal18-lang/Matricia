import { workspaceUrl } from "./helpers/workspace-url";
import { settleVisualState } from "./helpers/settled-visual-state";
import { existsSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function accessible(page:import("@playwright/test").Page){const width=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth}));expect(width.content).toBeLessThanOrEqual(width.viewport);await settleVisualState(page);expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze()).violations).toEqual([])}

for(const locale of["fr","ar"]as const){
 test(`${locale} provider sees governed reputation and executable mission checklist`, async ({browser}, info) => {
  const state = process.env.E2E_PROVIDER_STORAGE_STATE;
  test.skip(!state || !existsSync(state), "provider state required");
  const context = await browser.newContext({baseURL:process.env.E2E_BASE_URL??"http://localhost:5173",storageState:state,viewport:info.project.name.includes("mobile")?{width:360,height:800}:{width:1280,height:900}});
  const page = await context.newPage();
  try {
   await page.goto(workspaceUrl(locale,"sous-traitant/reputation"));
   await expect(page.getByRole("heading",{level:1,name:locale==="ar"?"سمعتكم":"Votre réputation"})).toBeVisible();
   await page.locator("details.client-ops > summary").click();
   await expect(page.getByText(locale==="ar"?"الشارات الخاضعة للحوكمة":"Badges gouvernés")).toBeVisible();
   await accessible(page);
   await page.goto(workspaceUrl(locale,"sous-traitant/missions"));
   await expect(page.getByRole("heading",{level:1,name:locale==="ar"?"المهام والتسليمات":"Missions & livrables"})).toBeVisible();
   await page.locator("#missions-operation > summary").click();
   await expect(page.getByText(locale==="ar"?"قائمة التحقق التعاقدية":"Checklist contractuelle").first()).toBeVisible();
   await accessible(page);
  } finally { await context.close(); }
 });
 test(`${locale} admin publishes an authoritative checklist and sees governed reputation controls`, async ({browser}, info) => {
  const state=process.env.E2E_ADMIN_STORAGE_STATE;
  test.skip(!state||!existsSync(state),"admin state required");
  const context=await browser.newContext({baseURL:process.env.E2E_BASE_URL??"http://localhost:5173",storageState:state,viewport:info.project.name.includes("mobile")?{width:360,height:800}:{width:1280,height:900}});
  const page=await context.newPage();
  try {
   await page.goto(`/${locale}/administration/incitations`);
   await expect(page.getByRole("heading",{level:2,name:locale==="ar"?"السمعة وقوائم التحقق الموثقة":"Réputation et checklists autoritatives"})).toBeVisible();
   await expect(page.getByRole("button",{name:locale==="ar"?"إنشاء لقطة من الأحداث":"Créer un snapshot depuis les événements"})).toBeVisible();
   const publish=locale==="ar"?"نشر قائمة تحقق ثنائية اللغة":"Publier une checklist bilingue";
   const card=page.locator("form").filter({has:page.getByRole("button",{name:publish,exact:true})});
   const runToken=process.env.E2E_P28_RUN_TOKEN, serviceVersionId=process.env.E2E_P28_SERVICE_VERSION_ID;
   if(!runToken||!serviceVersionId)throw new Error("P28_DETERMINISTIC_SERVICE_REQUIRED");
   await card.locator('select[name="serviceVersionId"]').selectOption(serviceVersionId);
   await card.locator('textarea[name="items"]').fill(JSON.stringify([{
    key:"VERIFY_SCOPE",label_fr:"Vérifier le périmètre",label_ar:"فحص النطاق",
    instructions_fr:"Comparer le livrable au contrat.",instructions_ar:"قارن التسليم بالعقد.",
    proof_required:false,proof_types:[],
   }]));
   await card.getByLabel(locale==="ar"?"سبب النشر":"Motif de publication").fill(`E2E ${runToken} ${locale} ${info.project.name}`);
   await card.getByRole("button",{name:publish}).click();
   await expect(card.getByRole("status")).toHaveText(locale==="ar"?"تم تسجيل العملية.":"Opération enregistrée.");
   await accessible(page);
  } finally { await context.close(); }
 });
}

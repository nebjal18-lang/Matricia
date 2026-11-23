import { existsSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { workspaceUrl } from "./helpers/workspace-url";
import { settleVisualState } from "./helpers/settled-visual-state";

type Locale = "fr" | "ar";
const clientSurfaces = [
  { route: "client/diagnostics", heading: { fr: "Mes diagnostics", ar: "تشخيصاتي" } },
  { route: "client/demandes", heading: { fr: "Demandes & devis", ar: "الطلبات والعروض" } },
  { route: "client/missions", heading: { fr: "Projets & missions", ar: "المشاريع والمهام" } },
  { route: "messagerie", heading: { fr: "Messages", ar: "الرسائل" } },
] as const;
const providerSurfaces = [
  { route: "sous-traitant/qualification", heading: { fr: "Votre qualification", ar: "تأهيلكم" } },
  { route: "sous-traitant/devis", heading: { fr: "Vos devis", ar: "عروضكم" } },
  { route: "sous-traitant/missions", heading: { fr: "Missions & livrables", ar: "المهام والتسليمات" } },
  { route: "sous-traitant/reputation", heading: { fr: "Votre réputation", ar: "سمعتكم" } },
  { route: "messagerie", heading: { fr: "Messagerie sécurisée", ar: "المراسلة الآمنة" } },
] as const;

async function session(browser: Browser, storageState: string, locale: Locale, mobile: boolean) {
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173", storageState, locale: locale === "ar" ? "ar-MA" : "fr-MA", timezoneId: "Africa/Casablanca", viewport: mobile ? { width: 360, height: 800 } : { width: 1280, height: 900 } });
  return { context, page: await context.newPage() };
}

async function verifySurface(page: Page, locale: Locale, route: string, heading: string, role?: "provider") {
  const url = workspaceUrl(locale, route, role);
  await page.goto(url);
  await expect(page).toHaveURL(url);
  await expect(page.locator('[data-workspace-failure], [data-error-reason]')).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
  const width = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(width.content, `${route}: content=${width.content}, viewport=${width.viewport}`).toBeLessThanOrEqual(width.viewport);
  await settleVisualState(page);
  const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(audit.violations, JSON.stringify({ route, violations: audit.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })) })).toEqual([]);
}

for (const locale of ["fr", "ar"] as const) {
  test(`${locale.toUpperCase()} client diagnostics to acceptance surfaces are complete`, async ({ browser }, testInfo) => {
    const state = process.env.E2E_CLIENT_STORAGE_STATE;
    test.skip(!state || !existsSync(state), "E2E_CLIENT_STORAGE_STATE must reference an authenticated client state");
    const { context, page } = await session(browser, state!, locale, testInfo.project.name.includes("mobile"));
    try { for (const surface of clientSurfaces) await verifySurface(page, locale, surface.route, surface.heading[locale]); }
    finally { await context.close(); }
  });

  test(`${locale.toUpperCase()} provider qualification to delivery surfaces are complete`, async ({ browser }, testInfo) => {
    const state = process.env.E2E_PROVIDER_STORAGE_STATE;
    test.skip(!state || !existsSync(state), "E2E_PROVIDER_STORAGE_STATE must reference an authenticated provider state");
    const { context, page } = await session(browser, state!, locale, testInfo.project.name.includes("mobile"));
    try { for (const surface of providerSurfaces) await verifySurface(page, locale, surface.route, surface.heading[locale], "provider"); }
    finally { await context.close(); }
  });
}

test("provider upload is scanned before client accepts the delivery and milestone", async ({ browser,request }, info) => {
  const providerState=process.env.E2E_PROVIDER_STORAGE_STATE,clientState=process.env.E2E_CLIENT_STORAGE_STATE;
  const cronSecret=process.env.E2E_CRON_SECRET,workflows=JSON.parse(process.env.E2E_P25_WORKFLOWS??"[]") as Array<{missionId:string;milestoneId:string;deliverableId:string}>;
  test.skip(!providerState||!clientState||!cronSecret||workflows.length!==2||!existsSync(providerState)||!existsSync(clientState),"authenticated P25 mutation fixture is required");
  const index=info.project.name.includes("mobile")?0:1, workflow=workflows[index];
  if(!workflow)throw new Error("P25_PROJECT_WORKFLOW_REQUIRED");
  const milestoneTitle=`Jalon P25 ${index+1}`, deliverableTitle=`Livrable P25 ${index+1}`;
  const provider=await session(browser,providerState!,"fr",false);
  try{
    await provider.page.goto(workspaceUrl("fr", "sous-traitant/missions"));
    await provider.page.locator("#missions-operation > summary").click();
    const submit=provider.page.locator("form").filter({has:provider.page.locator(`input[name="milestoneId"][value="${workflow.milestoneId}"]`)}).getByRole("button",{name:"Soumettre le jalon au client"});
    await expect(submit,"the deterministic E2E tenant must contain a provider-owned pending milestone").toBeVisible();
    await submit.click();
    await expect(provider.page.locator("#missions-operation li").filter({has:provider.page.getByText(milestoneTitle,{exact:true})})).toContainText("Soumis");
    const milestone=provider.page.locator("#missions-operation li").filter({has:provider.page.getByText(milestoneTitle,{exact:true})});
    await expect(milestone).toBeVisible();
    const deliveryForm=provider.page.locator("form").filter({has:provider.page.locator(`input[name="deliverableId"][value="${workflow.deliverableId}"]`)});
    await deliveryForm.locator("xpath=ancestor::details[1]/summary").click();
    await deliveryForm.getByLabel("Description du livrable").fill("Livrable P25 signé et prêt pour contrôle");
    await deliveryForm.getByLabel(/Fichier de preuve/).setInputFiles({name:"preuve-p25.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.7\nP25 deterministic proof\n")});
    await deliveryForm.getByLabel("Note de preuve").fill("Preuve déterministe P25");
    await deliveryForm.getByRole("button",{name:"Soumettre le livrable"}).click();
    await expect(deliveryForm.getByRole("status")).toContainText("Opération enregistrée et auditée");
  }finally{await provider.context.close()}
  const client=await session(browser,clientState!,"fr",false);
  try{
    await client.page.goto("/fr/client/missions");
    await client.page.locator("details.client-ops > summary").click();
    const delivery=client.page.locator(`#deliverable-${workflow.deliverableId}`);
    await expect(delivery).toContainText(deliverableTitle);
    await expect(delivery.getByRole("status")).toContainText("La décision sera disponible lorsque toutes les preuves auront terminé leur analyse de sécurité.");
    await expect(delivery.getByRole("button",{name:"Décider le livrable"})).toHaveCount(0);
    const scan=await request.post("/api/workers/delivery-proof-scans?limit=1",{headers:{authorization:`Bearer ${cronSecret}`}});expect(scan.status()).toBe(200);expect(await scan.json()).toEqual(expect.objectContaining({claimed:1,completed:1,retried:0}));
    await client.page.reload();
    await client.page.locator("details.client-ops > summary").click();
    const acceptance=client.page.locator("form").filter({has:client.page.locator(`input[name="deliverableId"][value="${workflow.deliverableId}"]`)});
    await acceptance.getByLabel(/Commentaire/).fill("Preuve propre et critères conformes");
    await acceptance.getByRole("button",{name:"Décider le livrable"}).click();
    await expect(delivery).toContainText("Accepté");
    await expect(client.page.getByRole("heading",{name:"Jalons en attente de décision"})).toBeVisible();
    const form=client.page.locator("form").filter({has:client.page.locator(`input[name="milestoneId"][value="${workflow.milestoneId}"]`)});
    await form.getByLabel("Motif de la décision").fill("Jalon vérifié et accepté par le parcours E2E");
    await form.getByRole("button",{name:"Accepter le jalon"}).click();
    await expect.poll(async()=>await form.count()===0 || (await form.getByRole("status").allTextContents()).some(text=>text.includes("Opération enregistrée"))).toBe(true);
    await client.page.reload();
    await client.page.locator("details.client-ops > summary").click();
    await expect(delivery).toContainText("Accepté");
    await expect(client.page.locator("details.client-ops li").filter({hasText:milestoneTitle}).last()).toContainText("Accepté");
    await expect(client.page.locator("form").filter({has:client.page.locator(`input[name="milestoneId"][value="${workflow.milestoneId}"]`)})).toHaveCount(0);
  }finally{await client.context.close()}
  const foreignState=process.env.E2E_CLIENT_B_STORAGE_STATE;
  if(!foreignState||!existsSync(foreignState))throw new Error("foreign tenant state is required");
  const foreign=await session(browser,foreignState,"fr",false);
  try{await foreign.page.goto("/fr/client/missions");for(const workflow of workflows)await expect(foreign.page.locator("body")).not.toContainText(workflow.missionId)}finally{await foreign.context.close()}
});

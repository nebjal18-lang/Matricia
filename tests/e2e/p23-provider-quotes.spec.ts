import { existsSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

type Locale = "fr" | "ar";
type ProviderCase = { description: string; invitationId: string };
const copy = {
  fr: { heading: "Vos devis", organization: "Organisation prestataire", choose: "Afficher", accept: "Accepter", save: "Créer la nouvelle version", submit: "Soumettre ce devis", submitted: "Soumise" },
  ar: { heading: "عروضكم", organization: "منظمة مقدم الخدمات", choose: "عرض", accept: "قبول", save: "إنشاء نسخة جديدة", submit: "إرسال العرض", submitted: "مرسل" },
} as const;

function configuration() {
  const required = ["E2E_PROVIDER_STORAGE_STATE", "E2E_CLIENT_B_STORAGE_STATE", "E2E_P23_TARGET_ORGANIZATION_ID", "E2E_P23_DECOY_ORGANIZATION_ID", "E2E_P23_CASES"] as const;
  if (required.some((key) => !process.env[key])) return null;
  try { return { providerState: process.env.E2E_PROVIDER_STORAGE_STATE!, foreignState: process.env.E2E_CLIENT_B_STORAGE_STATE!, targetId: process.env.E2E_P23_TARGET_ORGANIZATION_ID!, decoyId: process.env.E2E_P23_DECOY_ORGANIZATION_ID!, cases: JSON.parse(process.env.E2E_P23_CASES!) as Record<string, ProviderCase> }; }
  catch { return null; }
}

async function accessibility(page: Page, locale: Locale) {
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
  const size = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll<HTMLElement>("body *")].map((element) => {
      const rectangle = element.getBoundingClientRect();
      return { tag:element.tagName.toLowerCase(),slot:element.dataset.slot??"",name:element.getAttribute("name")??"",left:Math.round(rectangle.left),right:Math.round(rectangle.right),width:Math.round(rectangle.width),classes:element.className.toString().slice(0,160) };
    }).filter((item) => item.left < -1 || item.right > viewport+1).reverse().slice(0,16);
    return { viewport, content: document.documentElement.scrollWidth, offenders };
  });
  expect(size.content, JSON.stringify(size.offenders)).toBeLessThanOrEqual(size.viewport);
  for (let index=0;index<6;index+=1) {
    await page.keyboard.press("Tab");
    if (await page.locator("main :focus").count()) break;
  }
  await expect(page.locator("main :focus")).toBeVisible();
  const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(audit.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.flatMap((node) => node.target) }))).toEqual([]);
}

async function tenantDeny(browser: Browser, state: string, locale: Locale, targetId: string, description: string, viewport: { width: number; height: number }) {
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173", storageState: state, viewport, locale: locale === "ar" ? "ar-MA" : "fr-MA", timezoneId: "Africa/Casablanca" });
  const page = await context.newPage();
  try { await page.goto(`/${locale}/sous-traitant/devis?organizationId=${targetId}`); await expect(page.locator("body")).not.toContainText(description); }
  finally { await context.close(); }
}

for (const locale of ["fr", "ar"] as const) {
  test(`${locale.toUpperCase()} Provider invitation, exact quote and submission are accessible and isolated`, async ({ browser }, testInfo) => {
    const config = configuration();
    if (!config || !existsSync(config.providerState) || !existsSync(config.foreignState)) throw new Error("P23 secured fixture is required");
    const mobile = testInfo.project.name.includes("mobile");
    const viewport = mobile ? { width: 360, height: 800 } : { width: 1280, height: 900 };
    const scenario = config!.cases[`${locale}-${mobile ? "mobile" : "desktop"}`];
    expect(scenario).toBeTruthy();
    await tenantDeny(browser, config!.foreignState, locale, config!.targetId, scenario.description, viewport);
    const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173", storageState: config!.providerState, viewport, locale: locale === "ar" ? "ar-MA" : "fr-MA", timezoneId: "Africa/Casablanca" });
    const page = await context.newPage();
    try {
      await page.goto(`/${locale}/sous-traitant/devis?organizationId=${config!.decoyId}`);
      await expect(page.getByRole("heading", { level: 1, name: copy[locale].heading })).toBeVisible();
      await expect(page.locator("body")).not.toContainText(scenario.description);
      await page.getByLabel(copy[locale].organization).selectOption(config!.targetId);
      await page.getByRole("button", { name: copy[locale].choose }).click();
      await expect(page).toHaveURL(new RegExp(`organizationId=${config!.targetId}`));
      const operations = page.locator("#devis-operation");
      if (await operations.count() && !await operations.evaluate(node => (node as HTMLDetailsElement).open)) await operations.locator("summary").click();
      const scenarioLabel = operations.getByText(scenario.description, { exact: true });
      await expect(scenarioLabel).toBeVisible();
      const card = operations.locator('[data-slot="card"]').filter({ has: scenarioLabel });
      await expect(card).toBeVisible();
      const foreignName = process.env.E2E_P23_FOREIGN_ORGANIZATION_NAME;
      if (foreignName) await expect(page.locator("body")).not.toContainText(foreignName);
      await card.getByRole("button", { name: copy[locale].accept }).click();
      await expect(card.locator('[name="solutionFr"]')).toBeVisible();
      await card.locator('[name="solutionFr"]').fill("Solution Provider contrôlée");
      await card.locator('[name="deliverables"]').fill("Audit\nRapport signé");
      await card.locator('[name="warrantyFr"]').fill("Garantie douze mois");
      await card.locator('[name="correctionTermsFr"]').fill("Corrections incluses");
      await card.locator('[name="proposedStartDate"]').fill(new Date(Date.now()+14*86400_000).toISOString().slice(0,10));
      await card.locator('[name="durationDays"]').fill("10");
      await card.locator('[name="validUntil"]').fill(new Date(Date.now()+30*86400_000).toISOString().slice(0,16));
      await card.locator('[name="lineLabelFr"]').fill("Forfait exact");
      await card.locator('[name="quantity"]').fill("1.2500");
      await card.locator('[name="unitCode"]').fill("FORFAIT");
      await card.locator('[name="unitPriceMinor"]').fill("900719925474099300");
      await card.locator('[name="taxRuleVersionId"]').selectOption({ index: 1 });
      await card.locator('[name="changeReason"]').fill("Première version contrôlée");
      await card.getByRole("button", { name: copy[locale].save }).click();
      await expect(card.getByRole("button", { name: copy[locale].submit })).toBeVisible();
      const publication=card.locator('form').filter({has:page.locator('[name="registeredAddress"]')});
      await publication.locator('[name="registeredAddress"]').fill('Adresse de recette locale du prestataire');
      await publication.locator('[name="confirmed"]').check();
      await card.getByRole("button", { name: copy[locale].submit }).click();
      await expect(card).toContainText(copy[locale].submitted);
      await accessibility(page, locale);
    } finally { await context.close(); }
  });
}

import { existsSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { settleVisualState } from "./helpers/settled-visual-state";

type Locale = "fr" | "ar";
type ProviderCase = { description: string; invitationId: string };
test.describe.configure({ timeout: 180_000 });
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
  await settleVisualState(page);
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
  await page.locator("main").getByRole("link").first().focus();
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

const requiredQuoteFields = ["solution", "deliverables", "warranty", "correctionTerms", "paymentTerms", "proposedStartDate", "durationDays", "validUntil", "lineLabel", "quantity", "unitCode", "unitPrice", "taxRuleVersionId", "changeReason"] as const;
async function fillValidQuote(card: Locator) {
  const fields = {
    solution: "Solution Provider contrôlée", deliverables: "Audit\nRapport signé", warranty: "Garantie douze mois",
    correctionTerms: "Corrections incluses", paymentTerms: "Paiement de recette à réception",
    proposedStartDate: new Date(Date.now()+14*86400_000).toISOString().slice(0,10), durationDays: "10",
    validUntil: new Date(Date.now()+30*86400_000).toISOString().slice(0,16), lineLabel: "Forfait exact",
    quantity: "1.2500", unitCode: "FORFAIT", unitPrice: "900719925474099,20", changeReason: "Première version contrôlée",
  };
  for (const [name, value] of Object.entries(fields)) await card.locator(`[name="${name}"]`).fill(value);
  await card.locator('[name="taxRuleVersionId"]').selectOption({ index: 1 });
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
      await page.goto(`/${locale}/sous-traitant/consultations/${scenario.invitationId}?organizationId=${config!.targetId}`);
      await expect(page.getByRole("heading", {level:1,name:scenario.description,exact:true})).toBeVisible();
      let card = page.locator('#consult-quote-panel');
      const foreignName = process.env.E2E_P23_FOREIGN_ORGANIZATION_NAME;
      if (foreignName) await expect(page.locator("body")).not.toContainText(foreignName);
      await page.locator('#invitation-decision').getByRole("button", { name: copy[locale].accept,exact:true }).click();
      await expect(card.locator('[name="solution"]')).toBeVisible();
      const form = card.locator("form").filter({ has: page.locator('[name="solution"]') });
      for (const field of requiredQuoteFields) await test.step(`MAT-FUNC-014 rejects missing ${field} on the server`, async () => {
        await page.reload();
        await expect(form.locator('[name="solution"]')).toBeVisible();
        await settleVisualState(page);
        await fillValidQuote(card);
        if (field === "taxRuleVersionId") await card.locator(`[name="${field}"]`).selectOption("");
        else await card.locator(`[name="${field}"]`).fill("");
        await expect.poll(() => form.evaluate(node => (node as HTMLFormElement).checkValidity())).toBe(false);
        // Adversarial submission bypasses only browser controls; the actual
        // server action must independently reject the incomplete form.
        const response = page.waitForResponse(value => value.request().method() === "POST" && value.url().includes(`/sous-traitant/consultations/${scenario.invitationId}`));
        await form.evaluate(node => { const form = node as HTMLFormElement; form.noValidate = true; form.requestSubmit(); });
        const rejected = await response;
        expect(rejected.status()).toBe(200);
        const validation = locale === "ar" ? "تحقق من الحقول والمبالغ." : "Vérifiez les champs indiqués et les montants.";
        await expect(form.getByRole("alert").filter({ hasText: validation })).toHaveText(validation);
        await expect(card.locator('a[href*="/apercu?"]')).toHaveCount(0);
      });
      await page.reload();
      await expect(form.locator('[name="solution"]')).toBeVisible();
      await settleVisualState(page);
      await fillValidQuote(card);
      await card.getByRole("button", { name: copy[locale].save }).click();
      await card.locator('a[href*="/apercu?"]').click();
      await expect(page).toHaveURL(/\/sous-traitant\/devis\/[^/]+\/apercu\?/u);
      card = page.locator("main.provider-quote-preview");
      await expect(card).toBeVisible();
      await expect(card.getByRole("button", { name: copy[locale].submit })).toBeVisible();
      await settleVisualState(page);
      const publication=card.locator('form').filter({has:page.locator('[name="registeredAddress"]')});
      const address=publication.locator('[name="registeredAddress"]');
      await expect(address).toBeEnabled();
      if(await address.isEditable())await address.fill('Adresse de recette locale du prestataire');
      else await expect(address).not.toHaveValue('');
      await expect(address).not.toHaveValue('');
      await publication.locator('[name="confirmed"]').check();
      await expect(address).not.toHaveValue('');
      await expect(publication.locator('[name="confirmed"]')).toBeChecked();
      await expect.poll(() => publication.evaluate(node => [...(node as HTMLFormElement).elements]
        .filter((element): element is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement => element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)
        .filter(element => !element.validity.valid)
        .map(element => ({ name: element.name, missing: element.validity.valueMissing, tooShort: element.validity.tooShort, patternMismatch: element.validity.patternMismatch })))).toEqual([]);
      const submittedResponse = page.waitForResponse(response => response.request().method() === "POST" && response.url().includes("/apercu"), { timeout: 15_000 });
      await card.getByRole("button", { name: copy[locale].submit }).click();
      const submitted = await submittedResponse;
      expect(submitted.status()).toBe(200);
      try {
        await expect(card.locator(".provider-workbench-hero .client-status-chip")).toHaveText(locale === "fr" ? "Soumis" : "مقدم", { timeout: 15_000 });
      } catch (error) {
        const feedback = await publication.locator('[role="status"], [role="alert"]').allTextContents();
        throw new Error(`P23 submission feedback: ${feedback.join(" | ") || "none"}`, { cause: error });
      }
      await expect(publication).toHaveCount(0);
      await accessibility(page, locale);
    } finally { await context.close(); }
  });
}

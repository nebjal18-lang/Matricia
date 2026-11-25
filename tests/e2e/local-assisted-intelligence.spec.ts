import { expect, test, type Locator, type Page } from "@playwright/test";
import { settleVisualState } from "./helpers/settled-visual-state";

test.describe.configure({ timeout: 90_000 });

async function openAnalysis(page: Page, details: Locator, analysis: Locator) {
  await settleVisualState(page);
  if (await details.getAttribute("open") === null) await details.locator(":scope > summary").click();
  await expect(details).toHaveAttribute("open", "");
  await expect(analysis).toBeVisible();
}

for (const locale of ["fr", "ar"] as const) {
  test(`MAT-FUNC-003 ${locale} records an assisted analysis and a human decision`, async ({ browser }, info) => {
    const state = process.env.E2E_CLIENT_STORAGE_STATE;
    const run = process.env.E2E_P28_RUN_TOKEN;
    if (!state || !run) throw new Error("LOCAL_ASSISTANCE_FIXTURE_REQUIRED");
    const suffix = `${locale.toUpperCase()}_${info.project.name.includes("mobile") ? "M" : "D"}`;
    const context = await browser.newContext({ storageState: state, viewport: info.project.name.includes("mobile") ? { width: 360, height: 800 } : { width: 1280, height: 900 } });
    try {
      const page = await context.newPage();
      await page.goto(`/${locale}/client/diagnostics/assistance`);
      const analysis = page.locator("form").filter({ has: page.locator('[name="inputText"]') });
      const details = page.locator("details").filter({ has: analysis });
      await openAnalysis(page, details, analysis);
      const previousIds = new Set(await page.locator('input[name="suggestionId"]').evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value)));
      await analysis.locator('[name="context"]').selectOption("NEED_TEXT");
      await analysis.locator('[name="inputText"]').fill(`Service de recette locale خدمة اختبار محلي E2E ${run} ${suffix}`);
      await analysis.getByRole("button").click();
      await expect(analysis.getByRole("status")).toContainText(locale === "fr" ? "Analyse terminée" : "اكتمل التحليل");
      await page.reload();
      await openAnalysis(page, details, analysis);
      const ids = await page.locator('input[name="suggestionId"]').evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value));
      const suggestionId = ids.find(id => !previousIds.has(id));
      expect(suggestionId, "A new persisted proposal must be available for human review").toBeDefined();
      const decision = page.locator("form").filter({ has: page.locator(`input[name="suggestionId"][value="${suggestionId}"]`) });
      const article = page.locator("article").filter({ has: decision });
      await expect(article).toContainText(locale === "fr" ? "humaine" : "بشري");
      await decision.locator('[name="rationale"]').fill(`E2E ${run} ${suffix}`);
      await decision.locator(`button[value="${locale === "fr" ? "REJECTED" : "ACCEPTED"}"]`).click();
      await expect(decision).toHaveCount(0);
      await expect(page.getByText(locale === "fr" ? "Décision enregistrée sans action métier automatique." : "تم تسجيل القرار دون إجراء مهني تلقائي.", { exact: true }).first()).toBeVisible();
      await page.reload();
      await openAnalysis(page, details, analysis);
      await expect(page.locator(`input[name="suggestionId"][value="${suggestionId}"]`)).toHaveCount(0);
    } finally { await context.close(); }
  });
}

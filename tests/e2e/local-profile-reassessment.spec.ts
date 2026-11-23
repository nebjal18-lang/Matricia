import { expect, test } from "@playwright/test";
import { settleVisualState } from "./helpers/settled-visual-state";

test.describe.configure({ timeout: 90_000 });
for (const locale of ["fr", "ar"] as const) {
  test(`MAT-FUNC-004 ${locale} profile edit creates and completes a reassessment`, async ({ browser }, info) => {
    const state = process.env.E2E_CLIENT_STORAGE_STATE;
    const run = process.env.E2E_P28_RUN_TOKEN;
    if (!state || !run) throw new Error("LOCAL_PROFILE_FIXTURE_REQUIRED");
    const suffix = `${locale.toUpperCase()}_${info.project.name.includes("mobile") ? "M" : "D"}`;
    const activity = `E2E profile ${run} ${suffix}`;
    const context = await browser.newContext({ storageState: state, viewport: info.project.name.includes("mobile") ? { width: 360, height: 800 } : { width: 1280, height: 900 } });
    try {
      const page = await context.newPage();
      await page.goto(`/${locale}/client/diagnostics/assistance`);
      const select = page.locator('[name="profileReassessmentId"]');
      const before = new Set(await select.locator("option").evaluateAll(options => options.map(option => (option as HTMLOptionElement).value)));
      await page.goto(`/${locale}/client/onboarding`);
      await settleVisualState(page);
      const profile = page.locator("form").filter({ has: page.locator('[name="activity"]') });
      await profile.locator('[name="activity"]').fill(activity);
      for (const box of await profile.locator('input[type="checkbox"][required]').all()) await box.check();
      await profile.locator('button[type="submit"]').click();
      await expect(page.getByRole("status").filter({ hasText: locale === "fr" ? /Version \d+ enregistrée/ : /تم حفظ النسخة/ })).toBeVisible();
      await page.reload();
      await expect(profile.locator('[name="activity"]')).toHaveValue(activity);
      await page.goto(`/${locale}/client/diagnostics/assistance`);
      await settleVisualState(page);
      const analysis = page.locator("form").filter({ has: select });
      const details = page.locator("details").filter({ has: analysis });
      if (await details.getAttribute("open") === null) await details.locator(":scope > summary").click();
      const after = await select.locator("option").evaluateAll(options => options.map(option => (option as HTMLOptionElement).value));
      const added = after.filter(id => id && !before.has(id));
      expect(added).toHaveLength(1);
      const reassessment = added[0];
      if (!reassessment) throw new Error("PROFILE_REASSESSMENT_NOT_CREATED");
      await select.selectOption(reassessment);
      await analysis.locator('[name="context"]').selectOption("PROFILE_CHANGE");
      await analysis.getByRole("button").click();
      await expect(analysis.getByRole("status")).toContainText(locale === "fr" ? "Analyse terminée" : "اكتمل التحليل");
      await page.reload();
      await expect(select.locator(`option[value="${reassessment}"]`)).toHaveCount(0);
    } finally { await context.close(); }
  });
}

import { expect, test } from "@playwright/test";
import { settleVisualState } from "./helpers/settled-visual-state";
import { preferenceInput } from "../../apps/web/modules/shared/lib/notifications/model";

for (const locale of ["fr", "ar"] as const) {
  test(`MAT-FUNC-063 ${locale} persists immediate, digest and disabled preferences`, async ({ browser }, info) => {
    test.setTimeout(90_000);
    const state = process.env.E2E_CLIENT_STORAGE_STATE;
    if (!state || !process.env.E2E_P28_RUN_TOKEN) throw new Error("LOCAL_CLIENT_FIXTURE_REQUIRED");
    const context = await browser.newContext({ storageState: state, baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173", viewport: info.project.name.includes("mobile") ? { width: 360, height: 800 } : { width: 1280, height: 900 } });
    try {
      const page = await context.newPage();
      await page.goto(`/${locale}/notifications`);
      await settleVisualState(page);
      const optional = page.locator("form").filter({ has: page.locator('select[name="deliveryMode"] option[value="DISABLED"]') }).first();
      await expect(optional).toBeVisible();
      const category = await optional.locator('[name="categoryCode"]').inputValue();
      const channel = await optional.locator('[name="channel"]').inputValue();
      const form = page.locator("form").filter({ has: page.locator(`[name="categoryCode"][value="${category}"]`) }).filter({ has: page.locator(`[name="channel"][value="${channel}"]`) });
      for (const mode of ["DIGEST", "DISABLED", "IMMEDIATE"] as const) {
        await form.locator('[name="deliveryMode"]').selectOption(mode);
        if (mode === "DIGEST") await form.locator('[name="digestFrequency"]').selectOption("WEEKLY");
        await expect(form.locator('[name="deliveryMode"]')).toHaveValue(mode);
        await expect(form.locator('[name="notificationLocale"]')).toHaveValue(/^(fr|ar)-MA$/u);
        await expect(form.locator('[name="expectedRowVersion"]')).toHaveValue(/^\d+$/u);
        if (mode === "DIGEST") await expect(form.locator('[name="digestFrequency"]')).toHaveValue("WEEKLY");
        const fields = await form.evaluate(node => {
          const values = new FormData(node as HTMLFormElement);
          return Object.fromEntries(["organizationId", "categoryCode", "channel", "deliveryMode", "digestFrequency", "notificationLocale", "expectedRowVersion", "idempotencyKey"].map(key => [key, String(values.get(key) ?? "")]));
        });
        const parsed = preferenceInput.safeParse({ ...fields, locale: fields.notificationLocale, digestFrequency: mode === "DIGEST" ? fields.digestFrequency : "" });
        expect(parsed.success, parsed.success ? "valid preference" : parsed.error.issues.map(issue => `${issue.path.join(".")}:${issue.code}`).join(",")).toBe(true);
        await form.getByRole("button").click();
        await expect(form.locator('[role="status"], [role="alert"]')).toHaveText(locale === "ar" ? "تم حفظ التفضيل." : "Préférence enregistrée.");
        await page.reload();
        await settleVisualState(page);
        await expect(form.locator('[name="deliveryMode"]')).toHaveValue(mode);
        if (mode === "DIGEST") await expect(form.locator('[name="digestFrequency"]')).toHaveValue("WEEKLY");
        else await expect(form.locator('[name="digestFrequency"]')).toBeDisabled();
      }
      const mandatory = page.locator("form").filter({ has: page.locator('[name="deliveryMode"]') }).filter({ hasNot: page.locator('option[value="DISABLED"]') });
      expect(await mandatory.count()).toBeGreaterThan(0);
      for (const protectedForm of await mandatory.all()) {
        await expect(protectedForm.locator('[name="deliveryMode"] option')).toHaveCount(1);
        await expect(protectedForm.locator('[name="deliveryMode"]')).toHaveValue("IMMEDIATE");
      }
    } finally { await context.close(); }
  });
}

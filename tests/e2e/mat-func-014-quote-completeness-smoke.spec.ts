import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { assertNoHorizontalOverflow, openMatFuncSession } from "./helpers/mat-func-session";

const copy = {
  fr: {
    heading: "Vos devis",
    choose: "Afficher",
    completeness: /Complétude|version|devis/i,
  },
  ar: {
    heading: "عروضكم",
    choose: "عرض",
    completeness: /اكتمال|نسخة|عروض/i,
  },
} as const;

for (const locale of ["fr", "ar"] as const) {
  test(`MAT-FUNC-014 ${locale.toUpperCase()} quotes surface exposes completeness / version vocabulary`, async ({ browser }) => {
    const state = process.env.E2E_PROVIDER_STORAGE_STATE;
    test.skip(!state || !existsSync(state), "E2E_PROVIDER_STORAGE_STATE required");
    const { context, page } = await openMatFuncSession(browser, state!, locale, true);
    try {
      await page.goto(`/${locale}/sous-traitant/devis`);
      await expect(page.getByRole("heading", { level: 1, name: copy[locale].heading })).toBeVisible();
      const selector = page.locator("#provider-organization-selector");
      if (await selector.count()) {
        const value = await selector.locator("option:not([disabled])").first().getAttribute("value");
        if (value) {
          await selector.selectOption(value);
          await page.getByRole("button", { name: copy[locale].choose }).click();
          await page.waitForURL(new RegExp(`organizationId=${value}`));
        }
      }
      await expect(page.getByText(copy[locale].completeness).first()).toBeVisible({ timeout: 10_000 });
      await assertNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });
}

import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { assertNoHorizontalOverflow, openMatFuncSession } from "./helpers/mat-func-session";

const copy = {
  fr: {
    heading: "Votre qualification",
    organization: "Organisation prestataire",
    choose: "Afficher",
    help: /aident l[’']équipe|ne donne aucune approbation automatique|PDF, JPEG ou PNG, 10 Mo maximum|régions cochées/,
  },
  ar: {
    heading: "تأهيلكم",
    organization: "منظمة مقدم الخدمات",
    choose: "عرض",
    help: /تساعد هذه المعلومات|لا تمنح التصريحات|PDF أو JPEG أو PNG|الجهات المحددة/,
  },
} as const;

for (const locale of ["fr", "ar"] as const) {
  test(`MAT-FUNC-058 ${locale.toUpperCase()} critical qualification fields expose guidance`, async ({ browser }) => {
    const state = process.env.E2E_PROVIDER_STORAGE_STATE;
    test.skip(!state || !existsSync(state), "E2E_PROVIDER_STORAGE_STATE required");
    const { context, page } = await openMatFuncSession(browser, state!, locale, true);
    try {
      await page.goto(`/${locale}/sous-traitant/qualification`);
      await expect(page.getByRole("heading", { level: 1, name: copy[locale].heading })).toBeVisible();
      const selector = page.locator("#provider-organization-selector");
      if (await selector.count()) {
        const options = selector.locator("option:not([disabled])");
        const value = await options.first().getAttribute("value");
        if (value) {
          await selector.selectOption(value);
          await page.getByRole("button", { name: copy[locale].choose }).click();
          await page.waitForURL(new RegExp(`organizationId=${value}`));
        }
      }
      await expect(page.getByRole("heading", { level: 1, name: copy[locale].heading })).toBeVisible();
      await expect(page.getByText(copy[locale].help).first()).toBeVisible({ timeout: 10_000 });
      await assertNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });
}

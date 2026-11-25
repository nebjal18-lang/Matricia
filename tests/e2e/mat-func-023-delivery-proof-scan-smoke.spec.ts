import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { assertNoHorizontalOverflow, openMatFuncSession } from "./helpers/mat-func-session";

const copy = {
  fr: {
    heading: /Missions|livrables/i,
    choose: "Afficher",
    proof: /preuves?|scan|CLEAN|PENDING|formats acceptés/i,
  },
  ar: {
    heading: /المهام|التسليمات/i,
    choose: "عرض",
    proof: /الأدلة|دليل|فحص|CLEAN|PENDING|الصيغ المقبولة/i,
  },
} as const;

for (const locale of ["fr", "ar"] as const) {
  test(`MAT-FUNC-023 ${locale.toUpperCase()} mission surface exposes delivery proof / scan guidance`, async ({ browser }) => {
    const state = process.env.E2E_PROVIDER_STORAGE_STATE;
    test.skip(!state || !existsSync(state), "E2E_PROVIDER_STORAGE_STATE required");
    const { context, page } = await openMatFuncSession(browser, state!, locale, true);
    try {
      await page.goto(`/${locale}/sous-traitant/missions`);
      await expect(page.locator("h1").first()).toBeVisible();
      await expect(page.locator("h1").first()).toHaveText(copy[locale].heading);
      const selector = page.locator("#provider-organization-selector");
      if (await selector.count()) {
        const value = await selector.locator("option:not([disabled])").first().getAttribute("value");
        if (value) {
          await selector.selectOption(value);
          await page.getByRole("button", { name: copy[locale].choose }).click();
          await page.waitForURL(new RegExp(`organizationId=${value}`));
        }
      }
      const ops = page.locator("#missions-operation");
      if ((await ops.count()) && !(await ops.evaluate((node) => (node as HTMLDetailsElement).open))) {
        await ops.locator("summary").click();
      }
      await expect(page.getByText(copy[locale].proof).first()).toBeVisible({ timeout: 10_000 });
      await assertNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });
}

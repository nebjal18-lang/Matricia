import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { assertNoHorizontalOverflow, openMatFuncSession } from "./helpers/mat-func-session";

const copy = {
  fr: {
    heading: "Votre qualification",
    organization: "Organisation prestataire",
    choose: "Afficher",
    capacityHeading: "Déclarer une capacité",
    statusLabel: "État de capacité",
    statuses: ["AVAILABLE", "LIMITED", "FULL", "PAUSED"] as const,
  },
  ar: {
    heading: "تأهيلكم",
    organization: "منظمة مقدم الخدمات",
    choose: "عرض",
    capacityHeading: "التصريح بالقدرة",
    statusLabel: "حالة القدرة",
    statuses: ["AVAILABLE", "LIMITED", "FULL", "PAUSED"] as const,
  },
} as const;

for (const locale of ["fr", "ar"] as const) {
  test(`MAT-FUNC-020 ${locale.toUpperCase()} capacity form exposes four versioned states`, async ({ browser }) => {
    const state = process.env.E2E_PROVIDER_STORAGE_STATE;
    test.skip(!state || !existsSync(state), "E2E_PROVIDER_STORAGE_STATE required");
    const { context, page } = await openMatFuncSession(browser, state!, locale, true);
    try {
      await page.goto(`/${locale}/sous-traitant/qualification`);
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
      const ops = page.locator("#qualification");
      if ((await ops.count()) && !(await ops.evaluate((node) => (node as HTMLDetailsElement).open))) {
        await ops.locator("summary").click();
      }
      await expect(page.getByRole("heading", { name: copy[locale].capacityHeading }).first()).toBeVisible({ timeout: 10_000 });
      const status = page.getByLabel(copy[locale].statusLabel, { exact: true }).first();
      await expect(status).toBeVisible();
      for (const value of copy[locale].statuses) {
        await expect(status.locator(`option[value="${value}"]`)).toHaveCount(1);
      }
      await assertNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });
}

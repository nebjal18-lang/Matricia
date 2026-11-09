import { existsSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { openMatFuncSession } from "./helpers/mat-func-session";

const surfaces = [
  { route: "client/documents", heading: { fr: "Documents", ar: "الوثائق" } },
  { route: "client/questionnaires", heading: { fr: "Mes questionnaires", ar: "استبياناتي" } },
] as const;

for (const locale of ["fr", "ar"] as const) {
  test(`MAT-FUNC-061 ${locale.toUpperCase()} axe smoke on critical authenticated surfaces`, async ({ browser }) => {
    const state = process.env.E2E_CLIENT_STORAGE_STATE;
    test.skip(!state || !existsSync(state), "E2E_CLIENT_STORAGE_STATE required");
    const { context, page } = await openMatFuncSession(browser, state!, locale, true);
    try {
      for (const surface of surfaces) {
        await page.goto(`/${locale}/${surface.route}`);
        await expect(page.getByRole("heading", { level: 1, name: surface.heading[locale] })).toBeVisible();
        const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        expect(audit.violations.map(({ id, impact }) => ({ id, impact }))).toEqual([]);
      }
    } finally {
      await context.close();
    }
  });
}

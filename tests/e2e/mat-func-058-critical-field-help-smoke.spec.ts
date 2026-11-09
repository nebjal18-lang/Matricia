import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { assertNoHorizontalOverflow, openMatFuncSession } from "./helpers/mat-func-session";

for (const locale of ["fr", "ar"] as const) {
  test(`MAT-FUNC-058 ${locale.toUpperCase()} critical qualification fields expose guidance`, async ({ browser }) => {
    const state = process.env.E2E_PROVIDER_STORAGE_STATE;
    test.skip(!state || !existsSync(state), "E2E_PROVIDER_STORAGE_STATE required");
    const { context, page } = await openMatFuncSession(browser, state!, locale, true);
    try {
      await page.goto(`/${locale}/sous-traitant/qualification`);
      await expect(page.getByRole("heading", { level: 1, name: locale === "ar" ? "تأهيلكم" : "Votre qualification" })).toBeVisible();
      const help =
        locale === "ar"
          ? /تساعد هذه المعلومات|لا تمنح التصريحات/
          : /aident l’équipe|ne donne aucune approbation automatique/;
      await expect(page.getByText(help).first()).toBeVisible();
      await assertNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });
}

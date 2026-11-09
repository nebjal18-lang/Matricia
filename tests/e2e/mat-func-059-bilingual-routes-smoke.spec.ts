import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { openMatFuncSession } from "./helpers/mat-func-session";

const pairs = [
  { fr: "client/portefeuille", ar: "client/portefeuille", heading: { fr: "Portefeuille Client", ar: "محفظة العميل" } },
  { fr: "notifications", ar: "notifications", heading: { fr: "Centre de notifications", ar: "مركز الإشعارات" } },
] as const;

test("MAT-FUNC-059 bilingual route parity", async ({ browser }) => {
  const state = process.env.E2E_CLIENT_STORAGE_STATE;
  test.skip(!state || !existsSync(state), "E2E_CLIENT_STORAGE_STATE required");
  for (const pair of pairs) {
    for (const locale of ["fr", "ar"] as const) {
      const { context, page } = await openMatFuncSession(browser, state!, locale, true);
      try {
        await page.goto(`/${locale}/${pair.fr}`);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.getByRole("heading", { level: 1, name: pair.heading[locale] })).toBeVisible();
      } finally {
        await context.close();
      }
    }
  }
});

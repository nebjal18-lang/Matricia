import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { assertNoHorizontalOverflow, openMatFuncSession } from "./helpers/mat-func-session";

const criticalClientRoutes = [
  { route: "client/diagnostics", heading: { fr: "Mes diagnostics", ar: "تشخيصاتي" } },
  { route: "client/demandes", heading: { fr: "Demandes & devis", ar: "الطلبات والعروض" } },
  { route: "client/missions", heading: { fr: "Projets & missions", ar: "المشاريع والمهام" } },
  { route: "client/finances", heading: { fr: "Mes finances", ar: "أموالي" } },
  { route: "client/questionnaires", heading: { fr: "Mes questionnaires", ar: "استبياناتي" } },
] as const;

for (const locale of ["fr", "ar"] as const) {
  test(`MAT-FUNC-054 ${locale.toUpperCase()} critical client matrix at 360px`, async ({ browser }) => {
    const state = process.env.E2E_CLIENT_STORAGE_STATE;
    test.skip(!state || !existsSync(state), "E2E_CLIENT_STORAGE_STATE required");
    const { context, page } = await openMatFuncSession(browser, state!, locale, true);
    try {
      for (const surface of criticalClientRoutes) {
        await test.step(surface.route, async () => {
          await page.goto(`/${locale}/${surface.route}`);
          await expect(page.getByRole("heading", { level: 1, name: surface.heading[locale] })).toBeVisible();
          await assertNoHorizontalOverflow(page);
        });
      }
    } finally {
      await context.close();
    }
  });
}

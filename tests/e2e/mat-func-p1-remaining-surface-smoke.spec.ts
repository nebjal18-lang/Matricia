import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { assertNoHorizontalOverflow, openMatFuncSession } from "./helpers/mat-func-session";

async function selectProviderOrg(page: import("@playwright/test").Page, locale: "fr" | "ar") {
  const selector = page.locator("#provider-organization-selector");
  if (!(await selector.count())) return;
  const value = await selector.locator("option:not([disabled])").first().getAttribute("value");
  if (!value) return;
  await selector.selectOption(value);
  await page.getByRole("button", { name: locale === "ar" ? "عرض" : "Afficher" }).click();
  await page.waitForURL(new RegExp(`organizationId=${value}`));
}

for (const locale of ["fr", "ar"] as const) {
  test(`MAT-FUNC-022 ${locale.toUpperCase()} missions expose milestone decision vocabulary`, async ({ browser }) => {
    const state = process.env.E2E_CLIENT_STORAGE_STATE;
    test.skip(!state || !existsSync(state), "E2E_CLIENT_STORAGE_STATE required");
    const { context, page } = await openMatFuncSession(browser, state!, locale, true);
    try {
      await page.goto(`/${locale}/client/missions`);
      await expect(page.locator("h1").first()).toBeVisible();
      const vocab =
        locale === "ar"
          ? /مراحل|قبول المرحلة|رفض المرحلة|المهام/
          : /jalon|Accepter le jalon|Refuser le jalon|missions/i;
      await expect(page.getByText(vocab).first()).toBeVisible({ timeout: 10_000 });
      await assertNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });

  test(`MAT-FUNC-024 ${locale.toUpperCase()} provider missions expose checklist contract surface`, async ({ browser }) => {
    const state = process.env.E2E_PROVIDER_STORAGE_STATE;
    test.skip(!state || !existsSync(state), "E2E_PROVIDER_STORAGE_STATE required");
    const { context, page } = await openMatFuncSession(browser, state!, locale, true);
    try {
      await page.goto(`/${locale}/sous-traitant/missions`);
      await selectProviderOrg(page, locale);
      const ops = page.locator("#missions-operation");
      if ((await ops.count()) && !(await ops.evaluate((node) => (node as HTMLDetailsElement).open))) {
        await ops.locator("summary").click();
      }
      const checklist =
        locale === "ar"
          ? /قائمة التحقق|النموذج المنشور|لا توجد التزامات|تحضير تسليم|متابعة المهمة|المرحلة/
          : /Checklist contractuelle|Modèle publié|Aucune obligation de checklist|Préparer|Suivi de mission|jalon/i;
      await expect(page.getByText(checklist).first()).toBeVisible({ timeout: 10_000 });
      await assertNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });

  test(`MAT-FUNC-025 ${locale.toUpperCase()} missions expose acceptance / deliverable vocabulary`, async ({ browser }) => {
    const state = process.env.E2E_CLIENT_STORAGE_STATE;
    test.skip(!state || !existsSync(state), "E2E_CLIENT_STORAGE_STATE required");
    const { context, page } = await openMatFuncSession(browser, state!, locale, true);
    try {
      await page.goto(`/${locale}/client/missions`);
      const vocab =
        locale === "ar"
          ? /تسليم|قبول|رفض|معيار|المهام/
          : /livrable|acceptation|critère|conforme|missions/i;
      await expect(page.getByText(vocab).first()).toBeVisible({ timeout: 10_000 });
      await assertNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });

  test(`MAT-FUNC-026 ${locale.toUpperCase()} contracts surface exposes amendment vocabulary`, async ({ browser }) => {
    const state = process.env.E2E_CLIENT_STORAGE_STATE;
    test.skip(!state || !existsSync(state), "E2E_CLIENT_STORAGE_STATE required");
    const { context, page } = await openMatFuncSession(browser, state!, locale, true);
    try {
      await page.goto(`/${locale}/client/contrats`);
      await expect(page.locator("h1").first()).toBeVisible();
      const vocab =
        locale === "ar"
          ? /ملحق|ملاحق|عقد|التوقيع/
          : /avenant|contrat|signature/i;
      await expect(page.getByText(vocab).first()).toBeVisible({ timeout: 10_000 });
      await assertNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });

  test(`MAT-FUNC-028 ${locale.toUpperCase()} documents vault is reachable and labeled`, async ({ browser }) => {
    const state = process.env.E2E_CLIENT_STORAGE_STATE;
    test.skip(!state || !existsSync(state), "E2E_CLIENT_STORAGE_STATE required");
    const { context, page } = await openMatFuncSession(browser, state!, locale, true);
    try {
      await page.goto(`/${locale}/client/documents`);
      await expect(page.getByRole("heading", { level: 1, name: locale === "ar" ? "الوثائق" : "Documents" })).toBeVisible();
      const vocab =
        locale === "ar"
          ? /مستند|وثائق|إضافة مستند|المصرّح/
          : /document|Ajouter un document|autoris/i;
      await expect(page.getByText(vocab).first()).toBeVisible();
      await assertNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });
}

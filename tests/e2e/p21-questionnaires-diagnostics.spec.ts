import { existsSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

type Locale = "fr" | "ar";
const surfaces = [
  { route: "client/questionnaires", heading: { fr: "Mes questionnaires", ar: "استبياناتي" } },
  { route: "client/diagnostics", heading: { fr: "Mes diagnostics", ar: "تشخيصاتي" } },
  { route: "client/diagnostics/assistance", heading: { fr: "Demander une assistance", ar: "طلب مساعدة" } },
  { route: "client/diagnostics/solutions", heading: { fr: "Solutions adaptées à vos priorités", ar: "حلول مناسبة لأولوياتكم" } },
  { route: "client/diagnostics/evolution", heading: { fr: "Évolution de mes diagnostics", ar: "تطور تشخيصاتي" } },
] as const;

async function accessibleReflow(page: Page, locale: Locale) {
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
  const size = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(size.content).toBeLessThanOrEqual(size.viewport);
  const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(audit.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.flatMap((node) => node.target) }))).toEqual([]);
}

async function authenticatedPage(browser: Browser, storageState: string, locale: Locale, viewport: { width: number; height: number }) {
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173", storageState, locale: locale === "ar" ? "ar-MA" : "fr-MA", timezoneId: "Africa/Casablanca", viewport });
  return { context, page: await context.newPage() };
}

for (const locale of ["fr", "ar"] as const) {
  test(`${locale.toUpperCase()} questionnaire and diagnostics journey is tenant-safe and accessible`, async ({ browser }, testInfo) => {
    const storageState = process.env.E2E_CLIENT_STORAGE_STATE;
    test.skip(!storageState || !existsSync(storageState), "E2E_CLIENT_STORAGE_STATE must reference a generated authenticated state");
    const viewport = testInfo.project.name.includes("mobile") ? { width: 360, height: 800 } : { width: 1280, height: 900 };
    const { context, page } = await authenticatedPage(browser, storageState!, locale, viewport);
    try {
      for (const surface of surfaces) {
        await page.goto(`/${locale}/${surface.route}`);
        await expect(page).toHaveURL(new RegExp(`/${locale}/${surface.route}/?$`));
        await expect(page.getByRole("heading", { level: 1, name: surface.heading[locale] })).toBeVisible();
        const foreignOrganization = process.env.E2E_FOREIGN_ORGANIZATION_NAME;
        if (foreignOrganization) await expect(page.locator("body")).not.toContainText(foreignOrganization);
        await page.keyboard.press("Tab");
        await expect(page.locator(":focus")).toBeVisible();
        await accessibleReflow(page, locale);
      }
    } finally {
      await context.close();
    }
  });
}

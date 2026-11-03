import { existsSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

type Locale = "fr" | "ar";
type Surface = { name: string; route: string; stateVariable: "E2E_ADMIN_STORAGE_STATE" | "E2E_CLIENT_STORAGE_STATE"; heading: Record<Locale,string>; navigation?: Record<Locale,string> };

const surfaces: Surface[] = [
  { name: "command center", route: "administration/command-center", stateVariable: "E2E_ADMIN_STORAGE_STATE", heading: { fr: "Administration Matricia", ar: "إدارة ماتريسيا" }, navigation: { fr: "Navigation du command center", ar: "التنقل في مركز القيادة" } },
  { name: "marketing autopilot", route: "administration/marketing-autopilot", stateVariable: "E2E_ADMIN_STORAGE_STATE", heading: { fr: "Marketing Autopilot", ar: "التسويق الآلي" } },
  { name: "diagnostics", route: "client/diagnostics", stateVariable: "E2E_CLIENT_STORAGE_STATE", heading: { fr: "Mes diagnostics", ar: "تشخيصاتي" } },
];

async function expectAccessible(page: Page) {
  const size = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(size.content).toBeLessThanOrEqual(size.viewport);
  const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(audit.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.flatMap((node) => node.target) })), "Automated accessibility violations").toEqual([]);
}

async function openAuthenticated(browser: Browser, statePath: string, locale: Locale, route: string, viewport: {width:number;height:number}) {
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173", storageState: statePath, locale: locale === "ar" ? "ar-MA" : "fr-MA", timezoneId: "Africa/Casablanca", viewport });
  const page = await context.newPage();
  await page.goto(`/${locale}/${route}`);
  return { context, page };
}

for (const surface of surfaces) {
  for (const locale of ["fr", "ar"] as const) {
    test(`authenticated ${surface.name} ${locale.toUpperCase()} is RTL-safe, keyboard reachable and accessible`, async ({ browser }, testInfo) => {
      const statePath = process.env[surface.stateVariable];
      if (!statePath || !existsSync(statePath)) throw new Error("A generated authenticated diagnostic state is required");
      const viewport = testInfo.project.name.includes("mobile") ? { width: 360, height: 800 } : { width: 1280, height: 900 };
      const { context, page } = await openAuthenticated(browser, statePath!, locale, surface.route, viewport);
      await expect(page).toHaveURL(new RegExp(`/${locale}/${surface.route}/?$`));
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      await expect(page.getByRole("heading", { level: 1, name: surface.heading[locale] })).toBeVisible();
      if (surface.navigation) await expect(page.getByRole("navigation", { name: surface.navigation[locale] })).toBeVisible();
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus")).toBeVisible();
      await expectAccessible(page);
      await context.close();
    });
  }
}

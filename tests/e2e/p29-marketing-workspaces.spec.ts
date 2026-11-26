import { existsSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { settleVisualState } from "./helpers/settled-visual-state";

type Locale = "fr" | "ar";
type Workspace = { name: string; route: string; stateVariable: "E2E_PROVIDER_STORAGE_STATE" | "E2E_FRANCHISE_STORAGE_STATE" };

const workspaces: Workspace[] = [
  { name: "Provider", route: "sous-traitant/marketing", stateVariable: "E2E_PROVIDER_STORAGE_STATE" },
  { name: "Franchise", route: "franchise/marketing", stateVariable: "E2E_FRANCHISE_STORAGE_STATE" },
];

const copy = {
  fr: { heading: "Marketing", prefilled: "Valeurs préremplies depuis la dernière version de votre Brand Kit.", campaign: "Campagne P24", adminOnly: ["Revue des preuves Matricia", "Templates commerciaux"] },
  ar: { heading: "التسويق", prefilled: "القيم مملوءة مسبقاً من آخر إصدار لعلامتكم.", campaign: "حملة P24", adminOnly: ["مراجعة أدلة Matricia", "القوالب التجارية"] },
} as const;

async function open(browser: Browser, statePath: string, locale: Locale, route: string, mobile: boolean) {
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173", storageState: statePath, locale: locale === "ar" ? "ar-MA" : "fr-MA", timezoneId: "Africa/Casablanca", viewport: mobile ? { width: 360, height: 800 } : { width: 1280, height: 900 } });
  const page = await context.newPage();
  const organizationId = process.env.E2E_ROLE_ORGANIZATION_ID;
  const franchiseId = process.env.E2E_FRANCHISE_ID;
  if (!organizationId || (route.startsWith("franchise/") && !franchiseId)) {
    throw new Error("Authenticated marketing requires the generated organization and franchise context");
  }
  const url = new URL(`/${locale}/${route}`, process.env.E2E_BASE_URL ?? "http://localhost:5173");
  url.searchParams.set("organizationId", organizationId);
  if (route.startsWith("franchise/") && franchiseId) url.searchParams.set("franchiseId", franchiseId);
  await page.goto(url.toString());
  return { context, page };
}

async function expectAccessible(page: Page) {
  const size = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(size.content).toBeLessThanOrEqual(size.viewport);
  await settleVisualState(page);
  const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(audit.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.flatMap((node) => node.target) })), "Automated accessibility violations").toEqual([]);
}

test.describe("P29 Marketing workspaces", () => {
  for (const workspace of workspaces) {
    for (const locale of ["fr", "ar"] as const) {
      test(`${locale.toUpperCase()} ${workspace.name} Marketing is scoped, prefilled, identifier-free and accessible`, async ({ browser }, testInfo) => {
        const state = process.env[workspace.stateVariable];
        test.skip(!state || !existsSync(state), `${workspace.stateVariable} must reference a generated authenticated state`);
        const { context, page } = await open(browser, state!, locale, workspace.route, testInfo.project.name.includes("mobile"));
        try {
          await expect(page).toHaveURL(new RegExp(`/${locale}/${workspace.route}/?(\\?.*)?$`));
          await expect(page.locator("html")).toHaveAttribute("lang", locale);
          await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
          await expect(page.getByRole("heading", { level: 1, name: copy[locale].heading })).toBeVisible();
          await expect(page.getByRole("heading", { name: locale === "ar" ? "علامة تجارية" : "Brand Kit", exact: true })).toBeVisible();
          await expect(page.getByText(copy[locale].prefilled, { exact: true })).toBeVisible();
          await expect(page.locator('input[name="trackedUrl"]')).toHaveValue(/^https:\/\//);
          await expect(page.getByRole("heading", { level: 3, name: copy[locale].campaign, exact: true })).toBeVisible();
          for (const text of copy[locale].adminOnly) await expect(page.getByText(text, { exact: true })).toHaveCount(0);
          const optionTexts = await page.locator("option").allTextContents();
          expect(optionTexts.filter((text) => /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text)), "No identifier shown to business users").toEqual([]);
          await page.keyboard.press("Tab");
          await expect(page.locator(":focus")).toBeVisible();
          await expectAccessible(page);
        } finally {
          await context.close();
        }
      });
    }
  }

  test("anonymous access to both Marketing workspaces is redirected to sign-in in FR and AR", async ({ page }) => {
    for (const locale of ["fr", "ar"] as const) {
      for (const workspace of workspaces) {
        await page.goto(`/${locale}/${workspace.route}`);
        await expect(page).toHaveURL(new RegExp(`/${locale}/connexion`));
        await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      }
    }
  });
});

import { validFixtureProject } from "./helpers/fixture-project.mjs";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

type Locale = "fr" | "ar";
type StateKey = "clientA" | "clientB" | "centralAal1" | "centralAal2" | "noRole";
type Manifest = {
  schemaVersion: number;
  environment?: string;
  projectRef: string;
  runId: string;
  createdAt: string;
  expiresAt: string;
  states: Record<StateKey, { path: string; sha256: string }>;
  fixtures: {
    organizationA: { id: string; name: string };
    organizationB: { id: string; name: string };
  };
  proof: Record<string, unknown>;
};

const login = {
  fr: { title: "Connectez-vous à Matricia", email: "Adresse courriel professionnelle", submit: "Recevoir mon code" },
  ar: { title: "تسجيل الدخول إلى ماتريسيا", email: "البريد الإلكتروني المهني", submit: "إرسال الرمز" },
} as const;

const clientRoutes = [
  "client/demandes",
  "client/missions",
  "client/credits",
  "client/abonnement",
  "client/litiges",
  "notifications",
] as const;

const otherRoleRoutes = [
  "sous-traitant/qualification",
  "sous-traitant/facturation",
  "sous-traitant/missions",
  "sous-traitant/devis",
  "franchise/gouvernance",
] as const;

const protectedRoutes = [...clientRoutes, ...otherRoleRoutes] as const;

function loadAuthenticatedFixture(): Manifest {
  const manifestPath = process.env.E2E_P05_MANIFEST;
  const expectedStates: Record<StateKey, string | undefined> = {
    clientA: process.env.E2E_CLIENT_STORAGE_STATE,
    clientB: process.env.E2E_CLIENT_B_STORAGE_STATE,
    centralAal1: process.env.E2E_COMPLIANCE_AAL1_STORAGE_STATE,
    centralAal2: process.env.E2E_COMPLIANCE_STORAGE_STATE,
    noRole: process.env.E2E_NO_ROLE_STORAGE_STATE,
  };
  if (!manifestPath) throw new Error("E2E_P05_MANIFEST is required; use tests/e2e/helpers/v1-critical-flows-run.mjs");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
  const now = Date.now();
  if (manifest.schemaVersion !== 1 || !validFixtureProject(manifest)
      || !/^[a-z0-9-]{8,64}$/u.test(manifest.runId)
      || now - Date.parse(manifest.createdAt) > 120_000 || Date.parse(manifest.expiresAt) <= now
      || manifest.proof.realCommandAuditOutbox !== true || manifest.proof.tenantIsolation !== true) {
    throw new Error("V1 critical-flow fixture manifest is invalid or stale");
  }
  for (const key of Object.keys(expectedStates) as StateKey[]) {
    const path = expectedStates[key];
    if (!path || path !== manifest.states[key]?.path
        || createHash("sha256").update(readFileSync(path)).digest("hex") !== manifest.states[key]?.sha256) {
      throw new Error("V1 critical-flow storage state is not bound to the authenticated manifest");
    }
  }
  return manifest;
}

const manifest = loadAuthenticatedFixture();

async function expectAccessibleReflow(page: Page, locale: Locale) {
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations.map(({ id, impact, nodes }) => ({
    id,
    impact,
    targets: nodes.flatMap((node) => node.target),
  })), "Automated accessibility violations").toEqual([]);
}

async function expectKeyboardReachable(page: Page) {
  const target = page.locator("a:visible, button:visible, input:visible, select:visible, textarea:visible").first();
  await expect(target).toBeVisible();
  await page.locator("body").focus();
  for (let index = 0; index < 40; index += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error("The first interactive control was not keyboard reachable");
}

async function authenticatedPage(browser: Browser, baseURL: string | undefined, locale: Locale) {
  const context = await browser.newContext({
    ...(baseURL ? { baseURL } : {}),
    storageState: manifest.states.clientA.path,
    viewport: test.info().project.name.includes("mobile") ? { width: 360, height: 800 } : { width: 1280, height: 900 },
    locale: locale === "ar" ? "ar-MA" : "fr-MA",
    timezoneId: "Africa/Casablanca",
  });
  return { context, page: await context.newPage() };
}

for (const locale of ["fr", "ar"] as const) {
  test(`${locale.toUpperCase()} protects every remaining critical role route for anonymous users`, async ({ page }) => {
    for (const route of protectedRoutes) {
      await page.goto(`/${locale}/${route}`);
      await expect(page).toHaveURL(url => url.pathname === `/${locale}/connexion` && url.searchParams.get("next") === `/${locale}/${route}`);
      await expect(page.getByRole("heading", { level: 1, name: login[locale].title })).toBeVisible();
      await expectAccessibleReflow(page, locale);
    }
    const email = page.getByRole("textbox", { name: login[locale].email });
    await expectKeyboardReachable(page);
    await email.focus();
    await expect(email).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: login[locale].submit })).toBeFocused();
  });

  test(`${locale.toUpperCase()} Client traverses requests, missions, credits, subscription, disputes and notifications`, async ({ browser, baseURL }) => {
    const { context, page } = await authenticatedPage(browser, baseURL, locale);
    try {
      for (const route of clientRoutes) {
        await page.goto(`/${locale}/${route}`);
        await expect(page).toHaveURL(new RegExp(`/${locale}/${route}/?$`));
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.getByRole("heading", { level: 1, name: login[locale].title })).toHaveCount(0);
        await expect(page.locator("body")).not.toContainText(manifest.fixtures.organizationB.name);
        if (route === "client/missions" || route === "client/abonnement" || route === "notifications") {
          await expect(page.locator("body")).toContainText(manifest.fixtures.organizationA.name);
        }
        await expectAccessibleReflow(page, locale);
      }
      await expectKeyboardReachable(page);
    } finally {
      await context.close();
    }
  });

  test(`${locale.toUpperCase()} Client is denied provider and franchise workflows without cross-role data`, async ({ browser, baseURL }) => {
    const { context, page } = await authenticatedPage(browser, baseURL, locale);
    try {
      for (const route of otherRoleRoutes) {
        await page.goto(`/${locale}/${route}`);
        await expect(async () => {
          if (new URL(page.url()).pathname.replace(/\/$/u, "") === `/${locale}/${route}`) {
            await expect(page.locator('[data-slot="alert"].text-destructive, [data-error-reason="FORBIDDEN"]')).toBeVisible({ timeout: 500 });
          } else {
            await expect(page).toHaveURL(new RegExp(`/${locale}/(tableau-de-bord|connexion|organisation)(?:[/?#]|$)`), { timeout: 500 });
          }
        }).toPass({ timeout: 10_000, intervals: [100, 250, 500] });
        await expect(page.locator("body")).not.toContainText(manifest.fixtures.organizationB.name);
        await expectAccessibleReflow(page, locale);
      }
    } finally {
      await context.close();
    }
  });
}

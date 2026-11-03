import { validFixtureProject } from "./helpers/fixture-project.mjs";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

type Locale = "fr" | "ar";

const copy = {
  fr: {
    loginTitle: "Connectez-vous à Matricia",
    emailLabel: "Adresse courriel professionnelle",
    onboardingTitle: "Profil et conformité de votre entreprise",
    administrationTitle: "Conformité clients",
    mfaTitle: "Sécurité renforcée requise",
    forbiddenTitle: "Accès non autorisé",
    caseTitle: "Dossier de conformité",
    documentsRequired: "Documents requis",
  },
  ar: {
    loginTitle: "تسجيل الدخول إلى ماتريسيا",
    emailLabel: "البريد الإلكتروني المهني",
    onboardingTitle: "ملف مؤسستك وامتثالها",
    administrationTitle: "امتثال العملاء",
    mfaTitle: "مطلوب أمان معزز",
    forbiddenTitle: "الوصول غير مصرح",
    caseTitle: "ملف الامتثال",
    documentsRequired: "المستندات مطلوبة",
  },
} as const;

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
    organizationA: { id: string; name: string; caseId: string };
    organizationB: { id: string; name: string; caseId: string };
    document: { id: string; status: string };
  };
  proof: Record<string, unknown>;
};

function loadManifest(): Manifest {
  const path = process.env.E2E_P05_MANIFEST;
  if (!path) throw new Error("E2E_P05_MANIFEST is required; use scripts/p05-e2e/run.mjs");
  const manifest = JSON.parse(readFileSync(path, "utf8")) as Manifest;
  const now = Date.now();
  if (manifest.schemaVersion !== 1 || !validFixtureProject(manifest)
      || !/^[a-z0-9-]{8,64}$/.test(manifest.runId) || now - Date.parse(manifest.createdAt) > 120_000
      || Date.parse(manifest.expiresAt) <= now || manifest.proof.realCommandAuditOutbox !== true
      || manifest.proof.tenantIsolation !== true || manifest.proof.storageIsolation !== true || manifest.proof.centralAal2 !== true) {
    throw new Error("P05 authenticated manifest is invalid or stale");
  }
  const expectedPaths: Record<StateKey, string | undefined> = {
    clientA: process.env.E2E_CLIENT_STORAGE_STATE,
    clientB: process.env.E2E_CLIENT_B_STORAGE_STATE,
    centralAal1: process.env.E2E_COMPLIANCE_AAL1_STORAGE_STATE,
    centralAal2: process.env.E2E_COMPLIANCE_STORAGE_STATE,
    noRole: process.env.E2E_NO_ROLE_STORAGE_STATE,
  };
  for (const key of Object.keys(expectedPaths) as StateKey[]) {
    if (!expectedPaths[key] || manifest.states[key]?.path !== expectedPaths[key] || !/^[0-9a-f]{64}$/.test(manifest.states[key]?.sha256 ?? "")) {
      throw new Error("P05 authenticated storage state is not bound to the manifest");
    }
  }
  return manifest;
}

const manifest = loadManifest();

const protectedRoutes = [
  { path: "client/onboarding", label: "client onboarding" },
  { path: "administration/conformite-clients", label: "central compliance administration" },
] as const;

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
}

async function expectNoAutomatedA11yViolation(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    targets: violation.nodes.flatMap((node) => node.target),
  }));
  expect(summary, "Automated accessibility violations").toEqual([]);
}

for (const locale of ["fr", "ar"] as const) {
  const direction = locale === "ar" ? "rtl" : "ltr";

  test.describe(`${locale.toUpperCase()} P05 anonymous boundaries`, () => {
    for (const route of protectedRoutes) {
      test(`${route.label} redirects anonymously and remains accessible at 360 px`, async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 800 });
        await page.goto(`/${locale}/${route.path}`);

        await expect(page).toHaveURL(url=>url.pathname===`/${locale}/connexion`&&url.searchParams.get("next")===`/${locale}/${route.path}`);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("html")).toHaveAttribute("dir", direction);
        await expect(page.getByRole("heading", { level: 1, name: copy[locale].loginTitle })).toBeVisible();

        const email = page.getByRole("textbox", { name: copy[locale].emailLabel });
        await email.focus();
        await expect(email).toBeFocused();
        await expectNoHorizontalOverflow(page);
        await expectNoAutomatedA11yViolation(page);
      });
    }
  });
}

async function verifyAuthenticatedRoute(
  browser: Browser,
  baseURL: string | undefined,
  storageStatePath: string,
  locale: Locale,
  route: string,
  title: string,
  visibleTexts: string[] = [],
  absentTexts: string[] = [],
) {
  const context = await browser.newContext({
    ...(baseURL ? { baseURL } : {}),
    storageState: storageStatePath,
    viewport: { width: 360, height: 800 },
    locale: locale === "ar" ? "ar-MA" : "fr-MA",
    timezoneId: "Africa/Casablanca",
  });
  try {
    const page = await context.newPage();
    await page.goto(`/${locale}/${route}`);
    await expect(page).toHaveURL(new RegExp(`/${locale}/${route}/?$`));
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    for (const visibleText of visibleTexts) await expect(page.getByText(visibleText, { exact: true }).first()).toBeVisible();
    for (const absentText of absentTexts) await expect(page.getByText(absentText, { exact: true })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await expectNoAutomatedA11yViolation(page);
  } finally {
    await context.close();
  }
}

for (const locale of ["fr", "ar"] as const) {
  test(`${locale.toUpperCase()} renders the real Client A organization and excludes organization B`, async ({ browser, baseURL }) => {
    await verifyAuthenticatedRoute(
      browser,
      baseURL,
      manifest.states.clientA.path,
      locale,
      "client/onboarding",
      copy[locale].onboardingTitle,
      [manifest.fixtures.organizationA.name, copy[locale].caseTitle, copy[locale].documentsRequired],
      [manifest.fixtures.organizationB.name],
    );
  });

  test(`${locale.toUpperCase()} renders the real Client B organization and excludes organization A`, async ({ browser, baseURL }) => {
    await verifyAuthenticatedRoute(
      browser, baseURL, manifest.states.clientB.path, locale, "client/onboarding", copy[locale].onboardingTitle,
      [manifest.fixtures.organizationB.name, copy[locale].caseTitle], [manifest.fixtures.organizationA.name],
    );
  });

  test(`${locale.toUpperCase()} authorizes central compliance only with the AAL2 state`, async ({ browser, baseURL }) => {
    await verifyAuthenticatedRoute(
      browser, baseURL, manifest.states.centralAal2.path, locale, "administration/conformite-clients", copy[locale].administrationTitle,
      [manifest.fixtures.organizationA.name, manifest.fixtures.organizationB.name], [copy[locale].mfaTitle, copy[locale].forbiddenTitle],
    );
  });

  test(`${locale.toUpperCase()} requires MFA for the same central identity at AAL1`, async ({ browser, baseURL }) => {
    await verifyAuthenticatedRoute(
      browser, baseURL, manifest.states.centralAal1.path, locale, "administration/conformite-clients", copy[locale].administrationTitle,
      [copy[locale].mfaTitle], [manifest.fixtures.organizationA.name, manifest.fixtures.organizationB.name],
    );
  });

  test(`${locale.toUpperCase()} refuses central compliance to an authenticated identity without role`, async ({ browser, baseURL }) => {
    await verifyAuthenticatedRoute(
      browser, baseURL, manifest.states.noRole.path, locale, "administration/conformite-clients", copy[locale].administrationTitle,
      [copy[locale].forbiddenTitle], [manifest.fixtures.organizationA.name, manifest.fixtures.organizationB.name],
    );
  });
}

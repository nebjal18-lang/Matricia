import { existsSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";

type Locale = "fr" | "ar";
type Role = "client" | "provider" | "franchise" | "admin";
type Surface = {
  route: string;
  heading: Record<Locale, string>;
};

const surfaces: Record<Role, readonly Surface[]> = {
  client: [
    { route: "client/diagnostics", heading: { fr: "Mes diagnostics", ar: "تشخيصاتي" } },
    { route: "client/questionnaires", heading: { fr: "Mes questionnaires", ar: "استبياناتي" } },
    { route: "client/demandes", heading: { fr: "Demandes & devis", ar: "الطلبات والعروض" } },
    { route: "client/missions", heading: { fr: "Projets & missions", ar: "المشاريع والمهام" } },
    { route: "client/finances", heading: { fr: "Mes finances", ar: "أموالي" } },
    { route: "client/credits", heading: { fr: "Crédits, Boxes et avantages", ar: "الأرصدة والصناديق والمزايا" } },
    { route: "notifications", heading: { fr: "Centre de notifications", ar: "مركز الإشعارات" } },
  ],
  provider: [
    { route: "sous-traitant/qualification", heading: { fr: "Votre qualification", ar: "تأهيلكم" } },
    { route: "sous-traitant/devis", heading: { fr: "Vos devis", ar: "عروضكم" } },
    { route: "sous-traitant/missions", heading: { fr: "Missions & livrables", ar: "المهام والتسليمات" } },
    { route: "sous-traitant/facturation", heading: { fr: "Facturation", ar: "الفوترة" } },
    { route: "sous-traitant/marketing", heading: { fr: "Marketing", ar: "التسويق" } },
  ],
  franchise: [
    { route: "franchise/performance", heading: { fr: "Performance de votre bibliothèque", ar: "أداء مكتبتكم" } },
    { route: "franchise/relances", heading: { fr: "Relances et pipeline", ar: "المتابعات والمسار" } },
    { route: "franchise/questionnaires", heading: { fr: "Questions & questionnaires", ar: "الأسئلة والاستبيانات" } },
    { route: "franchise/digest", heading: { fr: "Pilotez votre bibliothèque", ar: "قودوا مكتبتكم" } },
    { route: "franchise/marketing", heading: { fr: "Marketing", ar: "التسويق" } },
  ],
  admin: [
    { route: "administration/command-center", heading: { fr: "Administration Matricia", ar: "إدارة ماتريسيا" } },
    { route: "administration/parcours", heading: { fr: "Parcours & dossiers", ar: "المسارات والملفات" } },
    { route: "administration/entreprises", heading: { fr: "Organisations", ar: "المؤسسات" } },
  ],
};

const financeGate: Surface = { route: "administration/finance", heading: { fr: "Paiements et abonnements", ar: "المدفوعات والاشتراكات" } };
const deniedSurfaces: Record<Role, readonly Surface[]> = {
  client: [surfaces.provider[0], surfaces.franchise[2], financeGate],
  provider: [surfaces.client[0], financeGate],
  franchise: [surfaces.client[1], financeGate],
  admin: [],
};

const stateVariables: Record<Role, string> = {
  client: "E2E_CLIENT_STORAGE_STATE",
  provider: "E2E_PROVIDER_STORAGE_STATE",
  franchise: "E2E_FRANCHISE_STORAGE_STATE",
  admin: "E2E_ADMIN_STORAGE_STATE",
};

function requireState(role: Role): string {
  const variable = stateVariables[role];
  const path = process.env[variable];
  if (!path || !existsSync(path)) {
    throw new Error(`${variable} must reference a generated sandbox authentication state`);
  }
  return path;
}

const states = Object.fromEntries(
  (Object.keys(stateVariables) as Role[]).map((role) => [role, requireState(role)]),
) as Record<Role, string>;

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const target = new URL(baseURL);
if (!["localhost", "127.0.0.1", "::1"].includes(target.hostname)) {
  throw new Error("Authenticated route smoke is restricted to a local sandbox application URL");
}

async function createSession(browser: Browser, role: Role, locale: Locale, mobile: boolean) {
  const context = await browser.newContext({
    baseURL,
    storageState: states[role],
    locale: locale === "ar" ? "ar-MA" : "fr-MA",
    timezoneId: "Africa/Casablanca",
    viewport: mobile ? { width: 360, height: 800 } : { width: 1280, height: 900 },
  });
  return { context, page: await context.newPage() };
}

async function assertHealthyDocument(page: Page, locale: Locale, surface: Surface) {
  const pageErrors: string[] = [];
  const recordPageError = (error: Error) => pageErrors.push(error.message);
  page.on("pageerror", recordPageError);
  try {
    const response = await page.goto(`/${locale}/${surface.route}`, { waitUntil: "domcontentloaded" });
    expect(response, `No document response for /${locale}/${surface.route}`).not.toBeNull();
    expect(response!.status(), `Unexpected HTTP status for /${locale}/${surface.route}`).toBeLessThan(500);
    await expect(page).toHaveURL(new RegExp(`/${locale}/${surface.route}/?$`));
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1, name: surface.heading[locale] })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/Application error|Internal Server Error|ChunkLoadError/u);
    expect((await page.locator("body").innerText()).trim().length).toBeGreaterThan(20);
    await expect(async () => {
      await expect(page).toHaveURL(new RegExp(`/${locale}/${surface.route}/?$`), { timeout: 500 });
      await expect(page.getByRole("heading", { level: 1, name: surface.heading[locale] })).toBeVisible({ timeout: 500 });
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }));
      expect(dimensions.content, `Horizontal overflow on /${locale}/${surface.route}`).toBeLessThanOrEqual(dimensions.viewport);
    }).toPass({ timeout: 5_000, intervals: [100, 250, 500] });
    expect(pageErrors, `Unhandled browser error on /${locale}/${surface.route}`).toEqual([]);
  } finally {
    page.off("pageerror", recordPageError);
  }
}

async function assertAllowed(page: Page, locale: Locale, surface: Surface) {
  await assertHealthyDocument(page, locale, surface);
  const blocking = page.locator('[data-slot="alert"].text-destructive');
  if (await blocking.count()) {
    const code = await blocking.first().getAttribute("data-error-reason");
    const reason = (await blocking.first().innerText()).replace(/\s+/g, " ").slice(0, 180);
    throw new Error(`Destructive alert on /${locale}/${surface.route}: ${code ?? "unspecified"} ${reason}`);
  }
  const foreignOrganization = process.env.E2E_FOREIGN_ORGANIZATION_NAME;
  if (foreignOrganization && !surface.route.startsWith("administration/")) await expect(page.locator("body")).not.toContainText(foreignOrganization);
}

async function assertDenied(page: Page, locale: Locale, surface: Surface) {
  const response = await page.goto(`/${locale}/${surface.route}`, { waitUntil: "domcontentloaded" });
  expect(response, `No document response for /${locale}/${surface.route}`).not.toBeNull();
  expect(response!.status(), `Unexpected HTTP status for /${locale}/${surface.route}`).toBeLessThan(500);
  // A streamed server response may redirect after DOMContentLoaded. Observe
  // the final denied/redirected state before choosing the assertion branch.
  await expect(async () => {
    const stayed = new RegExp(`/${locale}/${surface.route}/?$`).test(new URL(page.url()).pathname);
    if (!stayed) {
      await expect(page).toHaveURL(new RegExp(`/${locale}/(tableau-de-bord|connexion|organisation|franchise/accueil)(?:[/?#]|$)`), { timeout: 500 });
      await expect(page.getByRole("heading", { level: 1, name: surface.heading[locale] })).not.toBeVisible({ timeout: 500 });
      return;
    }
    await expect(page.getByRole("heading", { level: 1, name: surface.heading[locale] })).toBeVisible({ timeout: 500 });
    await expect(page.locator('[data-slot="alert"].text-destructive, [data-error-reason="FORBIDDEN"]')).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 10_000, intervals: [100, 250, 500] });
  const foreignOrganization = process.env.E2E_FOREIGN_ORGANIZATION_NAME;
  if (foreignOrganization) await expect(page.locator("body")).not.toContainText(foreignOrganization);
}

async function attachSanitizedEvidence(
  testInfo: TestInfo,
  role: Role,
  locale: Locale,
  mobile: boolean,
) {
  await testInfo.attach("authenticated-route-smoke.json", {
    contentType: "application/json",
    body: Buffer.from(JSON.stringify({
      schemaVersion: 1,
      environment: "SANDBOX",
      role,
      locale,
      viewport: mobile ? { width: 360, height: 800 } : { width: 1280, height: 900 },
      allowedRoutes: surfaces[role].map(({ route }) => route),
      deniedRoutes: deniedSurfaces[role].map(({ route }) => route),
      assertions: ["authenticated", "localized-h1", "no-server-error", "no-blank-page", "no-horizontal-overflow", "cross-role-deny", "diagnostics", "questionnaires", "quotes", "missions", "billing", "credits", "notifications", "franchise", "administration", "marketing"],
    }, null, 2)),
  });
}

for (const locale of ["fr", "ar"] as const) {
  for (const role of Object.keys(surfaces) as Role[]) {
    test(`${locale.toUpperCase()} ${role} authenticated route smoke is responsive and role-isolated`, async ({ browser }, testInfo) => {
      test.setTimeout(120_000);
      const mobile = testInfo.project.name.includes("mobile");
      const { context, page } = await createSession(browser, role, locale, mobile);
      try {
        for (const surface of surfaces[role]) {
          await test.step(`ALLOW ${surface.route}`, () => assertAllowed(page, locale, surface));
        }
        for (const surface of deniedSurfaces[role]) {
          await test.step(`DENY ${surface.route}`, () => assertDenied(page, locale, surface));
        }
        const audit = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        expect(audit.violations.map(({ id, impact, nodes }) => ({
          id,
          impact,
          targets: nodes.flatMap((node) => node.target),
        })), "Automated accessibility violations").toEqual([]);
        await attachSanitizedEvidence(testInfo, role, locale, mobile);
      } finally {
        await context.close();
      }
    });
  }
}

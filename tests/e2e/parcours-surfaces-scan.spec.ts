import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const host = new URL(process.env.E2E_BASE_URL ?? "http://localhost:5173").hostname;
test.skip(!["localhost", "127.0.0.1", "::1"].includes(host), "restricted to a local server");

function parseEnv(source: string) {
  return Object.fromEntries(source.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) return [];
    return [[match[1], match[2].replace(/^(['"])(.*)\1$/, "$2")]];
  }));
}

const env = parseEnv(readFileSync(".env.local", "utf8"));
const credentials = {
  client: { email: env.MATRICIA_PARCOURS_CLIENT_EMAIL!, password: env.MATRICIA_PARCOURS_CLIENT_PASSWORD! },
  provider: { email: env.MATRICIA_PARCOURS_PROVIDER_EMAIL!, password: env.MATRICIA_PARCOURS_PROVIDER_PASSWORD! },
  franchise: { email: env.MATRICIA_PARCOURS_FRANCHISE_EMAIL!, password: env.MATRICIA_PARCOURS_FRANCHISE_PASSWORD! },
};

type ScanRow = {
  actor: string;
  locale: "fr" | "ar";
  route: string;
  status: number | null;
  heading: string | null;
  workspaceFailure: string | null;
  bodyFailure: string | null;
  consoleErrors: string[];
  pageErrors: string[];
  hasIssue: boolean;
};

const franchiseRoutes = [
  "franchise/accueil",
  "franchise/bibliotheque",
  "franchise/services",
  "franchise/questionnaires",
  "franchise/regles",
  "franchise/validations",
  "franchise/perimetre",
  "franchise/fournisseurs",
  "franchise/demandes",
  "franchise/qualite",
  "franchise/performance",
  "franchise/relances",
  "franchise/marketing",
  "franchise/documents",
  "franchise/messages",
  "franchise/gouvernance",
  "franchise/finance",
  "franchise/digest",
  "franchise/reseau",
];

const clientRoutes = [
  "client/accueil",
  "client/diagnostics",
  "client/questionnaires",
  "client/demandes",
  "client/missions",
  "client/contrats",
  "client/finances",
  "client/credits",
  "client/documents",
  "client/messages",
];

const providerRoutes = [
  "sous-traitant/accueil",
  "sous-traitant/qualification",
  "sous-traitant/devis",
  "sous-traitant/missions",
  "sous-traitant/facturation",
  "sous-traitant/documents",
  "sous-traitant/messages",
  "sous-traitant/marketing",
];

const adminRoutes = [
  "administration/command-center",
  "administration/parcours",
  "administration/entreprises",
  "administration/finance",
  "administration/gouvernance-franchise",
  "administration/approbations",
  "administration/conformite",
];

const bodyFailurePatterns = [
  /Application error/i,
  /Internal Server Error/i,
  /ChunkLoadError/i,
  /momentanément indisponible/i,
  /غير متاح مؤقتاً/i,
  /UNAVAILABLE/i,
  /MANDATE_REQUIRED|NO_MANDATE|FORBIDDEN|MFA_REQUIRED/i,
];

function sanitize(text: string) {
  return text
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[id]")
    .replace(/\s+/g, " ")
    .slice(0, 400);
}

async function signInPassword(page: Page, email: string, password: string) {
  await page.goto("/fr/connexion", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Mot de passe", exact: true }).click();
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.waitForURL(/\/fr\/(tableau-de-bord|client\/|sous-traitant\/|franchise\/|administration\/)/, { timeout: 60_000 });
}

async function signInDemoAdmin(page: Page) {
  await page.goto("/fr/connexion", { waitUntil: "domcontentloaded" });
  await page.locator('form:has(input[name="persona"][value="admin"]) button[type="submit"]').click();
  await page.waitForURL(/\/fr\/(tableau-de-bord|administration\/)/, { timeout: 60_000 });
}

async function scanRoute(page: Page, actor: string, locale: "fr" | "ar", route: string): Promise<ScanRow> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const onConsole = (message: { type: () => string; text: () => string }) => {
    if (message.type() === "error") consoleErrors.push(sanitize(message.text()));
  };
  const onPageError = (error: Error) => pageErrors.push(sanitize(String(error.message ?? error)));
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  let status: number | null = null;
  let heading: string | null = null;
  let workspaceFailure: string | null = null;
  let bodyFailure: string | null = null;
  try {
    const response = await page.goto(`/${locale}/${route}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    status = response?.status() ?? null;
    await page.waitForTimeout(500);
    const body = sanitize(await page.locator("body").innerText().catch(() => ""));
    heading = (await page.locator("h1").first().textContent().catch(() => null))?.trim() ?? null;
    workspaceFailure = await page.locator("[data-workspace-failure]").first().getAttribute("data-workspace-failure").catch(() => null);
    for (const pattern of bodyFailurePatterns) {
      if (pattern.test(body) || (workspaceFailure && pattern.test(workspaceFailure))) {
        bodyFailure = String(pattern);
        break;
      }
    }
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
  }
  const hasIssue = Boolean(bodyFailure || workspaceFailure || (status !== null && status >= 400) || consoleErrors.length || pageErrors.length);
  return { actor, locale, route, status, heading, workspaceFailure, bodyFailure, consoleErrors: consoleErrors.slice(0, 6), pageErrors: pageErrors.slice(0, 6), hasIssue };
}

test("scan parcours surfaces FR and AR sample for console/display failures", async ({ browser }) => {
  test.setTimeout(20 * 60_000);
  const rows: ScanRow[] = [];

  async function runActor(actor: string, routes: string[], login: (page: Page) => Promise<void>, arSample = 4) {
    const context = await browser.newContext({ locale: "fr-MA", timezoneId: "Africa/Casablanca", viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(30_000);
    try {
      await login(page);
      for (const route of routes) rows.push(await scanRoute(page, actor, "fr", route));
      for (const route of routes.slice(0, arSample)) rows.push(await scanRoute(page, actor, "ar", route));
    } finally {
      await context.close();
    }
  }

  await runActor("franchise", franchiseRoutes, (page) => signInPassword(page, credentials.franchise.email, credentials.franchise.password), 6);
  await runActor("client", clientRoutes, (page) => signInPassword(page, credentials.client.email, credentials.client.password));
  await runActor("provider", providerRoutes, (page) => signInPassword(page, credentials.provider.email, credentials.provider.password));
  await runActor("admin-demo", adminRoutes, signInDemoAdmin);

  mkdirSync(".tmp", { recursive: true });
  const issues = rows.filter((row) => row.hasIssue);
  const summary = {
    total: rows.length,
    issues: issues.length,
    byActor: Object.fromEntries(["franchise", "client", "provider", "admin-demo"].map((actor) => [
      actor,
      {
        total: rows.filter((row) => row.actor === actor).length,
        issues: rows.filter((row) => row.actor === actor && row.hasIssue).length,
      },
    ])),
    topIssues: issues.map((row) => ({
      actor: row.actor,
      locale: row.locale,
      route: row.route,
      status: row.status,
      workspaceFailure: row.workspaceFailure,
      bodyFailure: row.bodyFailure,
      consoleErrors: row.consoleErrors.length,
      pageErrors: row.pageErrors.length,
      heading: row.heading,
      sampleConsole: row.consoleErrors[0] ?? null,
      samplePageError: row.pageErrors[0] ?? null,
    })),
  };
  writeFileSync(".tmp/scan-parcours-surfaces.json", JSON.stringify({ summary, rows }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  // Soft gate: keep the report even when issues exist; assert login paths worked.
  expect(rows.some((row) => row.actor === "franchise")).toBeTruthy();
  expect(rows.some((row) => row.actor === "client")).toBeTruthy();
  expect(rows.some((row) => row.actor === "provider")).toBeTruthy();
});

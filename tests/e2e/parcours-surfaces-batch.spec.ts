import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { test, type Browser, type Page, type PlaywrightTestArgs } from "@playwright/test";

const host = new URL(process.env.E2E_BASE_URL ?? "http://localhost:5173").hostname;
test.skip(!["localhost", "127.0.0.1", "::1"].includes(host), "restricted to a local server");

const batch = (process.env.PARCOURS_SURFACE_BATCH ?? "franchise").trim();
const locales = ((process.env.PARCOURS_SURFACE_LOCALES ?? "fr").split(",").map((value) => value.trim()).filter(Boolean) as Array<"fr" | "ar">);
const viewport = (process.env.PARCOURS_SURFACE_VIEWPORT ?? "desktop").trim();
const routeFilter = (process.env.PARCOURS_SURFACE_ROUTES ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function parseEnv(source: string) {
  return Object.fromEntries(source.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) return [];
    return [[match[1], match[2].replace(/^(['"])(.*)\1$/, "$2")]];
  }));
}

const env = parseEnv(readFileSync(".env.local", "utf8"));
const inventory = JSON.parse(readFileSync(".tmp/all-routes-inventory.json", "utf8")) as {
  bySpaceRoutes: Record<string, string[]>;
};
const credentials = {
  client: { email: env.MATRICIA_PARCOURS_CLIENT_EMAIL!, password: env.MATRICIA_PARCOURS_CLIENT_PASSWORD! },
  provider: { email: env.MATRICIA_PARCOURS_PROVIDER_EMAIL!, password: env.MATRICIA_PARCOURS_PROVIDER_PASSWORD! },
  franchise: { email: env.MATRICIA_PARCOURS_FRANCHISE_EMAIL!, password: env.MATRICIA_PARCOURS_FRANCHISE_PASSWORD! },
};

type ScanRow = {
  actor: string;
  locale: "fr" | "ar";
  viewport: string;
  route: string;
  status: number | null;
  heading: string | null;
  dir: string | null;
  width: number | null;
  overflow: boolean | null;
  workspaceFailure: string | null;
  bodyFailure: string | null;
  accessGate: string | null;
  consoleErrors: string[];
  pageErrors: string[];
  hasIssue: boolean;
  covered: boolean;
  elapsedMs: number;
};

const crashPatterns = [
  /Application error/i,
  /Internal Server Error/i,
  /ChunkLoadError/i,
  /momentanément indisponible/i,
  /غير متاح مؤقتاً/i,
  /\bUNAVAILABLE\b/i,
  /\bQUERY_FAILED\b|\bINVALID_RESPONSE\b/i,
];
const accessGatePatterns = [
  /MANDATE_REQUIRED|NO_MANDATE|FORBIDDEN|MFA_REQUIRED|UNAUTHENTICATED|ORGANIZATION_REQUIRED|CONFIGURATION/i,
];
/** Next.js Flight/devtools sometimes emits this while navigating RSC trees; not an app defect. */
const benignPageErrorPatterns = [
  /Failed to execute 'measure' on 'Performance'/i,
  /cannot have a negative time stamp/i,
];
const benignConsolePatterns = [
  /Failed to execute 'measure' on 'Performance'/i,
];

const sharedAuthenticatedRoutes = [
  "tableau-de-bord",
  "notifications",
  "securite/compte",
  "organisation",
  "organisation/rattachements",
  "organisation/roles",
  "actions",
  "connexion/consentements",
];

function routesFor(space: string, extras: string[] = []) {
  return [...new Set([...(inventory.bySpaceRoutes[space] ?? []), ...extras])].sort((a, b) => a.localeCompare(b));
}

function isBenign(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

const batches: Record<string, { actor: string; routes: string[]; login: "franchise" | "client" | "provider" | "admin" | "public" }> = {
  public: {
    actor: "public",
    login: "public",
    routes: routesFor("public", ["connexion", "connexion/consentements"]),
  },
  franchise: {
    actor: "franchise",
    login: "franchise",
    routes: routesFor("franchise", sharedAuthenticatedRoutes),
  },
  client: {
    actor: "client",
    login: "client",
    routes: routesFor("client", sharedAuthenticatedRoutes),
  },
  provider: {
    actor: "provider",
    login: "provider",
    routes: routesFor("provider", ["tableau-de-bord?workspace=provider", ...sharedAuthenticatedRoutes.filter((route) => route !== "tableau-de-bord")]),
  },
  admin: {
    actor: "admin-demo",
    login: "admin",
    routes: routesFor("admin", sharedAuthenticatedRoutes),
  },
};

function sanitize(text: string) {
  return text
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[id]")
    .replace(/\s+/g, " ")
    .slice(0, 400);
}

async function signInPassword(page: Page, email: string, password: string) {
  await page.goto("/fr/connexion", { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.getByRole("button", { name: "Mot de passe", exact: true }).click({ timeout: 10_000 });
  await page.locator("#password").waitFor({ state: "visible", timeout: 10_000 });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.waitForURL(/\/fr\/(tableau-de-bord|client\/|sous-traitant\/|franchise\/|administration\/)/, { timeout: 45_000 });
}

async function signInDemoAdmin(page: Page) {
  await page.goto("/fr/connexion", { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.locator('form:has(input[name="persona"][value="admin"]) button[type="submit"]').click({ timeout: 10_000 });
  await page.waitForURL(/\/fr\/(tableau-de-bord|administration\/)/, { timeout: 45_000 });
}

type BrowserHolder = { current: Browser; playwright: PlaywrightTestArgs["playwright"] };

async function recoverPage(page: Page, holder: BrowserHolder): Promise<{ page: Page; needsLogin: boolean }> {
  if (!page.isClosed()) return { page, needsLogin: false };
  const viewportSize = viewport === "360" ? { width: 360, height: 740 } : { width: 1280, height: 720 };
  const openContext = async (browser: Browser) => {
    const context = await browser.newContext({
      locale: "fr-MA",
      timezoneId: "Africa/Casablanca",
      viewport: viewportSize,
    });
    const next = await context.newPage();
    next.setDefaultTimeout(15_000);
    next.setDefaultNavigationTimeout(45_000);
    return next;
  };
  try {
    const next = await page.context().newPage();
    next.setDefaultTimeout(15_000);
    next.setDefaultNavigationTimeout(45_000);
    return { page: next, needsLogin: false };
  } catch {
    try {
      return { page: await openContext(holder.current), needsLogin: true };
    } catch {
      holder.current = await holder.playwright.chromium.launch();
      return { page: await openContext(holder.current), needsLogin: true };
    }
  }
}

async function scanRoute(page: Page, holder: BrowserHolder, actor: string, locale: "fr" | "ar", route: string): Promise<{ row: ScanRow; page: Page; needsLogin: boolean }> {
  let recovered = await recoverPage(page, holder);
  let active = recovered.page;
  let needsLogin = recovered.needsLogin;
  const started = Date.now();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const onConsole = (message: { type: () => string; text: () => string }) => {
    if (message.type() !== "error") return;
    const text = sanitize(message.text());
    if (!isBenign(text, benignConsolePatterns)) consoleErrors.push(text);
  };
  const onPageError = (error: Error) => {
    const text = sanitize(String(error.message ?? error));
    if (!isBenign(text, benignPageErrorPatterns)) pageErrors.push(text);
  };
  active.on("console", onConsole);
  active.on("pageerror", onPageError);
  let status: number | null = null;
  let heading: string | null = null;
  let workspaceFailure: string | null = null;
  let bodyFailure: string | null = null;
  let accessGate: string | null = null;
  let dir: string | null = null;
  let width: number | null = null;
  let overflow: boolean | null = null;
  try {
    const response = await active.goto(`/${locale}/${route}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    status = response?.status() ?? null;
    await active.waitForLoadState("load", { timeout: 15_000 }).catch(() => undefined);
    await active.waitForTimeout(400);
    const body = sanitize(await active.locator("body").innerText().catch(() => ""));
    heading = (await active.locator("h1").first().textContent().catch(() => null))?.trim() ?? null;
    workspaceFailure = await active.locator("[data-workspace-failure]").first().getAttribute("data-workspace-failure").catch(() => null);
    dir = await active.locator("html").getAttribute("dir").catch(() => null);
    width = await active.evaluate(() => window.innerWidth).catch(() => null);
    overflow = await active.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1).catch(() => null);
    if (workspaceFailure && accessGatePatterns.some((pattern) => pattern.test(workspaceFailure))) {
      accessGate = workspaceFailure;
    } else {
      const failureText = `${workspaceFailure ?? ""} ${body}`;
      for (const pattern of accessGatePatterns) {
        if (pattern.test(failureText)) {
          accessGate = String(pattern);
          break;
        }
      }
      if (!accessGate) {
        for (const pattern of crashPatterns) {
          if (pattern.test(failureText)) {
            bodyFailure = String(pattern);
            break;
          }
        }
      }
    }
  } catch (error) {
    const message = sanitize(String((error as Error).message ?? error));
    bodyFailure = message;
    if (/Target page, context or browser has been closed|Failed to find browser context|Browser closed|browser has been closed/i.test(message)) {
      recovered = await recoverPage(active, holder);
      active = recovered.page;
      needsLogin = needsLogin || recovered.needsLogin;
    }
  } finally {
    if (!active.isClosed()) {
      active.off("console", onConsole);
      active.off("pageerror", onPageError);
    }
  }
  const rtlIssue = locale === "ar" && dir !== null && dir !== "rtl";
  const overflowIssue = viewport === "360" && overflow === true;
  const hasIssue = Boolean(
    (!accessGate && bodyFailure)
    || (!accessGate && workspaceFailure && crashPatterns.some((pattern) => pattern.test(workspaceFailure)))
    || (status !== null && status >= 400)
    || consoleErrors.length
    || pageErrors.length
    || rtlIssue
    || overflowIssue,
  );
  return {
    page: active,
    needsLogin,
    row: {
      actor,
      locale,
      viewport,
      route,
      status,
      heading,
      dir,
      width,
      overflow,
      workspaceFailure,
      bodyFailure,
      accessGate,
      consoleErrors: consoleErrors.slice(0, 6),
      pageErrors: pageErrors.slice(0, 6),
      hasIssue,
      covered: status !== null && status < 500 && !bodyFailure?.includes("Timeout") && !bodyFailure?.includes("browser has been closed"),
      elapsedMs: Date.now() - started,
    },
  };
}

test(`scan ${batch} surfaces`, async ({ page, browser, playwright }) => {
  test.setTimeout(45 * 60_000);
  const config = batches[batch];
  if (!config) throw new Error(`unknown batch ${batch}`);
  if (viewport === "360") await page.setViewportSize({ width: 360, height: 740 });
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(45_000);

  if (config.login === "admin") await signInDemoAdmin(page);
  else if (config.login !== "public") await signInPassword(page, credentials[config.login].email, credentials[config.login].password);

  const selectedRoutes = routeFilter.length
    ? config.routes.filter((route) => routeFilter.some((filter) => route === filter || route.startsWith(`${filter}?`) || filter === route.split("?")[0]))
    : config.routes;
  if (routeFilter.length && !selectedRoutes.length) throw new Error(`PARCOURS_SURFACE_ROUTES matched nothing in batch ${batch}`);

  const holder: BrowserHolder = { current: browser, playwright };
  let activePage = page;
  const rows: ScanRow[] = [];
  const loginAgain = async () => {
    if (config.login === "admin") await signInDemoAdmin(activePage);
    else if (config.login !== "public") await signInPassword(activePage, credentials[config.login].email, credentials[config.login].password);
  };
  for (const locale of locales) {
    for (const route of selectedRoutes) {
      let scanned = await scanRoute(activePage, holder, config.actor, locale, route);
      activePage = scanned.page;
      if (scanned.needsLogin || /browser has been closed|Failed to find browser context/i.test(scanned.row.bodyFailure ?? "")) {
        await loginAgain();
        scanned = await scanRoute(activePage, holder, config.actor, locale, route);
        activePage = scanned.page;
      }
      const row = scanned.row;
      rows.push(row);
      console.log(JSON.stringify({
        progress: `${locale}/${route}`,
        hasIssue: row.hasIssue,
        covered: row.covered,
        status: row.status,
        accessGate: row.accessGate,
        elapsedMs: row.elapsedMs,
      }));
    }
  }

  mkdirSync(".tmp", { recursive: true });
  const outPath = `.tmp/scan-surfaces-${batch}-${locales.join("-")}${viewport === "360" ? "-360" : ""}.json`;
  const previousPath = ".tmp/scan-parcours-surfaces-merged.json";
  const previous = existsSync(previousPath) ? JSON.parse(readFileSync(previousPath, "utf8")) : { rows: [] };
  const rowKey = (row: Pick<ScanRow, "actor" | "locale" | "viewport" | "route">) =>
    `${row.actor}|${row.locale}|${row.viewport ?? "desktop"}|${row.route}`;
  const replacedKeys = new Set(rows.map((row) => rowKey(row)));
  const mergedRows = [
    ...(previous.rows ?? []).filter((row: ScanRow) => {
      const sameSlice = row.actor === config.actor && locales.includes(row.locale) && (row.viewport ?? "desktop") === viewport;
      if (!sameSlice) return true;
      // Filtered reruns only replace the scanned routes; full batch still replaces the actor/locale/viewport.
      if (routeFilter.length) return !replacedKeys.has(rowKey({ ...row, viewport: row.viewport ?? "desktop" }));
      return false;
    }),
    ...rows,
  ];
  const issues = mergedRows.filter((row: ScanRow) => row.hasIssue);
  const covered = mergedRows.filter((row: ScanRow) => row.covered);
  const expectedStatic = Object.values(inventory.bySpaceRoutes).flat().length;
  const summary = {
    total: mergedRows.length,
    covered: covered.length,
    issues: issues.length,
    accessGates: mergedRows.filter((row: ScanRow) => row.accessGate).length,
    inventoryStatic: expectedStatic,
    coverageNote: "Static index/list routes for public + parcours actors. Dynamic [id] detail routes require seeded IDs and are tracked separately.",
    byActor: Object.fromEntries(["public", "franchise", "client", "provider", "admin-demo"].map((actor) => [
      actor,
      {
        total: mergedRows.filter((row: ScanRow) => row.actor === actor).length,
        covered: mergedRows.filter((row: ScanRow) => row.actor === actor && row.covered).length,
        issues: mergedRows.filter((row: ScanRow) => row.actor === actor && row.hasIssue).length,
      },
    ])),
    topIssues: issues.slice(0, 80).map((row: ScanRow) => ({
      actor: row.actor,
      locale: row.locale,
      route: row.route,
      status: row.status,
      workspaceFailure: row.workspaceFailure,
      bodyFailure: row.bodyFailure,
      accessGate: row.accessGate,
      consoleErrors: row.consoleErrors.length,
      pageErrors: row.pageErrors.length,
      heading: row.heading,
      sampleConsole: row.consoleErrors[0] ?? null,
      samplePageError: row.pageErrors[0] ?? null,
    })),
  };
  const coveredStaticFr = new Set(
    mergedRows
      .filter((row: ScanRow) => row.covered && row.locale === "fr" && (row.viewport ?? "desktop") === "desktop")
      .map((row: ScanRow) => row.route.split("?")[0]),
  );
  const inventoryStatic = new Set([
    ...(inventory.bySpaceRoutes.public ?? []),
    ...(inventory.bySpaceRoutes.shared ?? []),
    ...(inventory.bySpaceRoutes.client ?? []),
    ...(inventory.bySpaceRoutes.franchise ?? []),
    ...(inventory.bySpaceRoutes.provider ?? []),
    ...(inventory.bySpaceRoutes.admin ?? []),
  ]);
  const missingStatic = [...inventoryStatic].filter((route) => !coveredStaticFr.has(route)).sort((a, b) => a.localeCompare(b));
  const coverage = {
    ...summary,
    staticInventory: inventoryStatic.size,
    staticCoveredFr: [...inventoryStatic].filter((route) => coveredStaticFr.has(route)).length,
    staticCoveragePct: inventoryStatic.size
      ? Number((([...inventoryStatic].filter((route) => coveredStaticFr.has(route)).length / inventoryStatic.size) * 100).toFixed(1))
      : 0,
    missingStatic: missingStatic.slice(0, 80),
  };
  writeFileSync(outPath, JSON.stringify({ summary: { batch, locales, viewport, total: rows.length, covered: rows.filter((row) => row.covered).length, issues: rows.filter((row) => row.hasIssue).length }, rows }, null, 2));
  writeFileSync(previousPath, JSON.stringify({ summary: coverage, rows: mergedRows }, null, 2));
  console.log(JSON.stringify(coverage, null, 2));
  if (rows.some((row) => row.hasIssue)) throw new Error(`surface issues in batch ${batch}: ${rows.filter((row) => row.hasIssue).length}`);
});

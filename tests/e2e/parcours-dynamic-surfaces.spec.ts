import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { surfaceOutcome, surfaceDestinationMatches } from "../../scripts/release/surface-outcome.mjs";

const host = new URL(process.env.E2E_BASE_URL ?? "http://localhost:5173").hostname;
test.skip(!["localhost", "127.0.0.1", "::1"].includes(host), "restricted to a local server");

const locales = ((process.env.PARCOURS_SURFACE_LOCALES ?? "fr,ar").split(",").map((value) => value.trim()).filter(Boolean) as Array<"fr" | "ar">);
const actorFilter = (process.env.PARCOURS_DYNAMIC_ACTORS ?? "public,client,franchise,provider,admin")
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
const seed = JSON.parse(readFileSync(".tmp/dynamic-seed-ids.json", "utf8")) as {
  routes: Record<string, string[]>;
  missingTemplates: string[];
};
const credentials = {
  client: { email: env.MATRICIA_PARCOURS_CLIENT_EMAIL!, password: env.MATRICIA_PARCOURS_CLIENT_PASSWORD! },
  provider: { email: env.MATRICIA_PARCOURS_PROVIDER_EMAIL!, password: env.MATRICIA_PARCOURS_PROVIDER_PASSWORD! },
  franchise: { email: env.MATRICIA_PARCOURS_FRANCHISE_EMAIL!, password: env.MATRICIA_PARCOURS_FRANCHISE_PASSWORD! },
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
  /MANDATE_REQUIRED|NO_MANDATE|FORBIDDEN|MFA_REQUIRED|UNAUTHENTICATED|ORGANIZATION_REQUIRED|CONFIGURATION|NOT_FOUND|MISSING/i,
];
const benignPageErrorPatterns = [
  /Failed to execute 'measure' on 'Performance'/i,
  /cannot have a negative time stamp/i,
];

function sanitize(text: string) {
  return text
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[id]")
    .replace(/\s+/g, " ")
    .slice(0, 400);
}

async function clearSession(page: Page) {
  await page.context().clearCookies();
  await page.goto("/fr/connexion", { waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => undefined);
}

async function signInPassword(page: Page, email: string, password: string) {
  await clearSession(page);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto("/fr/connexion", { waitUntil: "domcontentloaded", timeout: 20_000 });
      const passwordTab = page.getByRole("button", { name: "Mot de passe", exact: true });
      await passwordTab.waitFor({ state: "visible", timeout: 15_000 });
      await passwordTab.click({ timeout: 10_000 });
      await page.locator("#password").waitFor({ state: "visible", timeout: 15_000 });
      await page.locator("#email").fill(email);
      await page.locator("#password").fill(password);
      await page.getByRole("button", { name: "Se connecter", exact: true }).click();
      await page.waitForURL(/\/fr\/(tableau-de-bord|client\/|sous-traitant\/|franchise\/|administration\/)/, { timeout: 45_000 });
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await clearSession(page);
      await page.waitForTimeout(750);
    }
  }
}

async function signInDemoAdmin(page: Page) {
  await clearSession(page);
  await page.goto("/fr/connexion", { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.locator('form:has(input[name="persona"][value="admin"]) button[type="submit"]').click({ timeout: 15_000 });
  await page.waitForURL(/\/fr\/(tableau-de-bord|administration\/)/, { timeout: 45_000 });
}

async function scanRoute(page: Page, actor: string, locale: "fr" | "ar", route: string) {
  const started = Date.now();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const onConsole = (message: { type: () => string; text: () => string }) => {
    if (message.type() !== "error") return;
    const text = sanitize(message.text());
    if (!benignPageErrorPatterns.some((pattern) => pattern.test(text))) consoleErrors.push(text);
  };
  const onPageError = (error: Error) => {
    const text = sanitize(String(error.message ?? error));
    if (!benignPageErrorPatterns.some((pattern) => pattern.test(text))) pageErrors.push(text);
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  let status: number | null = null;
  let heading: string | null = null;
  let workspaceFailure: string | null = null;
  let bodyFailure: string | null = null;
  let accessGate: string | null = null;
  try {
    const response = await page.goto(`/${locale}/${route}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    status = response?.status() ?? null;
    await page.waitForLoadState("load", { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(350);
    const body = sanitize(await page.locator("body").innerText().catch(() => ""));
    heading = (await page.locator("h1").first().textContent().catch(() => null))?.trim() ?? null;
    workspaceFailure = await page.locator("[data-workspace-failure]").first().getAttribute("data-workspace-failure").catch(() => null);
    {
      const failureText = `${workspaceFailure ?? ""} ${body}`;
      for (const pattern of accessGatePatterns) {
        if (pattern.test(failureText)) {
          accessGate = failureText.match(pattern)?.[0] ?? null;
          break;
        }
      }
      {
        for (const pattern of crashPatterns) {
          if (pattern.test(failureText)) {
            bodyFailure = String(pattern);
            break;
          }
        }
      }
    }
    if (status !== null && status >= 400 && !accessGate) bodyFailure = bodyFailure ?? `HTTP_${status}`;
  } catch (error) {
    bodyFailure = sanitize(String((error as Error).message ?? error));
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
  }
  const routePath=route.split("?")[0];
  const expectedGate=actor==="admin-demo"&&["administration/classification-fiscale","administration/fiscalite-maroc"].includes(routePath??"");
  const expectedUrl=new URL(`/${locale}/${route}`,process.env.E2E_BASE_URL??"http://localhost:5173");
  const destinationMatches=surfaceDestinationMatches(page.url(),expectedUrl);
  const outcome=surfaceOutcome({status,heading,workspaceFailure,accessGate,bodyFailure,consoleErrors,pageErrors,expectedGate,destinationMatches});
  return {
    actor,
    locale,
    route,
    status,
    heading,
    workspaceFailure,
    bodyFailure,
    accessGate,
    consoleErrors: consoleErrors.slice(0, 4),
    pageErrors: pageErrors.slice(0, 4),
    ...outcome,
    elapsedMs: Date.now() - started,
  };
}

const actorLogin: Record<string, "public" | "client" | "provider" | "franchise" | "admin"> = {
  public: "public",
  client: "client",
  franchise: "franchise",
  provider: "provider",
  admin: "admin",
};

test("scan dynamic seeded surfaces", async ({ page }) => {
  test.setTimeout(60 * 60_000);
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(45_000);
  const rows = [];
  for (const actor of actorFilter) {
    const routes = seed.routes[actor] ?? [];
    if (!routes.length) continue;
    const login = actorLogin[actor] ?? "public";
    if (login === "admin") await signInDemoAdmin(page);
    else if (login !== "public") await signInPassword(page, credentials[login].email, credentials[login].password);
    for (const locale of locales) {
      for (const route of routes) {
        const row = await scanRoute(page, actor === "admin" ? "admin-demo" : actor, locale, route);
        rows.push(row);
        console.log(JSON.stringify({
          progress: `${actor}/${locale}/${route}`,
          hasIssue: row.hasIssue,
          covered: row.covered,
          status: row.status,
          accessGate: row.accessGate,
          elapsedMs: row.elapsedMs,
        }));
      }
    }
  }
  mkdirSync(".tmp", { recursive: true });
  const summary = {
    generatedAt: new Date().toISOString(),
    locales,
    actors: actorFilter,
    total: rows.length,
    covered: rows.filter((row) => row.covered).length,
    businessCovered: rows.filter((row) => row.businessCovered).length,
    expectedGateCovered: rows.filter((row) => row.expectedGateCovered).length,
    issues: rows.filter((row) => row.hasIssue).length,
    accessGates: rows.filter((row) => row.accessGate).length,
    missingSeedTemplates: seed.missingTemplates,
    topIssues: rows.filter((row) => row.hasIssue).slice(0, 40),
    accessGateRows: rows.filter((row) => row.accessGate).slice(0, 40),
  };
  writeFileSync(".tmp/scan-dynamic-surfaces.json", JSON.stringify({ summary, rows }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (rows.some((row) => row.hasIssue)) throw new Error(`dynamic surface issues: ${rows.filter((row) => row.hasIssue).length}`);
});

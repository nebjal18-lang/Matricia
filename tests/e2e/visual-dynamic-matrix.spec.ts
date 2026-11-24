import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { visualRouteInventory } from "../../scripts/visual/route-inventory.mjs";

type Space = "public" | "shared" | "client" | "provider" | "franchise" | "admin";
type Locale = "fr" | "ar";
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5173";
if (!["localhost", "127.0.0.1", "::1"].includes(new URL(baseURL).hostname)) {
  throw new Error("Visual dynamic matrix requires a local application URL");
}
const states: Partial<Record<Space, string>> = {
  shared: process.env.E2E_CLIENT_STORAGE_STATE,
  client: process.env.E2E_CLIENT_STORAGE_STATE,
  provider: process.env.E2E_PROVIDER_STORAGE_STATE,
  franchise: process.env.E2E_FRANCHISE_STORAGE_STATE,
  admin: process.env.E2E_ADMIN_STORAGE_STATE,
};
const spaces = (process.env.E2E_VISUAL_MATRIX_SPACES ?? "public,shared,client,provider,franchise,admin")
  .split(",").map((value) => value.trim()) as Space[];
const filter = (process.env.E2E_VISUAL_MATRIX_ROUTES ?? "").split(",").map((value) => value.trim()).filter(Boolean);
const inventory = visualRouteInventory();
const staticPaths = new Set(inventory.filter(({ dynamic }) => !dynamic).map(({ route }) => route));
const evidenceRoot = resolve(".tmp/visual-route-matrix", process.env.E2E_VISUAL_MATRIX_RUN_ID ?? "manual", "dynamic");

function pattern(template: string) {
  const segments = template.split("/").map((segment) => segment.startsWith("[...") ? ".+"
    : /^\[[A-Za-z]+Id\]$/u.test(segment) ? "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
    : segment.startsWith("[") ? "[^/]+"
    : segment.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"));
  return new RegExp(`^${segments.join("/")}$`, "u");
}

async function contextFor(browser: Browser, space: Space, locale: Locale, width: 360 | 1280): Promise<BrowserContext> {
  const state = states[space];
  if (space !== "public" && (!state || !existsSync(state))) throw new Error(`MISSING_SANDBOX_AUTH_STATE_${space.toUpperCase()}`);
  return browser.newContext({ baseURL, ...(state ? { storageState: state } : {}),
    locale: locale === "ar" ? "ar-MA" : "fr-MA", timezoneId: "Africa/Casablanca",
    viewport: { width, height: width === 360 ? 800 : 900 } });
}

function sourceUrl(locale: Locale, space: Space, route: string) {
  const url = new URL(`/${locale}/${route}`, baseURL);
  if (space === "provider" || space === "franchise") {
    const organizationId = process.env.E2E_ROLE_ORGANIZATION_ID;
    if (organizationId) url.searchParams.set("organizationId", organizationId);
  }
  if (space === "franchise") {
    const franchiseId = process.env.E2E_FRANCHISE_ID;
    if (franchiseId) url.searchParams.set("franchiseId", franchiseId);
  }
  return url;
}

async function linksOn(page: Page, url: URL) {
  try {
    await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.locator('main[aria-busy="true"]').first().waitFor({ state: "hidden", timeout: 15_000 }).catch(() => undefined);
    return page.locator("a[href]:not([download])").evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href")).filter((href): href is string => Boolean(href)));
  } catch {
    return [];
  }
}

async function inspect(page: Page, url: URL, template: string, space: Space, locale: Locale, width: 360 | 1280) {
  const screenshot = resolve(evidenceRoot, "screenshots", `${space}-${locale}-${width}-${template.replaceAll("/", "-")}.png`);
  try {
    const response = await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.locator('main[aria-busy="true"]').first().waitFor({ state: "hidden", timeout: 20_000 }).catch(() => undefined);
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
    const observed = await page.evaluate(() => ({ pathname: location.pathname.replace(/\/$/u, ""),
      heading: Boolean(document.querySelector("h1")), bodyLength: document.body.innerText.trim().length,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      lang: document.documentElement.lang, dir: document.documentElement.dir,
      fatal: /Application error|Internal Server Error|ChunkLoadError/u.test(document.body.innerText) }));
    const issues = [
      observed.pathname !== url.pathname.replace(/\/$/u, "") && "redirected",
      (response?.status() ?? 500) >= 400 && "http-error",
      !observed.heading && "missing-h1",
      observed.bodyLength < 30 && "empty-content",
      observed.overflow && "horizontal-overflow",
      observed.lang !== locale && "wrong-language",
      observed.dir !== (locale === "ar" ? "rtl" : "ltr") && "wrong-direction",
      observed.fatal && "fatal-error",
    ].filter(Boolean);
    if (!issues.length) {
      mkdirSync(resolve(evidenceRoot, "screenshots"), { recursive: true });
      await page.screenshot({ path: screenshot, fullPage: true, animations: "disabled", timeout: 30_000 });
      if (process.env.E2E_VISUAL_MATRIX_AXE === "1") {
        const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        if (audit.violations.length) issues.push(...audit.violations.map(({ id }) => `axe:${id}`));
      }
    }
    return { template, locale, width, status: response?.status() ?? null, issues, screenshot: issues.length ? null : screenshot };
  } catch (error) {
    return { template, locale, width, status: null, issues: [String(error).split("\n")[0]?.slice(0, 160) ?? "capture-error"], screenshot: null };
  }
}

if (process.env.E2E_VISUAL_MATRIX_RUN_ID) for (const space of spaces) {
  test(`${space} dynamic visual route discovery`, async ({ browser }, testInfo) => {
    test.setTimeout(45 * 60_000);
    const templates = inventory.filter((entry) => entry.space === space && entry.dynamic && (!filter.length || filter.includes(entry.route)));
    const sources = inventory.filter((entry) => entry.space === space && !entry.dynamic);
    const patterns = new Map(templates.map(({ route }) => [route, pattern(route)]));
    const found = new Map<string, URL>();
    const discovery = await contextFor(browser, space, "fr", 1280);
    const discoveryPage = await discovery.newPage();
    try {
      for (const source of sources) {
        if (found.size === templates.length) break;
        for (const href of await linksOn(discoveryPage, sourceUrl("fr", space, source.route))) {
          let candidate: URL;
          try { candidate = new URL(href, baseURL); } catch { continue; }
          if (candidate.origin !== new URL(baseURL).origin || !candidate.pathname.startsWith("/fr/")) continue;
          const path = candidate.pathname.slice(4).replace(/\/$/u, "");
          if (staticPaths.has(path)) continue;
          for (const [template, regexp] of patterns) {
            if (!found.has(template) && regexp.test(path)) found.set(template, candidate);
          }
        }
      }
    } finally { await discovery.close(); }
    const rows = [];
    for (const locale of ["fr", "ar"] as const) for (const width of [360, 1280] as const) {
      const context = await contextFor(browser, space, locale, width);
      const page = await context.newPage();
      try {
        for (const { route } of templates) {
          const candidate = found.get(route);
          if (!candidate) { rows.push({ template: route, locale, width, status: null, issues: ["no-seeded-link"], screenshot: null }); continue; }
          const target = new URL(candidate.href);
          target.pathname = `/${locale}/${candidate.pathname.slice(4)}`;
          rows.push(await inspect(page, target, route, space, locale, width));
        }
      } finally { await context.close(); }
    }
    const report = { schemaVersion: 1, space, templates: templates.length, discovered: found.size,
      rendered: rows.filter((row) => row.screenshot).length, total: rows.length,
      missingTemplates: templates.filter(({ route }) => !found.has(route)).map(({ route }) => route), rows };
    mkdirSync(resolve(evidenceRoot, "reports"), { recursive: true });
    const reportPath = resolve(evidenceRoot, "reports", `${space}.json`);
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    await testInfo.attach("visual-dynamic-matrix.json", { path: reportPath, contentType: "application/json" });
    if (rows.some((row) => row.issues.length)) throw new Error(`VISUAL_DYNAMIC_INCOMPLETE ${space}: ${report.rendered}/${report.total} rendered, ${report.missingTemplates.length} templates without seeded link`);
  });
}

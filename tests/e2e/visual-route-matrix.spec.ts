import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { test, type Browser, type Page } from "@playwright/test";
import { visualRouteInventory } from "../../scripts/visual/route-inventory.mjs";

type Locale = "fr" | "ar";
type Space = "public" | "shared" | "client" | "provider" | "franchise" | "admin";
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5173";
if (!["localhost", "127.0.0.1", "::1"].includes(new URL(baseURL).hostname)) {
  throw new Error("Visual route matrix requires a local application URL");
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
const locales = (process.env.E2E_VISUAL_MATRIX_LOCALES ?? "fr,ar")
  .split(",").map((value) => value.trim()) as Locale[];
const routeFilter = (process.env.E2E_VISUAL_MATRIX_ROUTES ?? "").split(",").map((value) => value.trim()).filter(Boolean);
const inventory = visualRouteInventory();
const evidenceRoot = resolve(".tmp/visual-route-matrix", process.env.E2E_VISUAL_MATRIX_RUN_ID ?? "manual");

async function capture(page: Page, locale: Locale, space: Space, route: string, screenshotPath: string) {
  const url = new URL(`/${locale}/${route}`, baseURL);
  if (space === "provider" || space === "franchise") {
    const organizationId = process.env.E2E_ROLE_ORGANIZATION_ID;
    if (organizationId) url.searchParams.set("organizationId", organizationId);
  }
  if (space === "franchise") {
    const franchiseId = process.env.E2E_FRANCHISE_ID;
    if (franchiseId) url.searchParams.set("franchiseId", franchiseId);
  }
  const errors: string[] = [];
  const onError = (error: Error) => errors.push(error.message.split("\n")[0]?.slice(0, 160) ?? "page error");
  page.on("pageerror", onError);
  try {
    const response = await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 45_000 });
    if (route === "administration/gouvernance-franchise") {
      await page.waitForURL(new RegExp(`/${locale}/administration/gouvernance(?:[/?#]|$)`, "u"), { timeout: 15_000 }).catch(() => undefined);
    }
    await page.locator("body").waitFor({ state: "visible", timeout: 15_000 });
    await page.locator('main[aria-busy="true"]').first().waitFor({ state: "hidden", timeout: 20_000 }).catch(() => undefined);
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
    const observed = await page.evaluate(() => ({
      pathname: location.pathname.replace(/\/$/u, ""),
      heading: document.querySelector("h1")?.textContent?.trim() ?? null,
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      bodyLength: document.body.innerText.trim().length,
      loading: Boolean(document.querySelector('main[aria-busy="true"]')),
      fatal: /Application error|Internal Server Error|ChunkLoadError/u.test(document.body.innerText),
    }));
    const rendered = observed.pathname === url.pathname.replace(/\/$/u, "") && (response?.status() ?? 500) < 400;
    const expectedRedirect = route === "administration/gouvernance-franchise"
      && observed.pathname === `/${locale}/administration/gouvernance`;
    const issues = [
      !rendered && !expectedRedirect && "not-rendered",
      rendered && !observed.heading && "missing-h1",
      rendered && observed.loading && "loading-timeout",
      rendered && observed.bodyLength < 30 && "empty-content",
      rendered && observed.overflow && "horizontal-overflow",
      rendered && observed.lang !== locale && "wrong-language",
      rendered && observed.dir !== (locale === "ar" ? "rtl" : "ltr") && "wrong-direction",
      rendered && observed.fatal && "fatal-error",
      ...errors.map(() => "page-error"),
    ].filter(Boolean);
    let accessibility: Array<{ id: string; impact: string | null }> = [];
    if (rendered) {
      await page.screenshot({ path: screenshotPath, fullPage: true, animations: "disabled", timeout: 30_000 });
      if (process.env.E2E_VISUAL_MATRIX_AXE === "1") {
        const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        accessibility = audit.violations.map(({ id, impact }) => ({ id, impact }));
        if (accessibility.length) issues.push("accessibility");
      }
    }
    return { route, status: response?.status() ?? null, rendered, expectedRedirect, heading: observed.heading,
      lang: observed.lang, dir: observed.dir, issues, accessibility, screenshot: rendered ? screenshotPath : null };
  } catch (error) {
    return { route, status: null, rendered: false, heading: null, lang: null, dir: null,
      issues: [String(error).split("\n")[0]?.slice(0, 180) ?? "capture-error"], accessibility: [], screenshot: null };
  } finally {
    page.off("pageerror", onError);
  }
}

async function contextFor(browser: Browser, space: Space, locale: Locale, mobile: boolean) {
  const state = states[space];
  if (space !== "public" && (!state || !existsSync(state))) throw new Error(`MISSING_SANDBOX_AUTH_STATE_${space.toUpperCase()}`);
  return browser.newContext({ baseURL, ...(state ? { storageState: state } : {}),
    locale: locale === "ar" ? "ar-MA" : "fr-MA", timezoneId: "Africa/Casablanca",
    viewport: mobile ? { width: 360, height: 800 } : { width: 1280, height: 900 } });
}

if (process.env.E2E_VISUAL_MATRIX_RUN_ID) for (const space of spaces) for (const locale of locales) {
  test(`${space} ${locale} visual route matrix`, async ({ browser }, testInfo) => {
    test.setTimeout(45 * 60_000);
    const mobile = testInfo.project.name.includes("mobile");
    const context = await contextFor(browser, space, locale, mobile);
    const page = await context.newPage();
    const routes = inventory.filter((entry) => entry.space === space && (!routeFilter.length || routeFilter.includes(entry.route)));
    const rows = [];
    try {
      for (const entry of routes) {
        if (entry.dynamic) {
          rows.push({ route: entry.route, status: null, rendered: false, issues: ["dynamic-id-required"], screenshot: null });
          continue;
        }
        const screenshotPath = resolve(evidenceRoot, "screenshots", `${space}-${locale}-${mobile ? "360" : "1280"}-${entry.route.replaceAll("/", "-") || "home"}.png`);
        mkdirSync(resolve(evidenceRoot, "screenshots"), { recursive: true });
        rows.push(await capture(page, locale, space, entry.route, screenshotPath));
      }
    } finally {
      await context.close();
    }
    const report = { schemaVersion: 1, space, locale, viewport: mobile ? 360 : 1280,
      total: rows.length, rendered: rows.filter((row) => row.rendered).length,
      dynamicUnresolved: rows.filter((row) => row.issues.includes("dynamic-id-required")).length,
      issues: rows.filter((row) => row.issues.length).length, rows };
    mkdirSync(resolve(evidenceRoot, "reports"), { recursive: true });
    const reportPath = resolve(evidenceRoot, "reports", `${space}-${locale}-${mobile ? "360" : "1280"}.json`);
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    await testInfo.attach("visual-route-matrix.json", { path: reportPath, contentType: "application/json" });
    if (report.issues) throw new Error(`VISUAL_MATRIX_INCOMPLETE ${space}/${locale}/${report.viewport}: ${report.rendered}/${report.total} rendered, ${report.issues} issues; see attached report`);
  });
}

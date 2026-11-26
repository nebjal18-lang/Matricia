import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const auditDir = fileURLToPath(new URL('.', import.meta.url));
const evidence = join(auditDir, 'evidence');
await mkdir(join(evidence, 'screenshots'), { recursive: true });
const source = JSON.parse(await readFile(join(evidence, 'isolated-web.json'), 'utf8'));
const base = 'http://127.0.0.1:5175';
const routes = ['', '/diagnostic', '/besoin', '/fournisseur', '/franchise', '/abonnements', '/entreprises', '/a-propos', '/contact', '/mentions-legales', '/confidentialite', '/conditions', '/cookies', '/connexion'];
const widths = [360, 390, 768, 1024, 1440];
const screenshotRoutes = new Set(['', '/diagnostic', '/besoin', '/connexion', '/fournisseur', '/franchise']);
const startedAt = new Date().toISOString();
const pages = [];
const protectedRoutes = [];
const keyboard = [];
const blockedRequests = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const locale of (process.argv[2] ? [process.argv[2]] : ['fr', 'ar'])) {
    const context = await browser.newContext({ locale: locale === 'ar' ? 'ar-MA' : 'fr-MA', timezoneId: 'Africa/Casablanca' });
    await context.route('**/*', route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.protocol === 'data:' || url.protocol === 'blob:') return route.continue();
      if (!['localhost', '127.0.0.1'].includes(url.hostname) || !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        blockedRequests.push({ method: request.method(), host: url.hostname, pathname: url.pathname });
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    let pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    for (const route of routes) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      pageErrors = [];
      const start = Date.now();
      let response;
      try {
        response = await page.goto(`${base}/${locale}${route}`, { waitUntil: 'load', timeout: 60_000 });
        await page.evaluate(() => document.fonts.ready);
      } catch (error) {
        pages.push({ locale, route, status: 'NAVIGATION_ERROR', error: error.message });
        continue;
      }
      const navigationMs = Date.now() - start;
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1000 });
        const dom = await page.evaluate(() => ({
          lang: document.documentElement.lang, dir: document.documentElement.dir,
          computedDirection: getComputedStyle(document.body).direction,
          viewport: document.documentElement.clientWidth, contentWidth: document.documentElement.scrollWidth,
          title: document.title, h1: [...document.querySelectorAll('h1')].map(node => node.textContent.trim()),
          mainCount: document.querySelectorAll('main').length,
          brokenImages: [...document.images].filter(node => node.complete && node.naturalWidth === 0).map(node => node.getAttribute('src')),
          overflowingElements: [...document.querySelectorAll('h1,h2,button,input,select,textarea,table')]
            .filter(node => { const rect = node.getBoundingClientRect(); return rect.width > 0 && (rect.left < -2 || rect.right > innerWidth + 2); })
            .slice(0, 12).map(node => ({ tag: node.tagName, text: node.textContent.trim().slice(0, 90), class: node.className })),
        }));
        const result = { locale, route, width, httpStatus: response?.status(), finalPath: new URL(page.url()).pathname, navigationMs, ...dom, pageErrors: [...new Set(pageErrors)] };
        if (width === 360 || width === 1440) {
          try {
            const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
            result.axe = { engine: axe.testEngine, passes: axe.passes.length, incomplete: axe.incomplete.map(item => item.id),
              violations: axe.violations.map(item => ({ id: item.id, impact: item.impact, help: item.help, helpUrl: item.helpUrl,
                nodes: item.nodes.map(node => ({ target: node.target, html: node.html, failureSummary: node.failureSummary })) })) };
          } catch (error) { result.axeError = error.message; }
          if (screenshotRoutes.has(route) || result.axe?.violations.length || dom.contentWidth > dom.viewport) {
            const filename = `${locale}-${route.slice(1).replaceAll('/', '-') || 'home'}-${width}.png`;
            await page.screenshot({ path: join(evidence, 'screenshots', filename), fullPage: true });
            result.screenshot = `screenshots/${filename}`;
          }
        }
        pages.push(result);
      }
      console.log(`SCANNED ${locale}${route || '/'} HTTP ${response?.status()}`);
    }
    for (const route of ['/client/accueil', '/sous-traitant/identite', '/franchise/accueil', '/administration/command-center', '/organisation', '/securite/compte']) {
      try {
        const response = await page.goto(`${base}/${locale}${route}`, { waitUntil: 'load', timeout: 60_000 });
        protectedRoutes.push({ locale, route, httpStatus: response?.status(), finalPath: new URL(page.url()).pathname,
          loginRedirect: new URL(page.url()).pathname === `/${locale}/connexion`, h1: await page.locator('h1').allTextContents() });
      } catch (error) { protectedRoutes.push({ locale, route, error: error.message }); }
    }
    await page.goto(`${base}/${locale}`, { waitUntil: 'load' });
    await page.setViewportSize({ width: 360, height: 800 });
    await page.keyboard.press('Tab');
    const firstFocus = await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.trim().slice(0, 100), href: document.activeElement?.getAttribute('href') }));
    await page.keyboard.press('Enter');
    const afterSkip = await page.evaluate(() => ({ tag: document.activeElement?.tagName, id: document.activeElement?.id, hash: location.hash }));
    const menu = page.getByRole('button', { name: locale === 'fr' ? 'Ouvrir le menu' : /القائمة/ }).first();
    let menuState = null;
    if (await menu.count()) {
      const trigger = await menu.elementHandle();
      await menu.click();
      menuState = { expanded: await trigger.getAttribute('aria-expanded'), dialogCount: await page.getByRole('dialog').count() };
      await page.keyboard.press('Escape');
      menuState.afterEscapeExpanded = await trigger.getAttribute('aria-expanded');
      menuState.focusReturned = await trigger.evaluate(node => node === document.activeElement);
    }
    keyboard.push({ locale, firstFocus, afterSkip, menuState });
    await context.close();
  }
} finally {
  await browser.close();
  const report = { startedAt, finishedAt: new Date().toISOString(), baseURL: base, source, environment: 'Node22 isolated checkout, development server, local API, demo disabled; no authenticated business mutations',
    limitations: ['No authenticated journey proof', 'No screen-reader manual session', 'Viewport emulation, not real mobile hardware', 'No approved reference-image pixel comparison', 'Development timings cannot validate production Web Vitals'],
    pages, protectedRoutes, keyboard, blockedRequests };
  await writeFile(join(evidence, 'browser-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ pageViewportChecks: pages.length, axeScans: pages.filter(p => p.axe).length,
    pagesWithViolations: pages.filter(p => p.axe?.violations.length).length,
    horizontalOverflow: pages.filter(p => p.contentWidth > p.viewport).length,
    protectedRoutes: protectedRoutes.length, blockedRequests: blockedRequests.length }));
}

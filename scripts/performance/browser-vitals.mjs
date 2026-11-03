import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';

export function validatePlan(plan) {
  if (plan?.environment !== 'staging' || typeof plan.expectedOrigin !== 'string') throw new Error('PERFORMANCE_STAGING_TARGET_REQUIRED');
  const origin = new URL(plan.origin);
  if (origin.origin !== plan.expectedOrigin || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || !['http:', 'https:'].includes(origin.protocol)) throw new Error('PERFORMANCE_ORIGIN_MISMATCH');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) && origin.protocol !== 'https:') throw new Error('PERFORMANCE_HTTPS_REQUIRED');
  if (plan.productionOrigin && origin.origin === plan.productionOrigin) throw new Error('PERFORMANCE_PRODUCTION_REFUSED');
  if (!Array.isArray(plan.routes) || plan.routes.length === 0 || plan.routes.some(route => !/^\/(?:fr|ar)(?:\/|$)/.test(route.path) || route.path.includes('://') || !route.interaction?.selector || !['click', 'fill'].includes(route.interaction.type))) throw new Error('PERFORMANCE_ROUTES_AND_INTERACTIONS_REQUIRED');
  return origin.origin;
}
export function evaluateMetrics(metrics) {
  return Number.isFinite(metrics.lcpMs) && metrics.lcpMs > 0 && metrics.lcpMs <= 2500
    && Number.isFinite(metrics.cls) && metrics.cls >= 0 && metrics.cls <= 0.1
    && metrics.interactions > 0 && Number.isFinite(metrics.inpUpperBoundMs) && metrics.inpUpperBoundMs <= 200;
}
async function main() {
  const plan = JSON.parse(await readFile(resolve(process.argv[2] ?? 'docs/release/performance-plan.json'), 'utf8'));
  const origin = validatePlan(plan);
  const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  const measurements = [], startedAt = new Date().toISOString();
  try {
    for (const viewport of [{ width: 360, height: 800 }, { width: 1280, height: 900 }]) {
      for (const target of plan.routes) {
        const context = await browser.newContext({ viewport, reducedMotion: 'reduce', ...(plan.storageState ? { storageState: plan.storageState } : {}) });
        try {
          await context.addInitScript(() => {
            const metrics = { lcpMs: 0, cls: 0, interactions: 0, events: [], supported: PerformanceObserver.supportedEntryTypes.includes('event') };
            window.__matriciaVitals = metrics;
            let current = 0, start = 0, previous = 0;
            new PerformanceObserver(list => { for (const entry of list.getEntries()) metrics.lcpMs = entry.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
            new PerformanceObserver(list => { for (const entry of list.getEntries()) {
              if (entry.hadRecentInput) continue;
              if (entry.startTime - previous > 1000 || entry.startTime - start > 5000) { start = entry.startTime; current = 0; }
              current += entry.value; previous = entry.startTime; metrics.cls = Math.max(metrics.cls, current);
            } }).observe({ type: 'layout-shift', buffered: true });
            if (metrics.supported) new PerformanceObserver(list => { for (const entry of list.getEntries()) if (entry.interactionId) metrics.events.push({ id: entry.interactionId, duration: entry.duration }); }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
            for (const type of ['click', 'keydown']) addEventListener(type, event => { if (event.isTrusted) metrics.interactions++; }, { capture: true });
          });
          const page = await context.newPage();
          const response = await page.goto(origin + target.path, { waitUntil: 'networkidle' });
          if (!response || response.status() !== 200 || new URL(page.url()).pathname !== target.path) throw new Error('PERFORMANCE_ROUTE_UNAVAILABLE_OR_REDIRECTED');
          await page.getByRole('heading', { level: 1 }).waitFor({ state: 'visible' });
          await page.evaluate(() => document.fonts.ready);
          const locator = page.locator(target.interaction.selector);
          if (target.interaction.type === 'fill') { await locator.fill(target.interaction.value ?? 'test'); await locator.press('ArrowLeft'); }
          else await locator.click();
          await page.waitForTimeout(1000);
          const metrics = await page.evaluate(() => {
            const current = window.__matriciaVitals;
            const grouped = new Map();
            for (const event of current.events) grouped.set(event.id, Math.max(grouped.get(event.id) ?? 0, event.duration));
            const durations = [...grouped.values()].sort((a, b) => b - a);
            return { lcpMs: current.lcpMs, cls: current.cls, interactions: current.interactions,
              inpUpperBoundMs: current.supported && current.interactions > 0 ? (durations[Math.floor(current.interactions / 50)] ?? 16) : null,
              inpMeasurement: durations.length ? 'event-timing-p98' : 'below-observer-threshold-upper-bound', eventTimingSupported: current.supported };
          });
          measurements.push({ path: target.path, viewport, ...metrics, passed: evaluateMetrics(metrics) });
        } finally { await context.close(); }
      }
    }
  } finally { await browser.close(); }
  const passed = measurements.length > 0 && measurements.every(item => item.passed);
  const report = { schemaVersion: 1, check: 'performance', environment: ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname) ? 'development-local' : 'staging', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), command: 'node scripts/performance/browser-vitals.mjs <verified-staging-plan>', status: passed ? 'passed' : 'failed', exitCode: passed ? 0 : 1, startedAt, finishedAt: new Date().toISOString(), assertions: measurements.length * 3, skipped: 0, flaky: 0, expectedFailures: 0, kind: 'synthetic-controlled-browser-not-field-RUM', measurements };
  await mkdir('artifacts/test-results/acceptance', { recursive: true });
  await writeFile('artifacts/test-results/acceptance/performance-summary.json', JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(`Performance navigateur: ${measurements.length} scénarios, ${passed ? 'PASS' : 'FAIL'}`);
  if (!passed) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

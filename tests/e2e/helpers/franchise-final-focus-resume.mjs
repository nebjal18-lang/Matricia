import { fixtureState, sourceCandidate, privateDirectory, actorSession } from './franchise-final-support.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const selection = process.argv.find(a => a.startsWith('--only='))?.slice(7);
const selected = selection ? new Set(selection.split(',')) : null;
if (selected && [...selected].some(key => !['fr:375:relances', 'fr:375:documents'].includes(key))) throw Error('ONLY_RECORDED_DEVELOPMENT_NAVIGATION_INTERRUPTS_MAY_BE_RETRIED');
const state = await fixtureState(), pin = await sourceCandidate();
if (JSON.stringify(state.candidate.migrations) !== JSON.stringify(pin.migrations)) throw Error('REVIEWED_EXACT_DATABASE_SCHEMA_REQUIRED');
const dir = await privateDirectory(state), file = resolve(dir, 'actors.private.json'), cohort = JSON.parse(await readFile(file));
const owner = cohort.actors.find(a => a.label === 'owner'), first = cohort.mandates.find(m => m.label === 'FIRST');
const native = await actorSession(state, owner, file, cohort), out = resolve(`docs/franchise-completion/evidence/browser/focus-resume-${pin.commit.slice(0, 7)}${selected ? '-navigation-retry' : ''}`);
await mkdir(out, { recursive: true });
const proof = { scope: 'TARGETED_REGRESSION_OF_SIX_RECORDED_FOCUS_FAILURES_FR_AR', candidate: pin.commit, appTree: pin.appTree, runtimeMode: 'DEVELOPMENT', optimizedFinalBrowserCertification: false, expectedCases: selected ? selected.size : 12, ruleExclusions: [], status: 'RUNNING', cases: [], pageErrors: [] };
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
try {
  for (const locale of ['fr', 'ar']) for (const width of [375, 390]) {
    if (selected && !['qualite','relances','documents'].some(path => selected.has(`${locale}:${width}:${path}`))) continue;
    const context = await browser.newContext({ viewport: { width, height: 960 }, hasTouch: true, serviceWorkers: 'block' });
    await context.addCookies(native.cookies); const page = await context.newPage(); page.on('pageerror', e => proof.pageErrors.push(String(e).slice(0, 500)));
    try {
      for (const path of ['qualite', 'relances', 'documents']) {
        if (selected && !selected.has(`${locale}:${width}:${path}`)) continue;
        const item = { locale, width, path, status: 'RUNNING' };
        try {
          const url = new URL(`http://127.0.0.1:${state.appPort}/${locale}/franchise/${path}`);
          url.searchParams.set('organizationId', owner.organizationId); url.searchParams.set('franchiseId', first.activation.franchiseId);
          const response = await page.goto(url.href, { waitUntil: 'networkidle', timeout: 120000 }); item.http = response.status();
          if (item.http !== 200) throw Error('TARGET_PAGE_HTTP_FAILURE');
          await expect(page.locator('[data-workspace-failure]')).toHaveCount(0);
          await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
          item.documentOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); if (item.documentOverflow) throw Error('DOCUMENT_HORIZONTAL_OVERFLOW');
          const regions = page.locator('.client-table-wrap'); item.regions = [];
          for (let i = 0; i < await regions.count(); i++) {
            const region = regions.nth(i), dimensions = await region.evaluate(e => ({ width: e.clientWidth, scrollWidth: e.scrollWidth, tabIndex: e.tabIndex }));
            if (!dimensions.width || dimensions.scrollWidth <= dimensions.width) continue;
            await region.focus(); await expect(region).toBeFocused();
            const before = await region.evaluate(e => e.scrollLeft); for (let key = 0; key < 4; key++) await page.keyboard.press(locale === 'ar' ? 'ArrowLeft' : 'ArrowRight');
            await expect.poll(async () => Math.abs((await region.evaluate(e => e.scrollLeft)) - before), { timeout: 5000 }).toBeGreaterThan(1);
            item.regions.push({ ...dimensions, keyboardScrollVerified: true });
          }
          if (!item.regions.length) throw Error('ACTUAL_PREVIOUSLY_SCROLLING_REGION_REQUIRED');
          const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
          item.violations = axe.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(n => n.target) }));
          item.incompleteRules = axe.incomplete.map(r => r.id); if (item.violations.length) throw Error('ACCESSIBILITY_VIOLATION_REMAINS');
          item.status = 'PASS';
        } catch (error) { item.status = 'FAIL'; item.failure = String(error).slice(0, 1200); process.exitCode = 1; }
        await page.screenshot({ path: resolve(out, `${locale}-${width}-${path}.png`), fullPage: true }).catch(() => {});
        proof.cases.push(item); await writeFile(resolve(out, 'summary.json'), JSON.stringify(proof, null, 2) + '\n'); console.log(JSON.stringify({ locale, width, path, status: item.status, failure: item.failure }));
      }
    } finally { await context.close(); }
  }
  proof.status = proof.cases.length === proof.expectedCases && proof.cases.every(c => c.status === 'PASS') && !proof.pageErrors.length ? 'PASSED' : 'FAILED';
} catch (error) { proof.status = 'FAILED'; proof.failure = String(error).slice(0, 1200); process.exitCode = 1; }
finally { await browser.close(); await writeFile(resolve(out, 'summary.json'), JSON.stringify(proof, null, 2) + '\n'); console.log(JSON.stringify({ status: proof.status, cases: proof.cases.length, failures: proof.cases.filter(c => c.status !== 'PASS').length, pageErrors: proof.pageErrors.length })); }

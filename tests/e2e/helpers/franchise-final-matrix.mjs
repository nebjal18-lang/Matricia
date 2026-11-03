import { fixtureState, privateDirectory, actorSession, sourceCandidate } from './franchise-final-support.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const state = await fixtureState(), pin = await sourceCandidate();
if (JSON.stringify(state.candidate.migrations) !== JSON.stringify(pin.migrations)) throw Error('REVIEWED_EXACT_DATABASE_SCHEMA_REQUIRED');
const dir = await privateDirectory(state), file = resolve(dir, 'actors.private.json'), cohort = JSON.parse(await readFile(file));
const mandate = cohort.mandates.find(value => value.label === 'FIRST');
if (mandate?.activation?.mode !== 'NON_CONTRACTUAL_DEMO') throw Error('NATIVE_EXPLICIT_TEST_MANDATE_ACTIVATION_REQUIRED');
const smoke = process.argv.includes('--smoke'), spot = process.argv.includes('--spot360');
if (smoke && spot) throw Error('ONE_MATRIX_SCOPE_REQUIRED');
const parallel = Number(process.argv.find(value => value.startsWith('--parallel='))?.slice(11) ?? 1);
if (![1, 2].includes(parallel)) throw Error('BOUNDED_BROWSER_PARALLELISM_REQUIRED');
const owner = cohort.actors.find(value => value.label === 'owner');
const folder = spot ? 'spot360' : smoke ? 'smoke' : process.argv.includes('--phase=core') ? 'matrix-core' : 'matrix-final';
const out = resolve(`docs/franchise-completion/evidence/browser/${folder}-${pin.commit.slice(0, 7)}`);
await mkdir(out, { recursive: true });
const fullRoutes = ['accueil', 'recherche', 'bibliotheque', 'services', 'services/nouveau', 'questionnaires', 'questionnaires/nouveau', 'regles', 'regles/nouvelle', 'validations', 'perimetre', 'fournisseurs', 'fournisseurs/inviter', 'clients/inviter', 'demandes', 'qualite', 'performance', 'relances', 'digest', 'marketing', 'documents', 'messages', 'gouvernance', 'finance'];
const routes = spot ? ['accueil', 'services'] : smoke ? ['accueil', 'services', 'qualite', 'marketing', 'finance'] : fullRoutes;
const widths = spot ? [360] : smoke ? [390] : [375, 390, 768, 1440], locales = ['fr', 'ar'];
const proof = { scope: spot ? 'FRANCHISE_GOLD_MINIMUM_360_HEADER_AND_SERVICES' : 'FRANCHISE_FR_AR_RESPONSIVE_NATIVE_MANDATE', candidate: pin.commit, appTree: pin.appTree, locales, widths, routes, parallelContexts: parallel, mandateActivation: 'NON_CONTRACTUAL_DEMO', hostedCertification: false, manualFullWcagCertification: false, axeRuleExclusions: [], status: 'RUNNING', cases: [], pageErrors: [] };
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const safe = value => String(value).replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/gu, '[REDACTED]').slice(0, 1200);
let saved = Promise.resolve();
function save() { const snapshot = JSON.stringify(proof, null, 2) + '\n'; saved = saved.then(() => writeFile(resolve(out, 'summary.json'), snapshot)); return saved; }
try {
  // Renew once before contexts start. Concurrent readers never race native
  // refresh-token persistence, and no session or JWT is fabricated.
  const native = await actorSession(state, owner, file, cohort);
  const groups = locales.flatMap(locale => widths.map(width => ({ locale, width })));
  let next = 0;
  async function visitGroup({ locale, width }) {
    const context = await browser.newContext({ viewport: { width, height: 960 }, hasTouch: true, serviceWorkers: 'block' });
    await context.addCookies(native.cookies); const page = await context.newPage();
    page.on('pageerror', error => proof.pageErrors.push({ locale, width, error: safe(error) }));
    try {
      for (const path of routes) {
        const item = { locale, width, path, status: 'RUNNING' }, start = Date.now();
        try {
          const target = new URL(`http://127.0.0.1:${state.appPort}/${locale}/franchise/${path}`);
          target.searchParams.set('organizationId', owner.organizationId); target.searchParams.set('franchiseId', mandate.activation.franchiseId);
          const response = await page.goto(target.toString(), { waitUntil: 'networkidle', timeout: 90000 });
          item.http = response.status();
          if (item.http !== 200 || new URL(page.url()).pathname.includes('/connexion')) throw Error('NATIVE_FRANCHISE_ROUTE_NOT_AUTHORIZED');
          item.lang = await page.locator('html').getAttribute('lang'); item.dir = await page.locator('html').getAttribute('dir');
          if (item.lang !== locale || item.dir !== (locale === 'ar' ? 'rtl' : 'ltr')) throw Error('FRANCHISE_DOCUMENT_LOCALE_MISMATCH');
          item.overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
          if (item.overflow) throw Error('FRANCHISE_HORIZONTAL_OVERFLOW');
          item.workspaceFailures = await page.locator('[data-workspace-failure]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-workspace-failure')));
          if (item.workspaceFailures.length) throw Error('FRANCHISE_WORKSPACE_READ_FAILURE:' + item.workspaceFailures.join(','));
          item.tables = await page.locator('table.client-space-table').evaluateAll(tables => tables.filter(table => table.getBoundingClientRect().width > 0).map(table => ({ columns: table.querySelector('thead tr')?.children.length ?? 0, width: Math.round(table.getBoundingClientRect().width), headerHeight: Math.round(table.querySelector('thead')?.getBoundingClientRect().height ?? 0), firstRowHeight: Math.round(table.querySelector('tbody tr')?.getBoundingClientRect().height ?? 0), wrapperWidth: table.parentElement?.clientWidth, wrapperScrollWidth: table.parentElement?.scrollWidth })));
          if (item.tables.some(table => table.columns >= 6 && table.width < 600)) throw Error('FRANCHISE_TABLE_COLUMNS_COMPRESSED_BELOW_READABLE_WIDTH');
          const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
          item.axe = { violations: result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })), incomplete: result.incomplete.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) })) };
          if (item.axe.violations.length) throw Error('FRANCHISE_ACCESSIBILITY_VIOLATION');
          if (width === 390 || path === 'accueil' || spot) { const name = `${locale}-${width}-${path.replaceAll('/', '_')}.png`; await page.screenshot({ path: resolve(out, name), fullPage: true }); item.screenshot = name; }
          item.status = 'PASS';
        } catch (error) {
          item.status = 'FAIL'; item.failure = safe(error); process.exitCode = 1;
          if (item.http === 200) { const name = `${locale}-${width}-${path.replaceAll('/', '_')}-failure.png`; await page.screenshot({ path: resolve(out, name), fullPage: true }).catch(() => {}); item.screenshot = name; }
        } finally {
          item.elapsedMs = Date.now() - start; proof.cases.push(item); await save();
          console.log(JSON.stringify({ locale, width, path, status: item.status, failure: item.failure }));
        }
      }
    } finally { await context.close(); }
  }
  const workers = await Promise.allSettled(Array.from({ length: parallel }, async () => { while (next < groups.length) await visitGroup(groups[next++]); }));
  const rejected = workers.find(result => result.status === 'rejected'); if (rejected) throw rejected.reason;
  const expected = locales.length * widths.length * routes.length;
  proof.status = proof.cases.length === expected && proof.cases.every(item => item.status === 'PASS') && proof.pageErrors.length === 0 ? 'PASSED' : 'FAILED';
} catch (error) { proof.status = 'FAILED'; proof.failure = safe(error); process.exitCode = 1; }
finally {
  await browser.close(); await save();
  console.log(JSON.stringify({ status: proof.status, cases: proof.cases.length, failures: proof.cases.filter(item => item.status !== 'PASS').length, pageErrors: proof.pageErrors.length }));
}

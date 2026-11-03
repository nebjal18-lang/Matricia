import { fixtureState, privateDirectory, actorSession, sourceCandidate } from './franchise-final-support.mjs';
import { docker } from './provider-browser/safety.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
if (!process.argv.includes('--coordinated-outage')) throw Error('EXCLUSIVE_COORDINATED_OWNED_AUTH_OUTAGE_REQUIRED');
const { chromium, expect } = await import('@playwright/test');
const state = await fixtureState(), pin = await sourceCandidate();
if (JSON.stringify(state.candidate.migrations) !== JSON.stringify(pin.migrations)) throw Error('REVIEWED_EXACT_DATABASE_SCHEMA_REQUIRED');
const dir = await privateDirectory(state), file = resolve(dir, 'actors.private.json'), cohort = JSON.parse(await readFile(file));
const owner = cohort.actors.find(value => value.label === 'owner'), mandate = cohort.mandates.find(value => value.label === 'FIRST');
const native = await actorSession(state, owner, file, cohort), name = `matricia_provider_browser_auth_${state.token.replaceAll('-', '').slice(0, 16)}`;
if (!state.children.includes(name)) throw Error('EXACT_OWNED_GOTRUE_CONTAINER_REQUIRED');
const out = resolve(`docs/franchise-completion/evidence/browser/auth-outage-${pin.commit.slice(0, 7)}`); await mkdir(out, { recursive: true });
const proof = { scope: 'NATIVE_IDENTITY_OUTAGE_HTTP_503_WITHOUT_PROTECTED_CONTENT_OR_FORCED_LOGOUT', candidate: pin.commit, appTree: pin.appTree, status: 'RUNNING', sqlChanged: false, rlsChanged: false, steps: [] };
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const context = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' }); await context.addCookies(native.cookies);
const page = await context.newPage(), origin = `http://127.0.0.1:${state.appPort}`, scope = new URLSearchParams({ organizationId: owner.organizationId, franchiseId: mandate.activation.franchiseId });
let stopped = false;
try {
  await page.goto(`${origin}/fr/franchise/accueil?${scope}`, { waitUntil: 'networkidle', timeout: 90000 });
  await expect(page.locator('[data-workspace-failure]')).toHaveCount(0);
  const before = await context.cookies(origin);
  docker(['stop', '--time', '5', name]); stopped = true;
  for (const locale of ['fr', 'ar']) {
    const target = `${origin}/${locale}/franchise/accueil?${scope}`;
    const response = await page.goto(target, { waitUntil: 'networkidle', timeout: 90000 });
    if (response.status() !== 503 || new URL(page.url()).pathname !== `/${locale}/franchise/accueil`) throw Error('AUTH_OUTAGE_MUST_REWRITE_503_WITHOUT_LOGIN_REDIRECT');
    const headers = response.headers(); if (!headers['cache-control']?.includes('no-store') || headers['retry-after'] !== '5') throw Error('IDENTITY_OUTAGE_MUST_BE_PRIVATE_NONCACHED_AND_RETRYABLE');
    await expect(page.locator('[data-workspace-failure="UNAVAILABLE"]')).toBeVisible();
    await expect(page.locator('.franchise-home, .franchise-command-center, .franchise-kpi-tile')).toHaveCount(0);
    const cookies = await context.cookies(origin);
    if (!before.filter(value => value.name.startsWith('sb-')).every(value => cookies.some(current => current.name === value.name && current.value === value.value))) throw Error('IDENTITY_OUTAGE_MUST_NOT_CLEAR_NATIVE_SESSION_COOKIES');
    const retry = page.locator('[data-workspace-failure] a').filter({ hasText: locale === 'fr' ? 'Réessayer' : 'إعادة' }).first();
    await expect(retry).toBeVisible(); if (new URL(await retry.getAttribute('href'), origin).pathname !== `/${locale}/franchise/accueil`) throw Error('IDENTITY_OUTAGE_RETRY_MUST_KEEP_EXACT_ROLE_TARGET');
    proof.steps.push({ id: `AUTH_OUTAGE_503_${locale}`, status: 'PASS', privateNoStore: true, retryAfterSeconds: 5, protectedContentNotRendered: true, nativeSessionCookiesPreserved: true });
    await page.screenshot({ path: resolve(out, `identity-unavailable-${locale}-390.png`), fullPage: true });
  }
  docker(['start', name]); stopped = false;
  await expect.poll(async () => { try { return (await fetch(`http://127.0.0.1:${state.gatewayPort}/auth/v1/health`, { headers: { apikey: state.anonKey } })).status; } catch { return 0; } }, { timeout: 30000 }).toBe(200);
  await page.locator('[data-workspace-failure] a').filter({ hasText: 'إعادة' }).first().click();
  await page.waitForLoadState('networkidle'); await expect(page.locator('[data-workspace-failure]')).toHaveCount(0);
  if (new URL(page.url()).pathname !== '/ar/franchise/accueil') throw Error('RESTORED_IDENTITY_MUST_RECOVER_SAME_AUTHORIZED_TARGET');
  proof.steps.push({ id: 'REAL_AUTH_RECOVERY_SAME_NATIVE_SESSION', status: 'PASS' }); proof.status = 'PASSED';
  await page.screenshot({ path: resolve(out, 'identity-recovered-ar-390.png'), fullPage: true });
} catch (error) {
  proof.status = 'FAILED'; proof.failure = String(error).replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/gu, '[REDACTED]').slice(0, 1400); process.exitCode = 1;
} finally {
  if (stopped) { try { docker(['start', name]); proof.containerRestartedFinally = true; } catch { proof.containerRestartedFinally = false; process.exitCode = 1; } }
  await context.close(); await browser.close(); await writeFile(resolve(out, 'summary.json'), JSON.stringify(proof, null, 2) + '\n'); console.log(JSON.stringify(proof));
}

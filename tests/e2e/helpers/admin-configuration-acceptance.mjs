import { createRequire } from 'node:module';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { totp } from '../../../scripts/p05-e2e/totp.mjs';

// Explicit, owned local Auth/REST/database fixture only. Provider credentials are
// synthetic and no provider connection test or external operation is requested.
process.umask(0o077);
const args = process.argv.slice(2), options = {};
for (let n = 0; n < args.length; n += 2) {
  if (!['--root', '--runtime'].includes(args[n]) || !args[n + 1] || options[args[n]]) throw Error('LOCAL_ACCEPTANCE_ARGUMENTS_INVALID');
  options[args[n]] = args[n + 1];
}
const root = resolve(options['--root'] ?? resolve(dirname(fileURLToPath(import.meta.url)), '../../..'));
const runtimePath = resolve(options['--runtime'] ?? resolve(root, 'work/admin-configuration-native/runtime.private.json'));
const config = JSON.parse(await readFile(runtimePath, 'utf8'));
function localEndpoint(raw, port) { const u = new URL(raw); return u.protocol === 'http:' && u.hostname === '127.0.0.1' && u.port === String(port) && !u.username && !u.password && !u.search && !u.hash; }
const databaseUrl = new URL(config.databaseUrl);
if (!localEndpoint(config.baseUrl, 5183) || !localEndpoint(config.supabaseUrl, 55419) || databaseUrl.hostname !== '127.0.0.1' || databaseUrl.port !== '55322' || !/^\/matricia_admin_configuration_browser_[0-9]+$/u.test(databaseUrl.pathname) || config.database !== databaseUrl.pathname.slice(1)) throw Error('EXPLICIT_OWNED_LOCAL_CONFIGURATION_STACK_REQUIRED');
const require = createRequire(resolve(root, 'package.json')), webRequire = createRequire(resolve(root, 'apps/web/package.json'));
const { createClient } = webRequire('@supabase/supabase-js'), { createServerClient } = webRequire('@supabase/ssr');
const { chromium, expect } = require('@playwright/test'), { default: AxeBuilder } = require('@axe-core/playwright'), postgres = require('postgres');
const db = postgres(config.databaseUrl, { ssl: false, max: 1, onnotice: () => {} });
const service = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const runId = randomUUID(), directory = resolve(root, 'work/admin-configuration-native', runId);
await mkdir(directory, { recursive: true, mode: 0o700 });
const proof = { schemaVersion: 1, scope: 'OWNED_LOCAL_NATIVE_ADMIN_CONFIGURATION', runId, status: 'RUNNING', startedAt: new Date().toISOString(), roleBootstrap: 'TEST_FIXTURE_ONLY_NOT_GOVERNED_ROLE_ASSIGNMENT_PROOF', externalProviderOperations: 0, productionMutations: 0, checks: [], browser: [], cleanup: { verified: false }, provenance: { commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), helperSha256: createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex'), buildId: (await readFile(resolve(root, 'apps/web/.next/BUILD_ID'), 'utf8')).trim() } };
const actors = [], contexts = [], knownSecrets = new Set(), pendingResponses = [], responseLeaks = [], pageErrors = [];
let browser, stage = 'SETUP', companyRevision, resendRevision, first, second;
function check(condition, code) { if (!condition) throw Error(code); }
function record(code, extra = {}) { proof.checks.push({ code, status: 'PASS', ...extra }); console.log(JSON.stringify({ code, status: 'PASS' })); }
async function rpc(client, name, args = {}) { const result = await client.rpc(name, args); if (result.error) { proof.rpcFailure = { operation: name, code: result.error.code ?? null, status: result.status }; throw Error('NATIVE_RPC_FAILED'); } return result.data; }
async function actor(label, aal2) {
  const email = `configuration-${label}-${runId}@example.invalid`;
  const created = await service.auth.admin.createUser({ email, email_confirm: true, app_metadata: { configuration_acceptance_fixture: runId } });
  check(!created.error && created.data.user, 'NATIVE_FIXTURE_USER_CREATE_FAILED');
  const person = { userId: created.data.user.id, client: createClient(config.supabaseUrl, config.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } }) }; actors.push(person);
  const link = await service.auth.admin.generateLink({ type: 'magiclink', email }); check(!link.error, 'NATIVE_FIXTURE_LINK_FAILED');
  const signed = await person.client.auth.verifyOtp({ type: 'magiclink', token_hash: link.data.properties.hashed_token }); check(!signed.error, 'NATIVE_FIXTURE_LOGIN_FAILED');
  if (aal2) {
    const enrolled = await person.client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Local configuration acceptance' }); check(!enrolled.error, 'NATIVE_FIXTURE_TOTP_ENROLL_FAILED');
    let verified = false;
    for (const offset of [0, -30000, 30000]) { const result = await person.client.auth.mfa.challengeAndVerify({ factorId: enrolled.data.id, code: totp(enrolled.data.totp.secret, Date.now() + offset) }); if (!result.error) { verified = true; break; } }
    check(verified, 'NATIVE_FIXTURE_TOTP_VERIFY_FAILED');
  }
  const assurance = await person.client.auth.mfa.getAuthenticatorAssuranceLevel(); check(assurance.data?.currentLevel === (aal2 ? 'aal2' : 'aal1'), 'NATIVE_FIXTURE_ASSURANCE_WRONG');
  return person;
}
async function browserFor(person, width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' }); contexts.push(context);
  const bag = new Map(), ssr = createServerClient(config.supabaseUrl, config.publishableKey, { cookies: { getAll: () => [...bag.values()], setAll: rows => rows.forEach(row => bag.set(row.name, row)) } });
  const session = await person.client.auth.getSession(); check(session.data.session && !(await ssr.auth.setSession(session.data.session)).error, 'NATIVE_SSR_SESSION_FAILED');
  await context.addCookies([...bag.values()].map(cookie => ({ name: cookie.name, value: cookie.value, url: config.baseUrl, httpOnly: false, secure: false, sameSite: 'Lax' })));
  await context.route('**/*', route => route.request().headers()['next-router-prefetch'] !== undefined ? route.abort() : route.continue());
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', () => pageErrors.push('BROWSER_JAVASCRIPT_ERROR'));
  page.on('response', response => {
    if (!response.url().startsWith(config.baseUrl) || !['document', 'fetch', 'xhr'].includes(response.request().resourceType())) return;
    pendingResponses.push((async () => { try { const text = await response.text(); for (const secret of knownSecrets) if (text.includes(secret)) responseLeaks.push('SECRET_IN_BROWSER_RESPONSE'); } catch {} })());
  });
  return { context, page };
}
async function openConfiguration(page, locale = 'fr') {
  const response = await page.goto(`${config.baseUrl}/${locale}/administration/configuration`, { waitUntil: 'networkidle', timeout: 45000 });
  check(response?.status() === 200 && new URL(page.url()).pathname === `/${locale}/administration/configuration`, 'CONFIGURATION_PAGE_NOT_OPENED');
  await expect(page.locator('#form-save-COMPANY')).toBeVisible();
}
async function latestOwnRevision(section, person) {
  const data = await rpc(person.client, 'get_admin_configuration_v1');
  return data.sections.find(row => row.section === section)?.revisions.find(row => row.created_by === person.userId && row.id === data.sections.find(item => item.section === section)?.latest_revision_id);
}
async function awaitRevision(section, person) { let revision; await expect.poll(async () => { revision = await latestOwnRevision(section, person); return revision?.status ?? null; }, { timeout: 15000 }).toBe('DRAFT'); return revision; }
async function companyStatus(id) { const [row] = await db`select status,settings,approved_by,encrypted_secrets from private.admin_configuration_revisions_v1 where id=${id}::uuid`; return row; }
try {
  const [identity] = await db`select current_database() as database,(select environment from private.admin_execution_environment_v1 where singleton) as environment,to_regclass('private.admin_configuration_revisions_v1') is not null as configuration_installed`;
  check(identity.database === config.database && ['DEVELOPMENT', 'STAGING'].includes(identity.environment) && identity.configuration_installed, 'OWNED_CONFIGURATION_SCHEMA_NOT_READY');
  proof.provenance.environment = identity.environment;
  first = await actor('first', true); second = await actor('second', true); const ordinary = await actor('ordinary', false), aal1Admin = await actor('aal1-admin', false);
  await db`insert into public.platform_user_roles(user_id,role_code)values(${first.userId}::uuid,'SUPER_ADMIN'),(${second.userId}::uuid,'SUPER_ADMIN'),(${aal1Admin.userId}::uuid,'SUPER_ADMIN')`;
  record('REAL_GOTRUE_MAGICLINK_AND_TOTP', { aal2Administrators: 2, aal1Administrator: 1, ordinaryAal1: 1 });
  stage = 'DENY_RPC';
  for (const person of [ordinary, aal1Admin]) { const result = await person.client.rpc('get_admin_configuration_v1'); check(result.error?.code === '42501', 'NON_PRIVILEGED_CONFIGURATION_READ_NOT_DENIED'); }
  record('ORDINARY_AND_AAL1_ADMIN_READ_DENIED');
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch(executablePath ? { executablePath } : {});
  const owner = await browserFor(first), reviewer = await browserFor(second);
  stage = 'COMPANY_NATIVE_SAVE'; await openConfiguration(owner.page);
  const companyForm = owner.page.locator('#form-save-COMPANY');
  const company = { legalName: `Recette configuration ${runId}`, displayName: `Livraison ${runId.slice(0, 8)}`, address: '10 rue de la recette locale', city: 'Casablanca', country: 'MA', currency: 'MAD', supportEmail: 'support@example.invalid', defaultLocale: 'fr', timezone: 'Africa/Casablanca' };
  for (const [key, value] of Object.entries(company)) { const field = companyForm.locator(`[name="settings:${key}"]`); if (key === 'defaultLocale') await field.selectOption(value); else await field.fill(value); }
  await companyForm.getByRole('button', { name: 'Enregistrer pour approbation', exact: true }).click();
  companyRevision = await awaitRevision('COMPANY', first);
  const storedDraft = await companyStatus(companyRevision.id); check(storedDraft.status === 'DRAFT' && storedDraft.settings.legalName === company.legalName && storedDraft.encrypted_secrets === '', 'COMPANY_DRAFT_NOT_PERSISTED');
  record('COMPANY_UI_SAVE_NATIVE_READBACK');
  stage = 'SELF_APPROVAL_DENY';
  const ownDecision = await first.client.rpc('approve_admin_configuration_v1', { p_revision_id: companyRevision.id, p_expected_hash: companyRevision.content_hash, p_approve: true, p_reason: 'Auto approbation locale interdite', p_idempotency_key: randomUUID() });
  check(ownDecision.error?.code === '42501' && (await companyStatus(companyRevision.id)).status === 'DRAFT', 'COMPANY_SELF_APPROVAL_NOT_DENIED');
  await expect(owner.page.locator(`#form-review-${companyRevision.id} button[value="approve"]`)).toHaveCount(0);
  record('SELF_APPROVAL_DENIED_WITH_DRAFT_UNCHANGED');
  stage = 'INDEPENDENT_UI_ACTIVATION'; await openConfiguration(reviewer.page);
  const review = reviewer.page.locator(`#form-review-${companyRevision.id}`);
  await review.locator('textarea[name="reason"]').fill('Revue indépendante de la configuration locale'); await review.locator('input[name="reviewConfirmed"]').check(); await review.locator('button[value="approve"]').click();
  await expect.poll(async () => (await companyStatus(companyRevision.id)).status).toBe('ACTIVE');
  const active = await companyStatus(companyRevision.id); check(active.approved_by === second.userId, 'INDEPENDENT_ACTOR_NOT_PERSISTED');
  await owner.page.reload({ waitUntil: 'networkidle' });
  await expect(owner.page.locator('#configuration-COMPANY-legalName')).toHaveValue(company.legalName);
  await expect(owner.page.locator('progress')).toHaveAttribute('value', '1');
  record('INDEPENDENT_COMPANY_UI_ACTIVATION_AND_RELOAD_PERSISTENCE');
  stage = 'FAILED_PROVIDER_FORM_RETENTION';
  const apiKey = `re_${randomBytes(24).toString('hex')}`, webhookKey = `whsec_${randomBytes(24).toString('hex')}`; knownSecrets.add(apiKey); knownSecrets.add(webhookKey);
  const emailForm = owner.page.locator('#form-save-RESEND');
  await emailForm.locator('[name="settings:RESEND_FROM_EMAIL"]').fill('support@example.invalid'); await emailForm.locator('[name="settings:RESEND_FROM_NAME"]').fill('Nonsecret retained');
  await emailForm.locator('[name="settings:EMAIL_RECIPIENT_ALLOWLIST"]').fill('not-an-email');
  await emailForm.locator('[name="secret:RESEND_API_KEY"]').fill(apiKey); await emailForm.locator('[name="secret:RESEND_WEBHOOK_SECRET"]').fill(webhookKey);
  await emailForm.getByRole('button', { name: 'Enregistrer pour approbation', exact: true }).click();
  await expect(owner.page.locator('#form-save-RESEND-notice')).toContainText('Vérifiez les champs');
  await expect(emailForm.locator('[name="settings:RESEND_FROM_NAME"]')).toHaveValue('Nonsecret retained'); await expect(emailForm.locator('[name="settings:EMAIL_RECIPIENT_ALLOWLIST"]')).toHaveValue('not-an-email');
  await expect(emailForm.locator('[name="secret:RESEND_API_KEY"]')).toHaveValue(''); await expect(emailForm.locator('[name="secret:RESEND_WEBHOOK_SECRET"]')).toHaveValue('');
  record('FAILED_SERVER_VALIDATION_PRESERVES_NONSECRET_AND_CLEARS_SECRETS');
  stage = 'SEALED_PROVIDER_UI_SAVE';
  await emailForm.locator('[name="settings:EMAIL_RECIPIENT_ALLOWLIST"]').fill('@example.invalid'); await emailForm.locator('[name="secret:RESEND_API_KEY"]').fill(apiKey); await emailForm.locator('[name="secret:RESEND_WEBHOOK_SECRET"]').fill(webhookKey);
  await emailForm.getByRole('button', { name: 'Enregistrer pour approbation', exact: true }).click(); resendRevision = await awaitRevision('RESEND', first);
  const [sealed] = await db`select encrypted_secrets,status from private.admin_configuration_revisions_v1 where id=${resendRevision.id}::uuid`;
  check(sealed.status === 'DRAFT' && sealed.encrypted_secrets.length > 32 && !sealed.encrypted_secrets.includes(apiKey) && !sealed.encrypted_secrets.includes(webhookKey), 'SAVED_PROVIDER_SECRETS_NOT_SEALED');
  await expect(owner.page.locator('[name="secret:RESEND_API_KEY"]')).toHaveValue('');
  record('PROVIDER_UI_SAVE_SEALED_WITHOUT_EXTERNAL_OPERATION');
  stage = 'BROWSER_ACCESS_DENIAL';
  for (const [label, person] of [['ordinary', ordinary], ['aal1-admin', aal1Admin]]) {
    const denied = await browserFor(person, 360); await denied.page.goto(`${config.baseUrl}/fr/administration/configuration`, { waitUntil: 'networkidle', timeout: 45000 });
    check(await denied.page.locator('#form-save-COMPANY').count() === 0 && !(await denied.page.content()).includes(company.legalName), 'FORBIDDEN_BROWSER_CONFIGURATION_LEAK');
    record('BROWSER_CONFIGURATION_ACCESS_DENIED', { actor: label }); await denied.context.close();
  }
  stage = 'LOCALIZED_BROWSER_MATRIX';
  for (const locale of ['fr', 'ar']) for (const width of [360, 1440]) {
    const current = await browserFor(second, width); await openConfiguration(current.page, locale);
    check(await current.page.locator('html').getAttribute('dir') === (locale === 'ar' ? 'rtl' : 'ltr'), 'CONFIGURATION_DIRECTION_WRONG');
    check(await current.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'CONFIGURATION_VIEWPORT_OVERFLOW');
    await current.page.locator('a[href="#configuration-step-review"]').focus(); await current.page.keyboard.press('Enter');
    await expect(current.page).toHaveURL(url => url.hash === '#configuration-step-review');
    const audit = await new AxeBuilder({ page: current.page }).analyze();
    proof.browser.push({ locale, width, axeViolations: audit.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })), axeIncomplete: audit.incomplete.map(v => ({ id: v.id, nodes: v.nodes.length })), keyboardStepNavigation: true, overflow: false });
    check(audit.violations.length === 0, 'CONFIGURATION_ACCESSIBILITY_VIOLATION');
    await current.page.screenshot({ path: resolve(directory, `configuration-${locale}-${width}.png`), fullPage: true });
    const html = await current.page.content(); for (const secret of knownSecrets) check(!html.includes(secret), 'SAVED_SECRET_IN_BROWSER_DOM');
    await current.context.close();
  }
  record('FR_AR_360_1440_NATIVE_A11Y_AND_KEYBOARD', { pages: 4, violations: 0 });
  await Promise.allSettled(pendingResponses); check(responseLeaks.length === 0, 'SAVED_SECRET_IN_BROWSER_RSC'); check(pageErrors.length === 0, 'CONFIGURATION_JAVASCRIPT_ERROR');
  record('SAVED_SECRETS_ABSENT_FROM_DOM_AND_SERVER_RESPONSES');
  stage = 'UI_DISABLE_AND_REJECT_FIXTURES';
  await openConfiguration(reviewer.page);
  const disable = reviewer.page.locator(`#form-review-${companyRevision.id}`); await disable.locator('textarea[name="reason"]').fill('Fin de la recette locale de configuration'); await disable.locator('button[value="disable"]').click();
  await expect.poll(async () => (await companyStatus(companyRevision.id)).status).toBe('RETIRED');
  const rejected = await rpc(second.client, 'approve_admin_configuration_v1', { p_revision_id: resendRevision.id, p_expected_hash: resendRevision.content_hash, p_approve: false, p_reason: 'Clés synthétiques de recette, jamais activées', p_idempotency_key: randomUUID() });
  check(rejected.outcome === 'CONFIGURATION_REJECTED', 'FIXTURE_PROVIDER_REJECTION_FAILED');
  record('ACTUAL_UI_DEACTIVATION_AND_PROVIDER_DRAFT_REJECTION'); proof.status = 'PASSED';
} catch (error) {
  proof.status = 'FAILED'; proof.failureStage = stage;
  proof.failure = /^[A-Z][A-Z0-9_]{2,100}$/u.test(error?.message ?? '') ? error.message : 'BROWSER_OR_NATIVE_EXPECTATION_FAILED';
  process.exitCode = 1;
} finally {
  const failures = [];
  if (browser) await browser.close().catch(() => failures.push('BROWSER_CLOSE_FAILED'));
  try {
    if (first && second) {
      for (const revision of [companyRevision, resendRevision].filter(Boolean)) {
        const [current] = await db`select status,section,content_hash from private.admin_configuration_revisions_v1 where id=${revision.id}::uuid`;
        if (current?.status === 'ACTIVE') await rpc(second.client, 'deactivate_admin_configuration_v1', { p_section: current.section, p_expected_active_id: revision.id, p_reason: 'Nettoyage contrôlé de la recette locale', p_idempotency_key: randomUUID() });
        else if (current?.status === 'DRAFT') await rpc(second.client, 'approve_admin_configuration_v1', { p_revision_id: revision.id, p_expected_hash: current.content_hash, p_approve: false, p_reason: 'Nettoyage contrôlé de la recette locale', p_idempotency_key: randomUUID() });
      }
    }
  } catch { failures.push('FIXTURE_REVISION_NEUTRALIZATION_FAILED'); }
  const userIds = actors.map(p => p.userId);
  try { if (userIds.length) await db`delete from public.platform_user_roles where user_id=any(${userIds}::uuid[])`; } catch { failures.push('FIXTURE_ROLE_CLEANUP_FAILED'); }
  for (const person of actors) {
    await person.client.auth.signOut({ scope: 'global' }).catch(() => {});
    const factors = await service.auth.admin.mfa.listFactors({ userId: person.userId });
    if (factors.error) failures.push('FIXTURE_FACTOR_LIST_FAILED');
    else for (const factor of factors.data.factors) if ((await service.auth.admin.mfa.deleteFactor({ userId: person.userId, id: factor.id })).error) failures.push('FIXTURE_FACTOR_DELETE_FAILED');
    if ((await service.auth.admin.deleteUser(person.userId, true)).error) failures.push('FIXTURE_USER_SOFT_DELETE_FAILED');
  }
  try {
    if (userIds.length) {
      const [remaining] = await db`select (select count(*) from public.platform_user_roles where user_id=any(${userIds}::uuid[]))::int as roles,(select count(*) from auth.sessions where user_id=any(${userIds}::uuid[]))::int as sessions,(select count(*) from private.admin_configuration_revisions_v1 where created_by=any(${userIds}::uuid[]) and status in('DRAFT','ACTIVE'))::int as unneutralized_revisions`;
      check(Object.values(remaining).every(count => count === 0), 'FIXTURE_CLEANUP_INCOMPLETE');
    }
  } catch { failures.push('FIXTURE_CLEANUP_VERIFICATION_FAILED'); }
  proof.cleanup = { verified: failures.length === 0, failures: [...new Set(failures)], actors: actors.length, immutableConfigurationHistoryRetainedInOwnedDatabase: true, authTokensPersisted: false };
  if (failures.length) { proof.status = 'FAILED'; process.exitCode = 1; }
  await db.end({ timeout: 5 }); proof.completedAt = new Date().toISOString();
  await writeFile(resolve(directory, 'receipt.json'), `${JSON.stringify(proof, null, 2)}\n`, { mode: 0o600 });
  await writeFile(resolve(root, 'work/admin-configuration-native/latest-receipt.json'), `${JSON.stringify(proof, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ status: proof.status, checks: proof.checks.length, browserPages: proof.browser.length, cleanupVerified: proof.cleanup.verified, failureStage: proof.failureStage ?? null, failure: proof.failure ?? null, receipt: resolve(directory, 'receipt.json') }));
}

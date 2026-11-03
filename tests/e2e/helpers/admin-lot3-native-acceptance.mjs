import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { loadSafeConfiguration, resolveExpectedDatabaseUrl } from '../../../scripts/p05-e2e/environment.mjs';
import { totp } from '../../../scripts/p05-e2e/totp.mjs';
import { commandCenterReadSchemas } from '../../../apps/web/modules/admin/data/command-center/read-schemas.ts';
import { finalizeAdminAcceptance } from '../../../scripts/p05-e2e/admin-acceptance-result.mjs';

process.umask(0o077);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(resolve(root, 'package.json'));
const webRequire = createRequire(resolve(root, 'apps/web/package.json'));
const { createClient } = webRequire('@supabase/supabase-js');
const { createServerClient } = webRequire('@supabase/ssr');
const { chromium, expect } = require('@playwright/test');
const postgres = require('postgres');
const config = await loadSafeConfiguration(root);
if (config.runtimeMode !== 'isolated-local-docker' || !config.localDockerVerified) throw Error('VERIFIED_LOCAL_TEST_ENVIRONMENT_REQUIRED');
const runId = randomUUID();
const directory = resolve(root, 'work/admin-lot3-native', runId);
await mkdir(directory, { recursive: true });
const db = postgres(resolveExpectedDatabaseUrl(config), { ssl: false, max: 1, onnotice: () => {} });
const service = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const users = [], organizations = [], workIds = [], actionIds = [], contexts = [];
const proof = { scope: 'LOCAL_NATIVE_ADMIN_AAL2_LOT3', runId, status: 'RUNNING', bootstrap: 'LOCAL_FIXTURE_ROLES_ONLY_NOT_GOVERNED_ASSIGNMENT_PROOF', checks: [], cleanup: { verified: false }, provenance: { commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), appTree: execFileSync('git', ['rev-parse', 'HEAD:apps/web'], { cwd: root, encoding: 'utf8' }).trim(), buildId: (await readFile(resolve(root, 'apps/web/.next/BUILD_ID'), 'utf8')).trim(), harnessSha256: createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex') } };
let activePage;
let server, browser, stage = 'SETUP';
const check = (value, code) => { if (!value) throw Error(code); };
const record = (code, details = {}) => { proof.checks.push({ code, status: 'PASS', ...details }); console.log(JSON.stringify({ code, status: 'PASS' })); };
async function rpc(client, name, args) {
  const result = await client.rpc(name, args);
  if (result.error) { proof.rpcFailure = { operation: name, code: result.error.code ?? null, status: result.status }; throw Error('NATIVE_RPC_FAILED'); }
  return result.data;
}
async function actor(label, aal2 = true) {
  stage = `ACTOR_${label}`;
  const email = `lot3-${label}-${runId}@example.invalid`;
  const created = await service.auth.admin.createUser({ email, email_confirm: true, app_metadata: { admin_lot3_fixture: runId } });
  check(!created.error && created.data.user, 'FIXTURE_USER_CREATION_FAILED');
  const userId = created.data.user.id; users.push(userId);
  const link = await service.auth.admin.generateLink({ type: 'magiclink', email });
  check(!link.error, 'FIXTURE_LINK_FAILED');
  const client = createClient(config.supabaseUrl, config.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await client.auth.verifyOtp({ type: 'magiclink', token_hash: link.data.properties.hashed_token });
  check(!login.error, 'FIXTURE_NATIVE_LOGIN_FAILED');
  if (aal2) {
    const factor = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Admin lot 3 local acceptance' });
    if (factor.error) { proof.setupError = { step: stage, code: factor.error.code ?? 'UNKNOWN', status: factor.error.status ?? null }; throw Error('FIXTURE_MFA_ENROLL_FAILED'); }
    let verified = false;
    for (const offset of [0, -30000, 30000]) if (!(await client.auth.mfa.challengeAndVerify({ factorId: factor.data.id, code: totp(factor.data.totp.secret, Date.now() + offset) })).error) { verified = true; break; }
    check(verified, 'FIXTURE_MFA_VERIFY_FAILED');
  }
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  check(assurance.data?.currentLevel === (aal2 ? 'aal2' : 'aal1'), 'FIXTURE_ASSURANCE_LEVEL_WRONG');
  return { client, userId };
}
async function contextFor(person, locale, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' }); contexts.push(context);
  if (person) {
    const bag = new Map();
    const ssr = createServerClient(config.supabaseUrl, config.publishableKey, { cookies: { getAll: () => [...bag.values()], setAll: items => items.forEach(item => bag.set(item.name, item)) } });
    const session = await person.client.auth.getSession();
    check(!(await ssr.auth.setSession(session.data.session)).error, 'FIXTURE_SSR_SESSION_FAILED');
    await context.addCookies([...bag.values()].map(cookie => ({ name: cookie.name, value: cookie.value, url: config.baseUrl, httpOnly: false, secure: false, sameSite: 'Lax' })));
  }
  await context.route('**/*', route => route.request().headers()['next-router-prefetch'] !== undefined ? route.abort() : route.continue());
  const page = await context.newPage(); activePage = page; page.setDefaultTimeout(15000);
  return { context, page };
}
async function workRow(id) { const [row] = await db`select status,row_version,assigned_to from public.admin_work_items where id=${id}::uuid`; return row; }
async function startServer() {
  // Own the server process: a stale server on the same port is an error.
  const log = openSync(resolve(directory, 'server.private.log'), 'a', 0o600);
  server = spawn(process.execPath, [resolve(root, 'apps/web/node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '5173'], { cwd: resolve(root, 'apps/web'), env: { ...process.env, APP_ENV: 'development', NEXT_PUBLIC_APP_URL: 'https://localhost:5173', NEXT_PUBLIC_SUPABASE_URL: config.supabaseUrl, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: config.publishableKey, SUPABASE_SERVICE_ROLE_KEY: config.serviceRoleKey, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', log, log] }); closeSync(log);
  for (let attempt = 0; attempt < 60; attempt++) {
    check(server.exitCode === null, 'OWNED_SERVER_START_FAILED');
    try { const result = await fetch(`${config.baseUrl}/robots.txt`, { signal: AbortSignal.timeout(1500) }); await result.body?.cancel(); if (result.ok) { await delay(200); check(server.exitCode === null, 'OWNED_SERVER_START_FAILED'); proof.provenance.ownedServer = true; return; } } catch {}
    await delay(500);
  }
  throw Error('OWNED_SERVER_NOT_READY');
}
try {
  const [schema] = await db`select count(*)::int as migration_count,md5(string_agg(version,',' order by version)) as version_fingerprint from supabase_migrations.schema_migrations`;
  proof.provenance.localSchema = schema; proof.provenance.cleanReplayCertified = false;
  const first = await actor('admin-one'), second = await actor('admin-two'), ordinary = await actor('ordinary'), aal1 = await actor('admin-aal1', false);
  await db`insert into public.platform_user_roles(user_id,role_code)values(${first.userId}::uuid,'MATRICIA_ADMIN'),(${second.userId}::uuid,'MATRICIA_ADMIN'),(${aal1.userId}::uuid,'MATRICIA_ADMIN')`;
  const organization = await rpc(ordinary.client, 'create_or_request_organization', { p_legal_name: `Lot 3 ${runId}`, p_display_name: `Lot 3 ${runId}`, p_ice: String(BigInt('0x' + randomBytes(6).toString('hex'))).padStart(15, '0'), p_owner_role: 'CLIENT_OWNER', p_idempotency_key: randomUUID(), p_correlation_id: randomUUID() });
  check(organization.organization_id, 'FIXTURE_ORGANIZATION_FAILED'); organizations.push(organization.organization_id);
  const org = organizations[0];
  record('REAL_GOTRUE_IDENTITIES_AND_TOTP', { aal2Actors: 3, aal1Actors: 1 });
  stage = 'NATIVE_RPC_GUARDS';
  const anonymous = createClient(config.supabaseUrl, config.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const projection = await rpc(first.client, 'list_admin_supervision_page_v1', { p_limit: 100, p_offset: 0 });
  check(Array.isArray(projection.organizations), 'ADMIN_PROJECTION_INVALID');
  const opened = await rpc(first.client, 'open_admin_work_item', { p_queue_key: 'EXCEPTIONS', p_organization_id: org, p_source_kind: 'MANUAL_REVIEW', p_resource_type: 'organization', p_resource_id: org, p_title_fr: `Recette Admin ${runId}`, p_title_ar: `اختبار الإدارة ${runId}`, p_priority: 'CRITICAL', p_due_at: new Date(Date.now() + 3600000).toISOString(), p_redacted_context: {}, p_reason: 'Recette locale indépendante des données métier', p_idempotency_key: randomUUID() });
  check(opened.work_item_id, 'FIXTURE_WORK_NOT_OPENED'); workIds.push(opened.work_item_id);
  const workId = workIds[0];
  const action = await rpc(first.client, 'request_admin_operational_action', { p_work_item_id: workId, p_organization_id: org, p_action_type: 'MANUAL_EXCEPTION', p_target_environment: 'DEVELOPMENT', p_resource_type: 'organization', p_resource_id: org, p_request_payload_hash: createHash('sha256').update(runId).digest('hex'), p_redacted_summary: {}, p_reason: 'Recette de refus indépendant sans exécution métier', p_production_authorization_reference: null, p_support_user_id: null, p_support_access_mode: null, p_support_expires_at: null, p_idempotency_key: randomUUID() });
  check(action.action_request_id, 'FIXTURE_ACTION_NOT_REQUESTED'); actionIds.push(action.action_request_id);
  const securityProbe = await first.client.rpc('get_my_account_security_requirement');
  const workProbe = await first.client.from('admin_work_items').select('id,queue_version_id,organization_id,source_kind,resource_type,resource_id,title_fr,title_ar,priority,status,due_at,assigned_to,row_version').in('status',['OPEN','CLAIMED','WAITING_INFORMATION']).order('severity_rank',{ascending:false}).order('due_at').limit(100);
  const actionProbe = await first.client.from('admin_operational_action_requests').select('id,work_item_id,organization_id,action_type,target_environment,resource_type,resource_id,reason,approvals_required,status,requested_by,requested_at,row_version,executed_at,execution_result_hash',{count:'exact'}).order('requested_at',{ascending:false}).order('id').range(0,99);
  const queueProbe = await first.client.from('admin_queue_versions').select('id,queue_key,label_fr,label_ar');
  const validation = Object.entries({workItems:workProbe.data,actions:actionProbe.data,queues:queueProbe.data}).map(([key,value])=>{const parsed=commandCenterReadSchemas[key].safeParse(value);return{part:key,valid:parsed.success,issues:parsed.success?[]:parsed.error.issues.map(issue=>({path:issue.path,code:issue.code}))};});
  proof.commandCenterReadProbe={validation,security:{code:securityProbe.error?.code??null,array:Array.isArray(securityProbe.data),requirements:securityProbe.data?.map?.(row=>({satisfied:row.requirement_satisfied,roles:row.matched_role_codes}))},work:{code:workProbe.error?.code??null,count:workProbe.data?.length??null},actions:{code:actionProbe.error?.code??null,count:actionProbe.data?.length??null},queues:{code:queueProbe.error?.code??null,count:queueProbe.data?.length??null}};
  check(validation.every(part=>part.valid),'COMMAND_CENTER_NATIVE_CONTRACT_FAILED');
  const beyondPage = await first.client.from('admin_operational_action_requests').select('id',{count:'exact'}).range(100,199);
  proof.paginationProbe={code:beyondPage.error?.code??null,status:beyondPage.status};
  check(beyondPage.error?.code === 'PGRST103','PAGINATION_RANGE_REPRODUCTION_FAILED');
  record('PAGINATION_OUT_OF_RANGE_REPRODUCED');
  for (const [label, client] of [['ordinary', ordinary.client], ['admin-aal1', aal1.client], ['anonymous', anonymous]]) {
    const deniedRead = await client.rpc('list_admin_supervision_page_v1', { p_limit: 100, p_offset: 0 });
    check(deniedRead.error?.code === '42501', 'FORBIDDEN_READ_NOT_DENIED');
    for (const [name, args] of [
      ['claim_admin_work_item', { p_work_item_id: workId, p_expected_row_version: 1, p_reason: 'Tentative interdite de recette', p_idempotency_key: randomUUID() }],
      ['resolve_admin_work_item', { p_work_item_id: workId, p_resolution_code: 'COMPLETED', p_reason: 'Tentative interdite de recette', p_evidence: {}, p_expected_row_version: 1, p_idempotency_key: randomUUID() }],
      ['decide_admin_operational_action', { p_action_request_id: actionIds[0], p_decision: 'REJECT', p_reason: 'Tentative interdite de recette', p_expected_row_version: 1, p_idempotency_key: randomUUID() }],
    ]) { const denied = await client.rpc(name, args); check(denied.error?.code === '42501', 'FORBIDDEN_MUTATION_NOT_DENIED'); }
    check((await workRow(workId)).row_version === 1, 'DENIED_MUTATION_CHANGED_VERSION');
    const [unchanged] = await db`select row_version,status from public.admin_operational_action_requests where id=${actionIds[0]}::uuid`;
    check(unchanged.row_version === 1 && unchanged.status === 'PENDING_APPROVAL', 'DENIED_DECISION_CHANGED_STATE');
    record('RPC_READ_AND_THREE_MUTATIONS_DENIED', { actor: label });
  }
  const self = await first.client.rpc('decide_admin_operational_action', { p_action_request_id: actionIds[0], p_decision: 'APPROVE', p_reason: 'Auto approbation interdite', p_expected_row_version: 1, p_idempotency_key: randomUUID() });
  check(self.error?.code === '42501', 'SELF_APPROVAL_NOT_DENIED'); record('SELF_APPROVAL_DENIED');
  await startServer();
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/usr/bin/chromium' });
  for (const locale of ['fr', 'ar']) {
    for (const [label, person] of [['ordinary', ordinary], ['admin-aal1', aal1], ['anonymous', null]]) {
      stage = `BROWSER_DENIAL_${locale}_${label}`;
      const { context, page } = await contextFor(person, locale, 360);
      await page.goto(`${config.baseUrl}/${locale}/administration/command-center`, { waitUntil: 'networkidle', timeout: 30000 });
      const target = new URL(page.url());
      const expected = label === 'anonymous' ? `/${locale}/connexion` : label === 'admin-aal1' ? `/${locale}/securite/compte` : `/${locale}/tableau-de-bord`;
      check(target.pathname === expected, 'FORBIDDEN_BROWSER_TARGET_WRONG');
      if(label === 'admin-aal1') check(target.searchParams.get('workspace') === 'administration' && target.searchParams.get('next') === `/${locale}/administration/command-center`, 'MFA_RETURN_TARGET_WRONG');
      const body = await page.locator('body').innerText();
      check(!body.includes(`Recette Admin ${runId}`) && !body.includes(`اختبار الإدارة ${runId}`), 'FORBIDDEN_BROWSER_LEAKED_ADMIN_TASK');
      record('BROWSER_ACCESS_DENIED', { locale, actor: label, target: new URL(page.url()).pathname }); await context.close();
    }
  }
  for (const [locale, width] of [['fr', 360], ['ar', 1280]]) {
    stage = `BROWSER_WORK_${locale}`;
    const currentWork = locale === 'fr' ? workId : (await rpc(first.client, 'open_admin_work_item', { p_queue_key: 'EXCEPTIONS', p_organization_id: org, p_source_kind: 'MANUAL_REVIEW', p_resource_type: 'organization', p_resource_id: org + '-ar', p_title_fr: `Recette Admin AR ${runId}`, p_title_ar: `اختبار الإدارة ${runId}`, p_priority: 'CRITICAL', p_due_at: new Date(Date.now() + 3600000).toISOString(), p_redacted_context: {}, p_reason: 'Recette locale arabe sans exécution métier', p_idempotency_key: randomUUID() })).work_item_id;
    if (!workIds.includes(currentWork)) workIds.push(currentWork);
    const { context, page } = await contextFor(first, locale, width);
    await page.goto(`${config.baseUrl}/${locale}/administration/command-center?organizationId=${org}&q=${runId}&actionPage=2`, { waitUntil: 'networkidle', timeout: 30000 });
    stage = `BROWSER_FILTER_${locale}`;
    const filter = page.locator('form[method="get"]').filter({ has: page.locator('select[name="actionStatus"]') });
    await filter.locator('select').selectOption('PENDING_APPROVAL'); await filter.getByRole('button').click();
    await expect(page).toHaveURL(url => url.searchParams.get('organizationId') === org && url.searchParams.get('q') === runId && !url.searchParams.has('actionPage'));
    record('FILTER_CONTEXT_AND_PAGE_RESET', { locale, width });
    stage = `BROWSER_CLAIM_${locale}`;
    const card = page.locator(`[id="work-${currentWork}"]`);
    await expect(card).toBeVisible();
    const claim = card.locator('form').filter({ has: page.locator('button') }).first();
    await claim.locator('input[name="reason"]').fill('Prise en charge native de recette'); await claim.locator('button[type="submit"]').click();
    await expect(card.locator('input[name="expectedRowVersion"]')).toHaveValue('2');
    check((await workRow(currentWork)).status === 'CLAIMED', 'NATIVE_CLAIM_NOT_PERSISTED');
    record('NATIVE_CLAIM_REFRESH_WITHOUT_RELOAD', { locale, width });
    const stale = await first.client.rpc('claim_admin_work_item', { p_work_item_id: currentWork, p_expected_row_version: 1, p_reason: 'Version historique refusée', p_idempotency_key: randomUUID() });
    check(stale.error?.code === '40001', 'STALE_VERSION_NOT_DENIED');
    stage = `BROWSER_RESOLVE_${locale}`;
    const resolveForm = card.locator('form').filter({ has: page.locator('select[name="resolutionCode"]') });
    await resolveForm.locator('select[name="resolutionCode"]').selectOption('COMPLETED');
    await resolveForm.locator('[name="reason"]').fill('Recette terminée sans effet métier distant'); await resolveForm.locator('button[type="submit"]').click();
    await expect(card).toHaveCount(0);
    check((await workRow(currentWork)).status === 'RESOLVED', 'NATIVE_RESOLUTION_NOT_PERSISTED');
    record('NATIVE_RESOLVE_REFRESH_WITHOUT_RELOAD', { locale, width, staleVersionDenied: true }); await context.close();
  }
  stage = 'BROWSER_INDEPENDENT_DECISION';
  const { context, page } = await contextFor(second, 'fr', 1280);
  await page.goto(`${config.baseUrl}/fr/administration/command-center?organizationId=${org}`, { waitUntil: 'networkidle', timeout: 30000 });
  const actionCard = page.locator(`[id="admin-action-${actionIds[0]}"]`);
  await expect(actionCard).toBeVisible(); await actionCard.locator('input[name="reason"]').fill('Refus indépendant de la demande synthétique');
  await actionCard.locator('button[value="REJECT"]').click(); await expect(actionCard.locator('form')).toHaveCount(0);
  const [decided] = await db`select status,row_version from public.admin_operational_action_requests where id=${actionIds[0]}::uuid`;
  check(decided.status === 'REJECTED' && decided.row_version === 2, 'INDEPENDENT_REJECTION_NOT_PERSISTED');
  record('INDEPENDENT_REJECTION_REFRESH_WITHOUT_RELOAD'); await context.close();
  proof.status = 'PASSED';
} catch (error) {
  proof.status = 'FAILED'; proof.failureStage = stage;
  if(activePage && !activePage.isClosed()){
    proof.browserFailure={path:new URL(activePage.url()).pathname,alerts:await activePage.getByRole('alert').allTextContents().catch(()=>[]),getForms:await activePage.locator('form[method="get"]').count().catch(()=>0)};
    await activePage.screenshot({path:resolve(directory,'failure.private.png'),fullPage:true}).catch(()=>{});
    await writeFile(resolve(directory,'failure.private.txt'),error.message).catch(()=>{});
  }
  proof.failure = /^[A-Z][A-Z0-9_]{2,100}$/.test(error.message) ? error.message : 'NATIVE_ACCEPTANCE_UNEXPECTED_ERROR';
  if (error.name === 'TimeoutError' || error.message?.includes('expect(')) proof.failure = 'BROWSER_EXPECTATION_FAILED';
} finally {
  const steps = [
    { code: 'BROWSER_CLOSE_FAILED', run: async () => { if (browser) await browser.close(); } },
    { code: 'SERVER_CLOSE_FAILED', run: async () => { const exited = () => server.exitCode !== null || server.signalCode !== null; if(server && !exited()){ const stopped = new Promise(resolve => server.once('exit',resolve)); server.kill('SIGTERM'); await Promise.race([stopped,delay(5000)]); if(!exited()){server.kill('SIGKILL');await Promise.race([stopped,delay(5000)]);} check(exited(),'SERVER_DID_NOT_EXIT'); } } },
    { code: 'FIXTURE_NEUTRALIZATION_FAILED', run: async () => {
      if (users.length) { const linked = await db`select distinct organization_id from public.organization_memberships where user_id=any(${users}::uuid[])`; for (const row of linked) if (!organizations.includes(row.organization_id)) organizations.push(row.organization_id); }
      await db.begin(async tx => {
        if (users.length) {
          await tx`update public.admin_operational_action_requests set status='CANCELLED',row_version=row_version+1 where requested_by=any(${users}::uuid[]) and status='PENDING_APPROVAL'`;
          await tx`update public.admin_work_items set status='DISMISSED',resolution_code='FIXTURE_CLEANUP',resolution_reason='Local acceptance cleanup',resolution_evidence='{}'::jsonb,row_version=row_version+1 where created_by=any(${users}::uuid[]) and status in ('OPEN','CLAIMED','WAITING_INFORMATION')`;
          await tx`delete from public.platform_user_roles where user_id=any(${users}::uuid[])`;
        }
        if (organizations.length) {
          await tx`update public.event_outbox set dead_lettered_at=coalesce(dead_lettered_at,clock_timestamp()),last_error_code='ADMIN_LOT3_FIXTURE_NEUTRALIZED',locked_at=null,locked_by=null where organization_id=any(${organizations}::uuid[]) and published_at is null`;
          await tx`update public.organization_member_roles r set revoked_at=coalesce(r.revoked_at,clock_timestamp()) from public.organization_memberships m where r.membership_id=m.id and m.organization_id=any(${organizations}::uuid[])`;
          await tx`update public.organization_memberships set status='REVOKED',row_version=row_version+1 where organization_id=any(${organizations}::uuid[])`;
          await tx`update public.organizations set status='ARCHIVED',row_version=row_version+1 where id=any(${organizations}::uuid[])`;
        }
      });
    } },
  ];
  for (const userId of users) {
    steps.push({ code: 'FIXTURE_FACTOR_CLEANUP_FAILED', run: async () => { const factors = await service.auth.admin.mfa.listFactors({ userId }); check(!factors.error, 'FACTOR_LIST_FAILED'); let failed = false; for (const factor of factors.data.factors) if ((await service.auth.admin.mfa.deleteFactor({ userId, id: factor.id })).error) failed = true; check(!failed, 'FACTOR_DELETE_FAILED'); } });
    steps.push({ code: 'FIXTURE_USER_CLEANUP_FAILED', run: async () => { check(!(await service.auth.admin.deleteUser(userId, true)).error, 'USER_DELETE_FAILED'); } });
  }
  steps.push({ code: 'FIXTURE_CLEANUP_VERIFICATION_FAILED', run: async () => {
    const [remaining] = await db`select (select count(*) from public.platform_user_roles where user_id=any(${users}::uuid[]))::int as roles,(select count(*) from auth.sessions where user_id=any(${users}::uuid[]))::int as sessions,(select count(*) from public.organizations where id=any(${organizations}::uuid[]) and status<>'ARCHIVED')::int as organizations,(select count(*) from public.admin_work_items where created_by=any(${users}::uuid[]) and status in ('OPEN','CLAIMED','WAITING_INFORMATION'))::int as open_work,(select count(*) from public.admin_operational_action_requests where requested_by=any(${users}::uuid[]) and status='PENDING_APPROVAL')::int as pending_actions`;
    check(Object.values(remaining).every(value => value === 0), 'FIXTURE_CLEANUP_INCOMPLETE'); proof.cleanup = { verified: true, ownedServerStopped: !server || server.exitCode !== null || server.signalCode !== null, actors: users.length, organizations: organizations.length, remaining, immutableEvidenceRetained: true };
  } });
  steps.push({ code: 'DATABASE_CLOSE_FAILED', run: () => db.end() });
  const passed = await finalizeAdminAcceptance({ proof, steps, persist: result => writeFile(resolve(directory, 'summary.json'), JSON.stringify(result, null, 2) + '\n') });
  if (!passed) process.exitCode = 1;
  console.log(JSON.stringify({ status: proof.status, summary: resolve(directory, 'summary.json'), failure: proof.failure ?? null, failureStage: proof.failureStage ?? null, cleanup: proof.cleanup }));
}

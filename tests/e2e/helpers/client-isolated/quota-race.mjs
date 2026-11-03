import { requireDevelopment, loadOwnState } from './safety.mjs';
requireDevelopment();
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const state = await loadOwnState(), actorsPath = resolve(state.directory, 'actors.private.json'), statePath = resolve(state.directory, 'state.private.json'), fixturePath = resolve(state.directory, 'questionnaire-fixture-provenance.json');
const originalActors = await readFile(actorsPath), originalState = await readFile(statePath), originalFixture = await readFile(fixturePath);
const actors = JSON.parse(originalActors), owner = actors.find(actor => actor.label === 'owner'), foreign = actors.find(actor => actor.label === 'foreign');
const { createClient } = createRequire(resolve('apps/web/package.json'))('@supabase/supabase-js');
const api = `http://127.0.0.1:${state.gatewayPort}`;
const nativeClient = async () => { const client = createClient(api, state.anonKey, { auth: { persistSession: false, autoRefreshToken: false } }); if ((await client.auth.setSession(owner.session)).error) throw new Error('NATIVE_OWNER_SESSION_REQUIRED'); return client; };
const client = await nativeClient(), directory = resolve(state.directory, 'quota-race');
await mkdir(directory, { recursive: true });
const proof = { scope: 'TWO_CONCURRENT_NATIVE_GOTRUE_CLIENT_COMMANDS', candidate: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), status: 'RUNNING', nativeOnboardingCertified: false, physicalScanningCertified: false, trialQuota: { resource: 'SITES', limit: 1, explicitTestOnly: true }, userJwtFabrication: false };
try {
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || assurance.data?.currentLevel !== 'aal2') throw new Error('NATIVE_AAL2_REQUIRED');
  proof.verifiedCurrentLevel = assurance.data.currentLevel;
  const ice = String(BigInt('0x' + randomBytes(6).toString('hex'))).padStart(15, '0');
  const organization = await client.rpc('create_or_request_organization', { p_legal_name: `TEST quota race ${state.token}`, p_display_name: 'TEST quota race', p_ice: ice, p_owner_role: 'CLIENT_OWNER', p_idempotency_key: randomUUID(), p_correlation_id: randomUUID() });
  if (organization.error || !organization.data?.organization_id) throw new Error('NATIVE_RACE_ORGANIZATION_CREATE_FAILED');
  owner.organizationId = organization.data.organization_id; owner.ice = ice;
  await writeFile(actorsPath, JSON.stringify(actors), { mode: 0o600 });
  await writeFile(statePath, JSON.stringify({ ...state, status: 'ACTORS_READY' }), { mode: 0o600 });
  execFileSync(process.execPath, ['tests/e2e/helpers/client-isolated/seed-questionnaire.mjs'], { env: process.env, stdio: 'pipe' });
  proof.organizationId = owner.organizationId;
  const before = await client.from('client_sites').select('id').eq('organization_id', owner.organizationId);
  if (before.error || before.data.length !== 0) throw new Error('FRESH_QUOTA_COHORT_REQUIRED');
  const first = await nativeClient(), second = await nativeClient();
  const command = suffix => ({ p_organization_id: owner.organizationId, p_code: `TEST_RACE_${suffix}`, p_name_fr: `Site concurrent de test ${suffix}`, p_name_ar: `موقع متزامن تجريبي ${suffix}`, p_address_snapshot: { country: 'MA', city: 'TEST', line: 'TEST quota concurrency' }, p_change_reason: 'TEST race at exact cap', p_idempotency_key: randomUUID(), p_correlation_id: randomUUID() });
  const [a, b] = await Promise.all([first.rpc('create_client_site', command('A')), second.rpc('create_client_site', command('B'))]);
  proof.results = [a, b].map((result, index) => ({ request: index + 1, granted: !result.error, code: result.error?.code, message: result.error?.message }));
  if ([a, b].filter(result => !result.error).length !== 1 || [a, b].filter(result => result.error?.code === '54000' && result.error.message === 'SUBSCRIPTION_QUOTA_EXCEEDED').length !== 1) throw new Error('CONCURRENT_QUOTA_GRANT_INCORRECT');
  const persisted = await client.from('client_sites').select('id,code,status').eq('organization_id', owner.organizationId);
  if (persisted.error || persisted.data.length !== 1 || persisted.data[0].status !== 'ACTIVE') throw new Error('CONCURRENT_QUOTA_PERSISTED_COUNT_INCORRECT');
  proof.persistedActiveSites = 1;
  const denied = await client.rpc('create_client_site', { ...command('FOREIGN'), p_organization_id: foreign.organizationId });
  proof.foreignOrganizationDenied = denied.error?.code === '42501';
  if (!proof.foreignOrganizationDenied) throw new Error('FOREIGN_ORGANIZATION_COMMAND_NOT_DENIED');
  proof.status = 'PASSED';
} catch (error) { proof.status = 'FAILED'; proof.failure = error.message.slice(0, 500); process.exitCode = 1; }
finally {
  // Restore selected browser context even after a rejected assertion. New race
  // rows remain solely in this owned disposable database for investigation.
  await writeFile(actorsPath, originalActors, { mode: 0o600 });
  await writeFile(statePath, originalState, { mode: 0o600 });
  await writeFile(fixturePath, originalFixture);
  await writeFile(resolve(directory, 'summary.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify({ status: proof.status, failure: proof.failure, evidence: resolve(directory, 'summary.json') }));
}

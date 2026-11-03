import { requireDevelopment, loadOwnState, docker } from './safety.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { totp } from '../../../../scripts/p05-e2e/totp.mjs';
import { requiredActors } from './plan.mjs';
requireDevelopment();
const state = await loadOwnState(), path = resolve(state.directory, 'actors.private.json');
const resume = process.argv.includes('--resume');
if (!['SERVICES_STARTED', 'ACTORS_PREPARING'].includes(state.status)) throw new Error('FRESH_COORDINATED_PROVIDER_SERVICES_REQUIRED');
let actors = [];
try { actors = JSON.parse(await readFile(path)); if (!resume) throw new Error('PRESERVE_EXISTING_NATIVE_COHORT_USE_EXPLICIT_RESUME'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const { createClient } = createRequire(resolve('apps/web/package.json'))('@supabase/supabase-js');
const origin = `http://127.0.0.1:${state.gatewayPort}`, config = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(origin, state.serviceKey, config), clients = new Map();
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu;
for (const actor of actors) if (!requiredActors.includes(actor.label) || !uuid.test(actor.userId) || actor.email !== `provider-browser-${actor.label}-${state.token}@example.invalid`) throw new Error('OWNED_NATIVE_ACTOR_RECORD_REQUIRED');
async function persist() { await writeFile(path, JSON.stringify(actors), { mode: 0o600 }); }
async function call(client, name, input) { const result = await client.rpc(name, input); if (result.error) throw new Error(`NATIVE_PROVIDER_SETUP_${name}:${result.error.code}`); return result.data; }
state.status = 'ACTORS_PREPARING'; await writeFile(resolve(state.directory, 'state.private.json'), JSON.stringify(state), { mode: 0o600 }); await persist();

for (const label of requiredActors) {
  let actor = actors.find(value => value.label === label);
  const email = `provider-browser-${label}-${state.token}@example.invalid`;
  const client = createClient(origin, state.anonKey, config);
  if (!actor) {
    // Only the exact owned test address may be recovered if user creation's
    // response was lost before its local receipt was written.
    const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (users.error) throw new Error('NATIVE_PROVIDER_TEST_USER_LIST_FAILED');
    const existing = users.data.users.filter(user => user.email === email);
    if (existing.length > 1 || existing.some(user => user.app_metadata?.isolated_browser_fixture !== state.token)) throw new Error('EXACT_OWNED_NATIVE_TEST_USER_REQUIRED');
    const created = existing.length ? { data: { user: existing[0] }, error: null } : await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { locale: 'fr' }, app_metadata: { isolated_browser_fixture: state.token } });
    if (created.error || !created.data.user) throw new Error('NATIVE_PROVIDER_TEST_USER_CREATE_FAILED');
    actor = { label, userId: created.data.user.id, email, session: null, organizationId: null, roles: [], stage: 'USER_CREATED' };
    actors.push(actor); await persist();
  }
  if (!actor.session) {
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    if (link.error || !link.data.properties?.hashed_token) throw new Error('NATIVE_PROVIDER_TEST_OTP_LINK_FAILED');
    const verified = await client.auth.verifyOtp({ type: 'magiclink', token_hash: link.data.properties.hashed_token });
    if (verified.error || !verified.data.session || verified.data.user?.id !== actor.userId) throw new Error('NATIVE_PROVIDER_TEST_OTP_VERIFY_FAILED');
    actor.session = verified.data.session; actor.stage = 'OTP_VERIFIED'; await persist();
  } else if ((await client.auth.setSession(actor.session)).error) throw new Error('EXISTING_NATIVE_PROVIDER_SESSION_MUST_BE_PRESERVED');
  if (actor.stage !== 'AAL2_VERIFIED' && actor.stage !== 'ORGANIZATION_READY' && actor.stage !== 'MEMBERSHIP_READY') {
    if (!actor.mfa) {
      const factor = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Owned Provider browser TEST cohort' });
      if (factor.error || !factor.data.totp?.secret) throw new Error('NATIVE_PROVIDER_TEST_TOTP_ENROLL_FAILED');
      actor.mfa = { factorId: factor.data.id, secret: factor.data.totp.secret }; actor.stage = 'MFA_ENROLLED'; await persist();
    }
    let verified = false;
    for (const offset of [0, -30000, 30000]) {
      if (!(await client.auth.mfa.challengeAndVerify({ factorId: actor.mfa.factorId, code: totp(actor.mfa.secret, Date.now() + offset) })).error) { verified = true; break; }
    }
    if (!verified) throw new Error('NATIVE_PROVIDER_TEST_TOTP_VERIFY_FAILED');
  }
  const user = await client.auth.getUser(), assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (user.error || user.data.user?.id !== actor.userId || assurance.error || assurance.data?.currentLevel !== 'aal2') throw new Error('GENUINE_PROVIDER_ACTOR_AAL2_IDENTITY_REQUIRED');
  actor.session = (await client.auth.getSession()).data.session; actor.stage = 'AAL2_VERIFIED'; await persist();
  if (['provider-owner', 'foreign-provider', 'client-owner'].includes(label) && !actor.organizationId) {
    if (!actor.organizationIntent) {
      actor.ice = String(BigInt('0x' + randomBytes(6).toString('hex'))).padStart(15, '0');
      actor.organizationIntent = { key: randomUUID(), correlation: randomUUID() }; await persist();
    }
    const role = label === 'client-owner' ? 'CLIENT_OWNER' : 'PROVIDER_OWNER';
    const organization = await call(client, 'create_or_request_organization', { p_legal_name: `TEST ONLY ${label} ${state.token}`, p_display_name: `TEST ONLY ${label}`, p_ice: actor.ice, p_owner_role: role, p_idempotency_key: actor.organizationIntent.key, p_correlation_id: actor.organizationIntent.correlation });
    if (!uuid.test(organization?.organization_id ?? '')) throw new Error('NATIVE_PROVIDER_ORGANIZATION_REQUIRED');
    actor.organizationId = organization.organization_id; actor.roles = [role]; actor.stage = 'ORGANIZATION_READY'; await persist();
  }
  clients.set(label, client);
  console.log(JSON.stringify({ status: 'GENUINE_GOTRUE_OTP_TOTP_ACTOR_READY', label, userJwtFabricated: false }));
}

const owner = actors.find(actor => actor.label === 'provider-owner'), ownerClient = clients.get('provider-owner');
const members = [
  ['provider-manager', ['PROVIDER_MANAGER']], ['provider-accounting', ['PROVIDER_ACCOUNTING']],
  ['technician-assigned', ['PROVIDER_TECHNICIAN']], ['technician-unassigned', ['PROVIDER_TECHNICIAN']],
  ['technician-viewer', ['PROVIDER_TECHNICIAN', 'PROVIDER_VIEWER']], ['provider-viewer', ['PROVIDER_VIEWER']], ['provider-sales', ['PROVIDER_SALES']],
];
for (const [label, roles] of members) {
  const actor = actors.find(value => value.label === label), client = clients.get(label);
  const memberships = await client.from('organization_memberships').select('id,organization_member_roles(role_code,revoked_at)').eq('organization_id', owner.organizationId).eq('user_id', actor.userId).eq('status', 'ACTIVE');
  if (memberships.error) throw new Error('NATIVE_PROVIDER_MEMBERSHIP_READ_FAILED');
  const actualRoles = (memberships.data ?? []).flatMap(member => member.organization_member_roles ?? []).filter(role => role.revoked_at === null).map(role => role.role_code);
  if (!roles.every(role => actualRoles.includes(role))) {
    if (!actor.invitationIntent) { actor.invitationIntent = { key: randomUUID(), correlation: randomUUID(), expiresAt: new Date(Date.now() + 86400000).toISOString() }; await persist(); }
    const invitation = await call(ownerClient, 'invite_organization_member_by_email', { p_organization_id: owner.organizationId, p_invited_email: actor.email, p_role_codes: roles, p_expires_at: actor.invitationIntent.expiresAt, p_idempotency_key: actor.invitationIntent.key, p_correlation_id: actor.invitationIntent.correlation });
    actor.invitationId = invitation.invitation_id; await persist();
    await call(client, 'accept_organization_invitation', { p_invitation_id: actor.invitationId, p_correlation_id: actor.invitationIntent.correlation });
  }
  actor.organizationId = owner.organizationId; actor.roles = roles; actor.stage = 'MEMBERSHIP_READY'; await persist();
}

// Explicit TEST-only staff bootstrap. No session, JWT or Provider approval is fabricated.
const staff = [['compliance-reviewer', 'COMPLIANCE_MANAGER'], ['governance-author', 'SUPER_ADMIN'], ['governance-reviewer', 'SUPER_ADMIN'], ['finance-author', 'FINANCE_MANAGER'], ['finance-reviewer', 'FINANCE_MANAGER']];
const values = staff.map(([label, role]) => { const actor = actors.find(value => value.label === label); if (!uuid.test(actor.userId)) throw new Error('EXACT_NATIVE_TEST_STAFF_REQUIRED'); actor.roles = [role]; return `('${actor.userId}','${role}')`; });
docker(['exec', '-i', state.database, 'psql', '-X', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
  input: `begin;do $$begin if not exists(select 1 from private.admin_execution_environment_v1 where singleton and environment='DEVELOPMENT')then raise exception 'TEST_DEVELOPMENT_REQUIRED';end if;end$$;insert into public.platform_user_roles(user_id,role_code)values${values.join(',')}on conflict(user_id,role_code)do nothing;commit;`,
});
await persist();
const boundary = JSON.parse(docker(['exec', '-i', state.database, 'psql', '-X', '-U', 'supabase_admin', '-d', 'postgres', '-Atq', '-v', 'ON_ERROR_STOP=1'], {
  input: `select json_build_object('clientRoles',(select count(*)from public.organization_memberships m join public.organization_member_roles r on r.membership_id=m.id where m.organization_id='${owner.organizationId}'and r.revoked_at is null and r.role_code like 'CLIENT_%'),'clientTrials',(select count(*)from public.client_trials where organization_id='${owner.organizationId}'));`,
}));
if (boundary.clientRoles !== 0 || boundary.clientTrials !== 0) throw new Error('NO_PROVIDER_CLIENT_ROLE_OR_TRIAL_ALLOWED');
state.status = 'ACTORS_READY'; await writeFile(resolve(state.directory, 'state.private.json'), JSON.stringify(state), { mode: 0o600 });
const proof = { scope: 'GENUINE_GOTRUE_PROVIDER_COHORT_WITH_NATIVE_ORGANIZATIONS_AND_INVITATIONS', status: 'READY', userJwtFabricated: false, nativeEmailDeliveryCertified: false, staffRoleBootstrap: 'EXPLICIT_TEST_ONLY_NOT_GOVERNED_STAFF_ONBOARDING_CERTIFICATION', actors: actors.map(({ label, userId, organizationId, roles }) => ({ label, userId, organizationId, roles })), noProviderClientRoleOrTrialActivated: true, boundary };
await writeFile(resolve(state.directory, 'cohort-proof.json'), JSON.stringify(proof, null, 2));
console.log(JSON.stringify({ status: 'NATIVE_PROVIDER_COHORT_READY', actors: actors.length, separateStaffActors: staff.length }));

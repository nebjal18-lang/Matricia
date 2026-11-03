import { requireDevelopment, loadOwnState } from './safety.mjs';
requireDevelopment();
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { totp } from '../../../../scripts/p05-e2e/totp.mjs';
const root = process.cwd(), require = createRequire(resolve(root, 'apps/web/package.json')), { createClient } = require('@supabase/supabase-js');
const s = await loadOwnState(), statePath = resolve(s.directory, 'state.private.json');
const url = `http://127.0.0.1:${s.gatewayPort}`;
const admin = createClient(url, s.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const db = postgres({ host: s.dbHost, port: s.dbPort, username: 'supabase_admin', password: s.dbSecret, database: 'postgres', max: 1, connect_timeout: 5, onnotice: () => { } });
const actors = [];
function check(v, code) { if (!v)
    throw new Error(code); }
try {
    for (const label of ['owner', 'foreign', 'reviewer', 'buyer']) {
        const email = `client-browser-${label}-${s.token}@example.invalid`;
        const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { locale: 'fr' }, app_metadata: { isolated_browser_fixture: s.token } });
        check(!created.error && created.data.user, 'NATIVE_TEST_USER_CREATE_FAILED');
        const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
        check(!link.error, 'NATIVE_TEST_LINK_FAILED');
        const client = createClient(url, s.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const login = await client.auth.verifyOtp({ type: 'magiclink', token_hash: link.data.properties.hashed_token });
        check(!login.error, 'NATIVE_TEST_OTP_FAILED');
        const factor = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Isolated browser verification' });
        check(!factor.error, 'NATIVE_TEST_FACTOR_FAILED');
        let verified = false;
        for (const offset of [0, -30000, 30000]) {
            const v = await client.auth.mfa.challengeAndVerify({ factorId: factor.data.id, code: totp(factor.data.totp.secret, Date.now() + offset) });
            if (!v.error) {
                verified = true;
                break;
            }
        }
        check(verified, 'NATIVE_TEST_AAL2_FAILED');
        const identity = await client.auth.getUser(), aal = await client.auth.mfa.getAuthenticatorAssuranceLevel();
        check(identity.data.user?.id === created.data.user.id && aal.data.currentLevel === 'aal2', 'NATIVE_SESSION_NOT_AAL2');
        const session = await client.auth.getSession();
        const actor = { label, userId: created.data.user.id, email, session: session.data.session, organizationId: null };
        if (['owner', 'foreign'].includes(label)) {
            const ice = String(BigInt('0x' + randomBytes(6).toString('hex'))).padStart(15, '0');
            const result = await client.rpc('create_or_request_organization', { p_legal_name: `TEST Client ${label} ${s.token}`, p_display_name: `TEST Client ${label}`, p_ice: ice, p_owner_role: 'CLIENT_OWNER', p_idempotency_key: randomUUID(), p_correlation_id: randomUUID() });
            if (result.error) {
                console.log(JSON.stringify({ step: 'native_organization', code: result.error.code, message: result.error.message }));
                throw new Error('NATIVE_TEST_ORGANIZATION_FAILED');
            }
            check(result.data?.organization_id, 'NATIVE_TEST_ORGANIZATION_MISSING');
            actor.organizationId = result.data.organization_id;
            actor.ice = ice;
        }
        actors.push(actor);
        await writeFile(resolve(s.directory, 'actors.private.json'), JSON.stringify(actors), { mode: 0o600 });
        console.log(JSON.stringify({ step: 'native_actor_ready', label, verifiedAal2: true, hasOrganization: !!actor.organizationId }));
    }
    const owner = actors.find(a => a.label === 'owner'), buyer = actors.find(a => a.label === 'buyer'), reviewer = actors.find(a => a.label === 'reviewer');
    await db `insert into public.platform_user_roles(user_id,role_code)values(${reviewer.userId}::uuid,'COMPLIANCE_MANAGER')`;
    const membershipId = randomUUID();
    await db `insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values(${membershipId}::uuid,${owner.organizationId}::uuid,${buyer.userId}::uuid,'ACTIVE',clock_timestamp())`;
    await db `insert into public.organization_member_roles(membership_id,role_code)values(${membershipId}::uuid,'CLIENT_BUYER')`;
    buyer.organizationId = owner.organizationId;
    await writeFile(resolve(s.directory, 'actors.private.json'), JSON.stringify(actors), { mode: 0o600 });
    s.status = 'ACTORS_READY';
    await writeFile(statePath, JSON.stringify(s), { mode: 0o600 });
    console.log(JSON.stringify({ status: s.status, nativeActors: actors.length, roleBootstrap: 'SQL_TEST_ONLY_NOT_GOVERNED_ROLE_ASSIGNMENT_PROOF' }));
}
finally {
    await db.end();
}

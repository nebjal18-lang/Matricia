if (!process.argv.includes('--coordinated')) throw new Error('ORCHESTRATOR_COORDINATED_STAGE_REQUIRED');
import { requireDevelopment, docker, loadOwnState } from './safety.mjs';
requireDevelopment();
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const s = await loadOwnState(), statePath = resolve(s.directory, 'state.private.json');
if (!(['RESTORED','CANDIDATE_READY'].includes(s.status)) || (s.status==='RESTORED'&&s.schemaStatus!=='BASELINE_CANONICAL458'))
    throw new Error('RESTORED_OWNED_TEST_DATABASE_REQUIRED');
async function run(kind, image, env, alias, cmd = []) { const name = `matricia_provider_browser_${kind}_${s.token.replaceAll('-', '').slice(0, 16)}`, file = resolve(s.directory, `${kind}.private.env`); await writeFile(file, Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 }); docker(['run', '--detach', '--pull=never', '--name', name, '--label', s.label, '--network', s.network, '--network-alias', alias, '--env-file', file, image, ...cmd], {timeout:300000}); s.children.push(name); const data = JSON.parse(docker(['inspect', '--format', '{{json .NetworkSettings.Networks}}', name])); s[`${kind}Host`] = data[s.network].IPAddress; await writeFile(statePath, JSON.stringify(s), { mode: 0o600 }); }
const authUrl = `postgresql://supabase_auth_admin:${s.dbSecret}@db:5432/postgres`;
await run('auth', 'ghcr.io/supabase/gotrue:v2.196.0', {
    GOTRUE_API_HOST: '0.0.0.0', GOTRUE_API_PORT: '9999', API_EXTERNAL_URL: `http://127.0.0.1:${s.gatewayPort}`, GOTRUE_DB_DRIVER: 'postgres', GOTRUE_DB_DATABASE_URL: authUrl, GOTRUE_SITE_URL: `http://127.0.0.1:${s.appPort}`, GOTRUE_URI_ALLOW_LIST: `http://127.0.0.1:${s.appPort}/**`, GOTRUE_DISABLE_SIGNUP: 'false', GOTRUE_JWT_SECRET: s.jwtSecret, GOTRUE_JWT_EXP: '3600', GOTRUE_JWT_AUD: 'authenticated', GOTRUE_JWT_ADMIN_ROLES: 'service_role', GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated', GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true', GOTRUE_MAILER_AUTOCONFIRM: 'true', GOTRUE_MFA_ENABLED: 'true', GOTRUE_MFA_TOTP_ENROLL_ENABLED: 'true', GOTRUE_MFA_TOTP_VERIFY_ENABLED: 'true', GOTRUE_LOG_LEVEL: 'error'
}, 'auth');
await run('rest', 'ghcr.io/supabase/postgrest:v16.2', { PGRST_DB_URI: `postgresql://authenticator:${s.dbSecret}@db:5432/postgres`, PGRST_DB_SCHEMAS: 'public,storage,graphql_public', PGRST_DB_EXTRA_SEARCH_PATH: 'public,extensions', PGRST_DB_ANON_ROLE: 'anon', PGRST_JWT_SECRET: s.jwtSecret, PGRST_SERVER_HOST: '0.0.0.0', PGRST_SERVER_PORT: '3000', PGRST_LOG_LEVEL: 'error', PGRST_DB_MAX_ROWS: '1000' }, 'rest');
await run('storage', 'ghcr.io/supabase/storage-api:v1.72.1', { ANON_KEY: s.anonKey, SERVICE_KEY: s.serviceKey, AUTH_JWT_SECRET: s.jwtSecret, POSTGREST_URL: 'http://rest:3000', DATABASE_URL: `postgresql://supabase_storage_admin:${s.dbSecret}@db:5432/postgres`, REGION: 'local', TENANT_ID: 'provider-browser-test', STORAGE_BACKEND: 'file', FILE_STORAGE_BACKEND_PATH: '/tmp/storage', FILE_SIZE_LIMIT: '52428800', TUS_URL_PATH: '/upload/resumable', GLOBAL_S3_BUCKET: 'stub', PORT: '5000' }, 'storage');
s.servicesStarted=true;s.status = 'SERVICES_STARTED';
await writeFile(statePath, JSON.stringify(s), { mode: 0o600 });
console.log(JSON.stringify({ status: s.status, children: s.children, isolatedInternalNetwork: s.network }));

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);
const loopback = host => ['localhost', '127.0.0.1', '[::1]'].includes(host);
const required = (value, name) => { if (typeof value !== 'string' || !value.trim()) throw new Error(`Local E2E requires ${name}`); return value.trim(); };
function endpoint(value, protocol, port) {
  const url = new URL(value);
  if (url.protocol !== protocol || !loopback(url.hostname) || url.port !== port || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('Local E2E endpoint must use the exact loopback origin');
  return url.origin;
}
export function validateLocalConfiguration(env, projectId, containers) {
  if (env.E2E_LOCAL_ISOLATED !== '1' || env.APP_ENV !== 'development' || !/^[A-Za-z][A-Za-z0-9_-]{2,63}$/.test(projectId) || env.E2E_LOCAL_PROJECT_ID !== projectId) throw new Error('Local E2E requires explicit matching non-production project identity');
  for (const role of ['db', 'kong', 'auth', 'storage']) {
    const c = containers[role];
    if (!c?.running || c.project !== projectId || c.composeProject !== projectId || !c.image?.startsWith('ghcr.io/supabase/')) throw new Error('Local E2E Docker identity is not verified');
  }
  if (containers.auth.totpEnrollment !== true || containers.auth.totpVerification !== true) throw new Error('LOCAL_TOTP_DISABLED: enable GoTrue TOTP enrollment and verification before creating fixtures');
  if (!containers.db.ports?.['5432/tcp']?.some(p => p.HostPort === '54322') || !containers.kong.ports?.['8000/tcp']?.some(p => p.HostPort === '54321')) throw new Error('Local E2E Docker ports do not match');
  const databaseUrl = required(env.DIRECT_URL, 'DIRECT_URL');
  const database = new URL(databaseUrl);
  if (database.protocol !== 'postgresql:' || !loopback(database.hostname) || database.port !== '54322' || database.pathname !== '/postgres' || !['postgres', 'supabase_admin'].includes(database.username) || !database.password || database.search || database.hash) throw new Error('Local E2E database must be the verified Docker loopback database');
  // A pooler binding must never silently override the verified local database.
  if (env.SUPABASE_DB_POOLER_URL && env.SUPABASE_DB_POOLER_URL !== databaseUrl) throw new Error('Hosted pooler binding is forbidden in local E2E');
  const baseUrl = endpoint(env.E2E_BASE_URL || 'http://localhost:5173', 'http:', '5173');
  if (env.NEXT_PUBLIC_APP_URL && endpoint(env.NEXT_PUBLIC_APP_URL, 'http:', '5173') !== baseUrl) throw new Error('Local application origins differ');
  return { runtimeMode: 'isolated-local-docker', localDockerVerified: true, environment: 'development', projectRef: `local-${projectId}`, region: 'local-docker', databaseUrl, baseUrl,
    supabaseUrl: endpoint(required(env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'), 'http:', '54321'),
    publishableKey: required(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), serviceRoleKey: required(env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY') };
}
export async function verifyLocalDockerConfiguration(env, projectId) {
  const containers = {};
  for (const role of ['db', 'kong', 'auth', 'storage']) {
    // Select fields only: never read or emit container environment/secrets.
    const template = '{{json .State.Running}}|{{index .Config.Labels "com.supabase.cli.project"}}|{{index .Config.Labels "com.docker.compose.project"}}|{{.Config.Image}}|{{json .NetworkSettings.Ports}}|{{range .Config.Env}}{{if eq . "GOTRUE_MFA_TOTP_ENROLL_ENABLED=true"}}TOTP_ENROLL{{end}}{{if eq . "GOTRUE_MFA_TOTP_VERIFY_ENABLED=true"}}TOTP_VERIFY{{end}}{{end}}';
    const { stdout } = await execute('docker', ['inspect', '--format', template, `supabase_${role}_${projectId}`], { timeout: 10_000, maxBuffer: 32_768 });
    const [running, project, composeProject, image, ports, mfa] = stdout.trim().split('|');
    containers[role] = { running: running === 'true', project, composeProject, image, ports: JSON.parse(ports), totpEnrollment: mfa?.includes('TOTP_ENROLL') ?? false, totpVerification: mfa?.includes('TOTP_VERIFY') ?? false };
  }
  const config = validateLocalConfiguration(env, projectId, containers);
  for (const [path, key, bearer] of [['/auth/v1/settings', config.publishableKey, false], ['/auth/v1/admin/users?page=1&per_page=1', config.serviceRoleKey, true]]) {
    const response = await fetch(config.supabaseUrl + path, { headers: { apikey: key, ...(bearer ? { authorization: `Bearer ${key}` } : {}) }, redirect: 'error', signal: AbortSignal.timeout(5_000) });
    await response.body?.cancel();
    if (!response.ok) throw new Error('Local GoTrue credentials could not be verified');
  }
  return config;
}

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const auditDir = fileURLToPath(new URL('.', import.meta.url));
const root = fileURLToPath(new URL('../../../', import.meta.url));
const evidenceDir = join(auditDir, 'evidence');
await mkdir(evidenceDir, { recursive: true });
const mode = process.argv[2];
const allowedModes = ['inspect', 'db', 'build-local', 'serve'];
if (!allowedModes.includes(mode)) throw new Error('Unknown local audit mode');
const { stdout } = await execute(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'corepack pnpm exec supabase status --output json'], {
  cwd: root, windowsHide: true, maxBuffer: 2_000_000,
});
const local = JSON.parse(stdout.slice(stdout.indexOf('{')));
const api = new URL(local.API_URL);
const database = new URL(local.DB_URL);
if (!['localhost', '127.0.0.1'].includes(api.hostname) || api.port !== '54321'
  || !['localhost', '127.0.0.1'].includes(database.hostname) || database.port !== '54322') {
  throw new Error('Only existing local Docker Supabase endpoints are permitted');
}
const clone = new URL(database);
clone.pathname = '/matricia_audit_20261119_b578c75c';
clone.username = 'supabase_admin';
const secrets = [local.ANON_KEY, local.SERVICE_ROLE_KEY, database.password, database.toString(), clone.toString()].filter(Boolean);
function redact(input) {
  let value = input;
  for (const secret of secrets) value = value.split(secret).join('[REDACTED]');
  return value.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_JWT]');
}
const env = {
  ...process.env, PATH: dirname(process.execPath) + delimiter + process.env.PATH,
  APP_ENV: 'development',
  NEXT_PUBLIC_SUPABASE_URL: api.origin,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
  DIRECT_URL: clone.toString(), SUPABASE_DB_POOLER_URL: '',
  NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:5175',
  PAYMENT_PROVIDER: 'DEMO', PAYMENT_PROVIDER_ALLOWLIST: 'DEMO', PAYMENT_LIVE_ENABLED: 'false',
  EMAIL_DELIVERY_MODE: 'DEMO', EMAIL_LIVE_DELIVERY_ENABLED: 'false',
  MARKETING_PUBLISH_MODE: 'sandbox', MARKETING_LIVE_PUBLISHING_ENABLED: 'false',
  MATRICIA_DEMO_ACCESS_ENABLED: 'false', NO_COLOR: '1', FORCE_COLOR: '0',
};
if (mode === 'inspect') {
  const require = createRequire(join(root, 'package.json'));
  const postgres = require('postgres');
  const sql = postgres(clone.toString(), { max: 1, connect_timeout: 5 });
  try {
    const identity = await sql`select current_database() as database, current_user as actor, (select count(*)::int from supabase_migrations.schema_migrations) as migration_count`;
    const rls = await sql`select count(*)::int as tables, count(*) filter(where relrowsecurity)::int as rls_tables from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'`;
    const publicWithoutRls = await sql`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity order by 1`;
    const result = { date: new Date().toISOString(), localDockerOnly: true, identity, rls, publicWithoutRls,
      isolation: 'Read-only snapshot from existing local database restored into a separate audit database; pg_cron excluded; no original application data modified',
      browserApiScope: 'Existing local Supabase HTTP API is not the cloned SQL database; browser public/read-only checks do not prove clone persistence',
    };
    await writeFile(join(evidenceDir, 'local-environment.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } finally { await sql.end(); }
} else {
  const requireWeb = createRequire(join(root, 'apps/web/package.json'));
  const next = requireWeb.resolve('next/dist/bin/next');
  const command = mode === 'db'
    ? [join(root, 'scripts/run-db-tests.mjs')]
    : [next, mode === 'build-local' ? 'build' : 'start', ...(mode === 'serve' ? ['--port', '5175', '--hostname', '127.0.0.1'] : [])];
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const child = spawn(process.execPath, command, {
    cwd: mode === 'db' ? root : join(root, 'apps/web'), env, windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let buffer = '';
  child.stdout.on('data', data => { buffer += data.toString(); if (mode === 'serve') process.stdout.write(redact(data.toString())); });
  child.stderr.on('data', data => { buffer += data.toString(); if (mode === 'serve') process.stderr.write(redact(data.toString())); });
  child.on('error', error => { buffer += error.message; });
  const exitCode = await new Promise(resolve => child.on('close', resolve));
  const metadata = { mode, startedAt, finishedAt: new Date().toISOString(), durationMs: Date.now() - started,
    exitCode, nodeVersion: process.version, localOnly: true,
    filter: mode === 'db' ? process.env.DB_TEST_PATTERN ?? null : null,
    sqlTarget: mode === 'db' ? clone.pathname.slice(1) : 'not used for SQL by build/server; HTTP target is local Supabase',
  };
  const evidenceName = mode === 'db' && process.env.DB_TEST_PATTERN ? 'db-filtered-concurrency' : mode;
  await writeFile(join(evidenceDir, `${evidenceName}.log`), redact(buffer));
  await writeFile(join(evidenceDir, `${evidenceName}.json`), JSON.stringify(metadata, null, 2));
  console.log(JSON.stringify(metadata));
  if (mode !== 'serve') console.log(redact(buffer).split(/\r?\n/).slice(-35).join('\n'));
  process.exitCode = exitCode ?? 1;
}

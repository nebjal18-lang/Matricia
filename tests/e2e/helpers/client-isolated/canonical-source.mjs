#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rm, statfs, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareSqlTest } from '../../../../scripts/db-test-support.mjs';

// ACL inspection reference ONLY. This intentionally retains one owned
// no-network source, runs no business tests, and emits no green replay receipt.
// This tool never connects to the configured application database. Its only
// target is a newly created, labelled Docker container without a network.
const args = process.argv.slice(2);
if (process.env.APP_ENV !== 'development' || args.length > 0) {
  throw new Error('LOCAL_REPLAY_REQUIRES_DEVELOPMENT_AND_SAFE_SQL_ARGUMENTS');
}
process.umask(0o077);
const root = process.cwd();
const token = randomUUID();
const name = `matricia_replay_${token.replaceAll('-', '')}`;
const label = `matricia.isolated-replay=${token}`;
const directory = resolve(root, 'work', 'canonical-acl-source', token);
await mkdir(directory, { recursive: true, mode: 0o700 });
const images = {
  database: 'ghcr.io/supabase/postgres:17.6.1.167',
  auth: 'ghcr.io/supabase/gotrue:v2.196.0',
  storage: 'ghcr.io/supabase/storage-api:v1.72.1',
};
const dockerEnvironment = { ...process.env, DOCKER_HOST: 'unix:///var/run/docker.sock' };
for (const key of ['DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete dockerEnvironment[key];
const summary = {
  environment: 'development-local-isolated', network: 'none', publicPorts: 0,
  images, startedAt: new Date().toISOString(), status: 'failed', migrations: [], sql: [],
  concurrencyIncluded: false, stagingCertification: false, cleanup: 'pending',
};
let created = false;
let bootstrapSecret = '';
function docker(parameters, options = {}) {
  return execFileSync('docker', parameters, {
    env: dockerEnvironment, encoding: 'utf8', timeout: 90_000,
    maxBuffer: 8 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'], ...options,
  });
}
function sql(source) {
  return docker(['exec', '-i', name, 'psql', '-X', '-U', 'supabase_admin', '-d', 'postgres', '-Atq', '-v', 'ON_ERROR_STOP=1'], { input: source });
}
function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
async function snapshot(relativeDirectory) {
  const files = (await readdir(resolve(root, relativeDirectory))).filter(file => file.endsWith('.sql')).sort();
  return Promise.all(files.map(async file => {
    const bytes = await readFile(resolve(root, relativeDirectory, file));
    return { file, bytes, sha256: digest(bytes) };
  }));
}
async function commandLog(file, command) {
  const sanitize = output => bootstrapSecret ? String(output).split(bootstrapSecret).join('[redacted]') : String(output);
  try { await writeFile(resolve(directory, file), sanitize(command()), { mode: 0o600 }); }
  catch (error) {
    // These logs contain only synthetic local configuration and test fixtures.
    await writeFile(resolve(directory, file), sanitize(`${error.stdout ?? ''}\n${error.stderr ?? ''}`), { mode: 0o600 });
    throw new Error(`LOCAL_REPLAY_COMMAND_FAILED:${file}`);
  }
}
try {
  const space = await statfs(root, { bigint: true });
  if (space.bavail * space.bsize < 4n * 1024n ** 3n) throw new Error('LOCAL_REPLAY_NEEDS_4_GIB_FREE');
  for (const image of Object.values(images)) docker(['image', 'inspect', image, '--format', '{{.Id}}']);
  const migrations = await snapshot('supabase/migrations');
  const requestedTests = args.filter(arg => arg.startsWith('--test=')).map(arg => arg.slice(7));
  if (requestedTests.length && args.includes('--with-sql')) throw new Error('LOCAL_REPLAY_AMBIGUOUS_SQL_SCOPE');
  const availableTests = args.includes('--with-sql') || requestedTests.length ? await snapshot('supabase/tests') : [];
  const tests = requestedTests.length ? availableTests.filter(test => requestedTests.includes(test.file)) : availableTests;
  if (requestedTests.some(name => !tests.some(test => test.file === name))) throw new Error('LOCAL_REPLAY_REQUESTED_TEST_MISSING');
  if (requestedTests.length && tests.some(test => /\b(?:session_replication_role|disable\s+trigger|enable\s+trigger)\b/i.test(test.bytes.toString('utf8')))) throw new Error('LOCAL_REPLAY_FIXTURE_GUARD_BYPASS_REFUSED');
  const secret = randomBytes(32).toString('hex');
  bootstrapSecret = secret;
  const environmentFile = resolve(directory, 'bootstrap.env');
  await writeFile(environmentFile, [
    `POSTGRES_PASSWORD=${secret}`, 'PGDATA=/var/lib/postgresql/data',
    'GOTRUE_DB_DRIVER=postgres',
    `GOTRUE_DB_DATABASE_URL=postgresql://supabase_auth_admin:${secret}@127.0.0.1:5432/postgres`,
    `DATABASE_URL=postgresql://supabase_storage_admin:${secret}@127.0.0.1:5432/postgres`,
    'API_EXTERNAL_URL=http://127.0.0.1:9999', 'GOTRUE_SITE_URL=http://127.0.0.1:5173',
    `GOTRUE_JWT_SECRET=${secret}`, `AUTH_JWT_SECRET=${secret}`,
    'STORAGE_BACKEND=file', 'FILE_STORAGE_BACKEND_PATH=/tmp/storage',
    `ANON_KEY=${secret}`, `SERVICE_KEY=${secret}`, 'POSTGREST_URL=http://127.0.0.1:3000',
    'REGION=local', 'TENANT_ID=local', '',
  ].join('\n'), { mode: 0o600 });
  docker(['run', '--detach', '--pull=never', '--name', name, '--label', label,
    '--network', 'none', '--env-file', environmentFile, images.database,
    'postgres', '-D', '/etc/postgresql', '-c', 'shared_preload_libraries=pg_cron', '-c', 'cron.database_name=postgres']);
  created = true;
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    // The image first runs an init-only Unix-socket server. TCP becomes
    // available only after init scripts and the final server restart complete.
    try { docker(['exec', name, 'pg_isready', '-h', '127.0.0.1', '-p', '5432', '-U', 'postgres']); ready = true; break; } catch { /* bounded startup */ }
    await new Promise(done => setTimeout(done, 1_000));
  }
  if (!ready) throw new Error('LOCAL_REPLAY_POSTGRES_UNAVAILABLE');
  sql(`alter role supabase_auth_admin password '${secret}'; alter role supabase_storage_admin password '${secret}';`);
  await commandLog('auth-bootstrap.log', () => docker(['run', '--rm', '--pull=never', '--label', label,
    '--network', `container:${name}`, '--env-file', environmentFile, images.auth, 'auth', 'migrate']));
  await commandLog('storage-bootstrap.log', () => docker(['run', '--rm', '--pull=never', '--label', label,
    '--network', `container:${name}`, '--env-file', environmentFile, '--entrypoint', 'node',
    images.storage, 'dist/scripts/migrate-call.js']));
  for (const migration of migrations) {
    await commandLog(`migration-${migration.file}.log`, () => sql(migration.bytes));
    summary.migrations.push({ file: migration.file, sha256: migration.sha256, passed: true });
  }
  sql("update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configured_at=clock_timestamp(),configuration_reference='ISOLATED_LOCAL_REPLAY' where singleton and environment is null;");
  for (const test of tests) {
    let output = '', commandFailed = false;
    const logName = `test-${test.file}.log`;
    try {
      await commandLog(logName, () => { output = sql(prepareSqlTest(test.bytes.toString('utf8'))); return output; });
    } catch {
      commandFailed = true;
      output = await readFile(resolve(directory, logName), 'utf8');
    }
    const plans = [...output.matchAll(/^1\.\.(\d+)\s*$/gm)];
    const assertions = [...output.matchAll(/^(not )?ok\s+(\d+)\b.*$/gm)];
    const passed = !commandFailed && plans.length === 1 && Number(plans[0][1]) > 0
      && assertions.length === Number(plans[0][1])
      && assertions.every((assertion, index) => !assertion[1] && Number(assertion[2]) === index + 1)
      && !/^Bail out!/im.test(output)
      && !/^(?:not )?ok\b[^\n]*#\s*(?:SKIP|TODO)\b/im.test(output);
    summary.sql.push({ file: test.file, sha256: test.sha256, assertions: assertions.length, passed });
  }
  summary.runtimeSecurity = JSON.parse(sql(`select json_build_object(
    'publicTables', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in('r','p')),
    'tablesWithoutRls', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in('r','p') and not c.relrowsecurity),
    'pgtapApiExecutable', (select coalesce(bool_or(has_function_privilege(runtime.role_name,p.oid,'EXECUTE')),false)
      from pg_proc p join pg_depend d on d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e'
      join pg_extension e on e.oid=d.refobjid
      cross join (values('anon'),('authenticated'),('service_role'))runtime(role_name)
      where e.extname='pgtap')
  );`).trim());
  if (summary.runtimeSecurity.publicTables < 1 || summary.runtimeSecurity.tablesWithoutRls !== 0
      || summary.runtimeSecurity.pgtapApiExecutable !== false) throw new Error('LOCAL_REPLAY_RUNTIME_SECURITY_FAILED');
  if (summary.sql.some(test => !test.passed)) throw new Error('LOCAL_REPLAY_SQL_TESTS_FAILED');
  summary.status = 'retained-setup-source';
} catch (error) {
  summary.failure = /^LOCAL_REPLAY_[A-Z_]+(?::[a-zA-Z0-9_.-]+)?$/.test(error.message) ? error.message : 'LOCAL_REPLAY_FAILED';
  process.exitCode = 1;
} finally {
  // Explicit inspection SOURCE retention only, never a green replay receipt.
  // Bootstrap children are disposable; only this newly labelled target remains.
  try {
    const children = docker(['ps', '-aq', '--filter', `label=${label}`]).trim().split(/\s+/).filter(Boolean);
    const ownId = created ? docker(['inspect', '--format', '{{.Id}}', name]).trim() : '';
    const transient = children.filter(id => id && !ownId.startsWith(id));
    if (transient.length) docker(['rm', '--force', '--volumes', ...transient]);
    summary.cleanup = created ? 'retained-setup-source' : 'not-created';
    if (created) await writeFile(resolve(directory, 'source-target.json'), JSON.stringify({token,name,label,database:'postgres',network:'none',publicPorts:0,isolated:true,purpose:'CANONICAL_ACL_SETUP_SOURCE_ONLY',status:summary.status,migrationCount:summary.migrations.length}),{mode:0o600});
  } catch { summary.cleanup = 'failed'; process.exitCode = 1; }
  await rm(resolve(directory, 'bootstrap.env'), { force: true });
  summary.finishedAt = new Date().toISOString();
  await writeFile(resolve(directory, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify({ status: summary.status, migrations: summary.migrations.length,
    sqlFiles: summary.sql.length, assertions: summary.sql.reduce((total, test) => total + test.assertions, 0),
    concurrencyIncluded: false, cleanup: summary.cleanup, evidence: `work/canonical-acl-source/${token}/summary.json`,
    ...(summary.failure ? { failure: summary.failure } : {}),
  }));
}

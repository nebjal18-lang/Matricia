import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSafeDatabaseTarget } from './db-test-support-safety.mjs';

// All subprocess output (including dumps, role definitions and diagnostics) stays
// in memory. Only fixed phase messages may cross the console boundary.
export function execute(command, args, { input, env = process.env, signal, cwd, timeoutMs = 600_000, maxBytes = 512 * 1024 * 1024 } = {}) {
  return new Promise((done, reject) => {
    const child = spawn(command, args, { env, signal, cwd, timeout: timeoutMs, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = []; let size = 0, failed = false;
    child.stdout.on('data', chunk => { size += chunk.length; if (size > maxBytes) { failed = true; child.kill(); } else chunks.push(chunk); });
    child.stderr.on('data', () => {});
    child.stdin.on('error', () => {});
    child.on('error', () => reject(new Error('ISOLATED_DB_COMMAND_FAILED')));
    child.on('close', code => code === 0 && !failed ? done(Buffer.concat(chunks)) : reject(new Error('ISOLATED_DB_COMMAND_FAILED')));
    child.stdin.end(input);
  });
}

export function validateSource(inspected, project) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(project ?? '') || inspected?.Name !== `/supabase_db_${project}`
    || inspected.Config?.Labels?.['com.supabase.cli.project'] !== project || !inspected.State?.Running
    || !/^sha256:[a-f0-9]{64}$/.test(inspected.Image ?? '') || !/^[a-f0-9]{64}$/.test(inspected.Id ?? '')) {
    throw new Error('ISOLATED_DB_SOURCE_IDENTITY_REQUIRED');
  }
  return { id: inspected.Id, image: inspected.Image };
}

export function validateClone(inspected, { id, cloneId, name }) {
  if (inspected?.Id !== id || inspected.Name !== `/${name}`
    || inspected.Config?.Labels?.['matricia.test_clone_id'] !== cloneId) throw new Error('ISOLATED_DB_CLEANUP_IDENTITY_MISMATCH');
}

/** initdb already created the source bootstrap identity (OID 10). Preserve every ALTER/GRANT. */
export function restoreRoleGrantors(dump, bootstrap) {
  if (!/^[a-z_][a-z0-9_]{0,62}$/u.test(bootstrap)) throw new Error('ISOLATED_DB_BOOTSTRAP_ROLE_INVALID');
  return Buffer.from(dump.toString('utf8').split('\n').filter(line => line.replace(/\r$/u, '') !== `CREATE ROLE ${bootstrap};`).join('\n'));
}

export async function runIsolatedDatabase({ env = process.env, run = execute, root = resolve(import.meta.dirname, '..'),
  cloneId = randomBytes(16).toString('hex'), signal, onPhase = () => {} } = {}) {
  onPhase('validate-source');
  if (env.DB_TEST_SOURCE_KIND !== 'clean-local-supabase' || !/^[a-f0-9]{32}$/.test(cloneId)
    || !/^[A-Za-z0-9_-]{1,80}$/.test(env.DB_TEST_SOURCE_PROJECT ?? '') || env.DOCKER_HOST || env.DOCKER_CONTEXT) {
    throw new Error('ISOLATED_DB_EXPLICIT_LOCAL_SOURCE_REQUIRED');
  }
  const docker = (args, options = {}) => run('docker', args, { env, signal, ...options });
  const context = JSON.parse((await docker(['context', 'inspect'])).toString());
  const endpoint = context?.[0]?.Endpoints?.docker?.Host;
  if (typeof endpoint !== 'string' || !/^(?:unix:\/\/\/|npipe:\/\/)/.test(endpoint)) throw new Error('ISOLATED_DB_LOCAL_DOCKER_REQUIRED');
  const inspect = async (id, cleanup = false) => JSON.parse((await docker(['inspect', id], cleanup ? { signal: undefined } : {})).toString())[0];
  const source = validateSource(await inspect(`supabase_db_${env.DB_TEST_SOURCE_PROJECT}`), env.DB_TEST_SOURCE_PROJECT);
  const name = `matricia-test-${cloneId}`, database = `matricia_test_${cloneId}`;
  const password = randomBytes(32).toString('hex');
  // PostgreSQL records superuser role grants under the bootstrap role. Replacing
  // that identity would invalidate GRANTED BY or silently change authorization.
  onPhase('read-bootstrap-role');
  const bootstrap = (await docker(['exec', source.id, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-At', '-c', 'select rolname from pg_roles where oid=10'])).toString().trim();
  if (!/^[a-z_][a-z0-9_]{0,62}$/u.test(bootstrap)) throw new Error('ISOLATED_DB_BOOTSTRAP_ROLE_INVALID');
  let id, created = false, primaryError, cleaned = false;
  try {
    signal?.throwIfAborted();
    onPhase('create-clone');
    // CREATE first, START second: an interrupted start still has an exact cleanup identity.
    id = (await docker(['create', '--name', name, '--label', `matricia.test_clone_id=${cloneId}`,
      '--user', 'postgres', '--publish', '127.0.0.1::5432', '--entrypoint', 'sleep', source.image, 'infinity'], { signal: undefined })).toString().trim();
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('ISOLATED_DB_CONTAINER_ID_INVALID');
    created = true;
    onPhase('start-clone');
    await docker(['start', id]);
    const exec = (args, input) => docker(['exec', '-i', id, ...args], { input });
    onPhase('initialize-clone');
    await exec(['initdb', '-D', '/tmp/matricia-clone', '-U', bootstrap, '--encoding=UTF8', '--locale=C',
      '--auth-local=trust', '--auth-host=scram-sha-256', '--pwfile=/dev/stdin'], Buffer.from(password + '\n'));
    // Docker NAT reaches PostgreSQL from its bridge; the published host port is
    // still loopback-only and all TCP connections require the random password.
    await exec(['tee', '-a', '/tmp/matricia-clone/pg_hba.conf'], Buffer.from('\nhost all all 0.0.0.0/0 scram-sha-256\nhost all all ::/0 scram-sha-256\n'));
    onPhase('start-postgres');
    await exec(['pg_ctl', '-D', '/tmp/matricia-clone', '-l', '/tmp/matricia-postgres.log', '-w', '-t', '60', 'start',
      '-o', `-h 0.0.0.0 -p 5432 -c unix_socket_directories=/tmp -c shared_preload_libraries=pg_cron,pg_net,pg_stat_statements -c cron.database_name=${database} -c cron.launch_active_jobs=off -c pg_net.database_name=postgres`]);
    const psql = (db, input) => exec(['psql', '-X', '-h', '/tmp', '-U', bootstrap, '-d', db, '-v', 'ON_ERROR_STOP=1'], input);
    // No role passwords are copied. Cluster-local memberships/attributes and all
    // database ACLs are retained so RLS recipes exercise the source semantics.
    onPhase('restore-roles');
    const roles = await docker(['exec', source.id, 'pg_dumpall', '-U', 'postgres', '--roles-only', '--no-role-passwords']);
    await psql('postgres', restoreRoleGrantors(roles, bootstrap));
    onPhase('restore-database');
    await psql('postgres', Buffer.from(`CREATE DATABASE "${database}" TEMPLATE template0;`));
    const dump = await docker(['exec', source.id, 'pg_dump', '-U', 'postgres', '-d', 'postgres', '--format=custom']);
    await exec(['pg_restore', '-h', '/tmp', '-U', bootstrap, '-d', database, '--exit-on-error'], dump);
    onPhase('bind-clone-identity');
    await psql('postgres', Buffer.from(`ALTER DATABASE "${database}" SET matricia.test_clone_id = '${cloneId}';
ALTER DATABASE "${database}" SET matricia.test_environment = 'reserved-local-clone';
ALTER ROLE postgres PASSWORD '${password}';`));
    const instance = await inspect(id);
    validateClone(instance, { id, cloneId, name });
    const bindings = instance.NetworkSettings?.Ports?.['5432/tcp'];
    if (bindings?.length !== 1 || bindings[0].HostIp !== '127.0.0.1' || !/^\d+$/.test(bindings[0].HostPort)) throw new Error('ISOLATED_DB_LOOPBACK_BINDING_REQUIRED');
    const targetEnv = { ...env, APP_ENV: 'development', DB_TEST_TARGET_MODE: 'reserved-local-clone', DB_TEST_CLONE_ID: cloneId,
      DIRECT_URL: `postgresql://postgres:${password}@127.0.0.1:${bindings[0].HostPort}/${database}` };
    delete targetEnv.SUPABASE_DB_POOLER_URL;
    resolveSafeDatabaseTarget(targetEnv);
    const runner = env.DB_TEST_RELEASE === '1' ? ['scripts/release/run-checks.mjs', 'database'] : ['scripts/run-db-tests.mjs'];
    onPhase('run-database-checks');
    await run(process.execPath, [resolve(root, runner[0]), ...runner.slice(1)], { env: targetEnv, signal, cwd: root, timeoutMs: 40 * 60_000 });
  } catch (error) { primaryError = error; }
  finally {
    if (created) {
      if (!primaryError) onPhase('verify-clone-cleanup');
      // Do not delete a name, source container, volume or unrelated replacement.
      // Cleanup is not cancelled with the test process.
      validateClone(await inspect(id, true), { id, cloneId, name });
      await docker(['rm', '--force', '--volumes', id], { signal: undefined });
      const remaining = (await docker(['ps', '-aq', '--no-trunc', '--filter', `id=${id}`], { signal: undefined })).toString().trim();
      if (remaining) throw new Error('ISOLATED_DB_CLEANUP_INCOMPLETE');
      cleaned = true;
    }

  }
  if (primaryError) throw new Error('ISOLATED_DB_RUN_FAILED_AFTER_CLEANUP', { cause: primaryError });
  return { cleaned, outcome: env.DB_TEST_PATTERN ? 'PARTIAL' : 'PASS' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once('SIGINT', abort); process.once('SIGTERM', abort);
  let phase = 'preflight';
  runIsolatedDatabase({ signal: controller.signal, onPhase: value => { phase = value; } }).then(result => {
    console.log(`ISOLATED_DB_${result.outcome}: clone removed and absence verified`);
  }).catch(() => { console.error(`ISOLATED_DB_FAILED at ${phase}: raw diagnostics withheld`); process.exitCode = 1; });
}

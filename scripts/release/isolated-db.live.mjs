// Explicit opt-in live smoke test. Never reads a developer's source database.
// DB_TEST_IMAGE must identify an already installed Supabase PostgreSQL image.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execute, runIsolatedDatabase, validateSource } from '../run-isolated-db-tests.mjs';

const image = process.env.DB_TEST_IMAGE;
if (!/^sha256:[a-f0-9]{64}$/.test(image ?? '')) throw new Error('LIVE_TEST_LOCAL_IMAGE_REQUIRED');
const postgresModule = pathToFileURL(createRequire(import.meta.url).resolve('postgres')).href;
const project = `fixture_${randomBytes(8).toString('hex')}`;
let id;
try {
  id = (await execute('docker', ['create', '--name', `supabase_db_${project}`, '--label', `com.supabase.cli.project=${project}`,
    '--user', 'postgres', '--entrypoint', 'sleep', image, 'infinity'])).toString().trim();
  await execute('docker', ['start', id]);
  await execute('docker', ['exec', id, 'initdb', '-D', '/tmp/source', '-U', 'postgres', '--encoding=UTF8', '--locale=C', '--auth=trust']);
  await execute('docker', ['exec', id, 'pg_ctl', '-D', '/tmp/source', '-l', '/tmp/source.log', '-w', 'start',
    '-o', '-c shared_preload_libraries=pg_cron,pg_net -c cron.launch_active_jobs=off']);
  await execute('docker', ['exec', '-i', id, 'psql', '-X', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: Buffer.from(`
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create extension pg_cron;
    create extension pg_net;
    create extension pgtap;
    create table public.clone_probe(id int primary key);
    insert into public.clone_probe values(7);
  `) });
  const env = { ...process.env, DB_TEST_SOURCE_KIND: 'clean-local-supabase', DB_TEST_SOURCE_PROJECT: project };
  const run = async (command, args, options) => {
    if (command !== process.execPath) {
      try { return await execute(command, args, options); }
      catch { throw new Error('LIVE_STEP_' + (['pg_restore', 'pg_ctl', 'initdb', 'psql', 'pg_dump'].find(step => args.includes(step)) ?? 'DOCKER')); }
    }
    // A real child process authenticates over the published loopback socket.
    // The full Matricia suite requires the CI reset source and is a separate gate.
    return execute(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import postgres from ${JSON.stringify(postgresModule)};
      const sql = postgres(process.env.DIRECT_URL, { max: 1, onnotice: () => {} });
      try {
        const [row] = await sql.unsafe("select current_database() as db, current_setting('matricia.test_clone_id') as id, current_setting('matricia.test_environment') as environment");
        assert.equal(row.db, 'matricia_test_' + process.env.DB_TEST_CLONE_ID);
        assert.equal(row.id, process.env.DB_TEST_CLONE_ID);
        assert.equal(row.environment, 'reserved-local-clone');
        assert.equal((await sql.unsafe('select id from public.clone_probe'))[0].id, 7);
        assert.equal((await sql.unsafe("select rolbypassrls from pg_roles where rolname='service_role'"))[0].rolbypassrls, true);
        assert.equal((await sql.unsafe("select count(*)::int as n from pg_extension where extname in ('pg_cron','pg_net','pgtap')"))[0].n, 3);
        await sql.unsafe('begin; insert into public.clone_probe values(8); rollback;');
        assert.equal((await sql.unsafe('select count(*)::int as n from public.clone_probe'))[0].n, 1);
      } finally { await sql.end(); }
    `], options);
  };
  assert.deepEqual(await runIsolatedDatabase({ env, run }), { cleaned: true, outcome: 'PASS' });
  await assert.rejects(runIsolatedDatabase({ env, run: (command, args, options) => {
    if (command === process.execPath) throw new Error('SYNTHETIC_RUNNER_FAILURE');
    return execute(command, args, options);
  } }), /ISOLATED_DB_RUN_FAILED_AFTER_CLEANUP/);
  console.log('LIVE_CLONE_PASS: extensions, roles, data, socket identity, rollback and success/failure cleanup verified');
} finally {
  if (id) {
    const inspected = JSON.parse((await execute('docker', ['inspect', id])).toString())[0];
    assert.equal(validateSource(inspected, project).id, id);
    await execute('docker', ['rm', '--force', '--volumes', id]);
    assert.equal((await execute('docker', ['ps', '-aq', '--no-trunc', '--filter', `id=${id}`])).toString().trim(), '');
  }
}

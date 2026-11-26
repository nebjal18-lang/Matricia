import test from 'node:test';
import assert from 'node:assert/strict';
import { runIsolatedDatabase, validateSource, validateClone, restoreRoleGrantors } from '../run-isolated-db-tests.mjs';

test('role restore retains the declared grantor and all membership options', () => {
  const grant = 'GRANT authenticated TO authenticator WITH INHERIT FALSE GRANTED BY supabase_admin;';
  const dump = `CREATE ROLE supabase_admin;\nALTER ROLE supabase_admin SUPERUSER;\n${grant}`;
  assert.equal(restoreRoleGrantors(Buffer.from(dump), 'supabase_admin').toString(), `ALTER ROLE supabase_admin SUPERUSER;\n${grant}`);
  assert.throws(() => restoreRoleGrantors(Buffer.from(dump), 'bad;role'), /BOOTSTRAP_ROLE_INVALID/);
});

const cloneId = 'a'.repeat(32), id = 'b'.repeat(64), sourceId = 'c'.repeat(64);
const source = { Id: sourceId, Image: `sha256:${'d'.repeat(64)}`, Name: '/supabase_db_fixture', State: { Running: true }, Config: { Labels: { 'com.supabase.cli.project': 'fixture' } } };
const instance = { Id: id, Name: `/${'matricia-test-' + cloneId}`, Config: { Labels: { 'matricia.test_clone_id': cloneId } }, NetworkSettings: { Ports: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '55432' }] } } };
const env = { DB_TEST_SOURCE_KIND: 'clean-local-supabase', DB_TEST_SOURCE_PROJECT: 'fixture' };
function fixture(fail = () => false) {
  const calls = [];
  return { calls, run: async (command, args, options = {}) => {
    calls.push({ command, args, options });
    if (fail(command, args, options)) throw new Error('synthetic-sensitive-diagnostic');
    if (args[0] === 'context') return Buffer.from(JSON.stringify([{ Endpoints: { docker: { Host: 'npipe:////./pipe/docker_engine' } } }]));
    if (args[0] === 'inspect') return Buffer.from(JSON.stringify([args[1] === id ? instance : source]));
    if (args[0] === 'create') return Buffer.from(id);
    if (args.includes('select rolname from pg_roles where oid=10')) return Buffer.from('supabase_admin\n');
    return Buffer.from('');
  } };
}
test('provisions from read-only dump, runs marked clone, deletes exact identity and verifies absence', async () => {
  const f = fixture();
  assert.deepEqual(await runIsolatedDatabase({ env, cloneId, run: f.run }), { cleaned: true, outcome: 'PASS' });
  const runner = f.calls.find(call => call.command === process.execPath);
  assert.equal(runner.options.env.DB_TEST_CLONE_ID, cloneId);
  assert.match(runner.options.env.DIRECT_URL, /@127\.0\.0\.1:55432\/matricia_test_/);
  assert.deepEqual(f.calls.filter(c => c.args[0] === 'rm').map(c => c.args), [['rm', '--force', '--volumes', id]]);
  assert.equal(f.calls.at(-1).args[0], 'ps');
  const sourceCalls = f.calls.filter(c => c.args.includes(sourceId));
  assert.deepEqual(sourceCalls.map(c => c.args[2]), ['psql', 'pg_dumpall', 'pg_dump']);
  assert.ok(f.calls.some(c => c.options.input?.toString().includes('SET matricia.test_clone_id')));
});
test('restore failure and runner failure still clean only the clone', async () => {
  for (const predicate of [(command, args) => args.includes('pg_restore'), command => command === process.execPath]) {
    const f = fixture(predicate);
    await assert.rejects(runIsolatedDatabase({ env, cloneId, run: f.run }), /ISOLATED_DB_RUN_FAILED_AFTER_CLEANUP/);
    assert.equal(f.calls.at(-1).args[0], 'ps');
    assert.ok(f.calls.some(c => c.args[0] === 'rm' && c.args.at(-1) === id));
  }
});
test('source and cleanup identities cannot be spoofed; unapproved sources never launch docker', async () => {
  assert.throws(() => validateSource({ ...source, Name: '/production' }, 'fixture'));
  assert.throws(() => validateClone({ ...instance, Id: sourceId }, { id, cloneId, name: instance.Name.slice(1) }));
  const f = fixture();
  for (const patch of [{ DB_TEST_SOURCE_KIND: undefined }, { DOCKER_HOST: 'tcp://remote:2375' }, { DB_TEST_SOURCE_PROJECT: '../other' }]) {
    await assert.rejects(runIsolatedDatabase({ env: { ...env, ...patch }, cloneId, run: f.run }));
  }
  assert.equal(f.calls.length, 0);
});

test('a changed clone identity forbids removal and a surviving container forbids success', async () => {
  const mismatch = fixture();
  await assert.rejects(runIsolatedDatabase({ env, cloneId, run: async (command, args, options) => {
    if (args[0] === 'inspect' && args[1] === id) return Buffer.from(JSON.stringify([{ ...instance, Id: sourceId }]));
    return mismatch.run(command, args, options);
  } }), /ISOLATED_DB_CLEANUP_IDENTITY_MISMATCH/);
  assert.ok(!mismatch.calls.some(call => call.args[0] === 'rm'));
  const surviving = fixture();
  await assert.rejects(runIsolatedDatabase({ env, cloneId, run: async (command, args, options) => {
    if (args[0] === 'ps') return Buffer.from(id);
    return surviving.run(command, args, options);
  } }), /ISOLATED_DB_CLEANUP_INCOMPLETE/);
});

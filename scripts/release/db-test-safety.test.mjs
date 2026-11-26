import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveSafeDatabaseTarget, verifyDatabaseClone, sqlInventory, validateDatabaseEvidence } from '../db-test-support-safety.mjs';

const cloneId = 'a'.repeat(32);
const env = { APP_ENV: 'development', DB_TEST_TARGET_MODE: 'reserved-local-clone', DB_TEST_CLONE_ID: cloneId,
  DIRECT_URL: `postgres://postgres:synthetic-test-password@127.0.0.1:55432/matricia_test_${cloneId}` };
test('only explicitly reserved local clone targets pass before connection', () => {
  assert.equal(resolveSafeDatabaseTarget(env).cloneId, cloneId);
  for (const patch of [
    { APP_ENV: 'production' }, { APP_ENV: 'staging' }, { APP_ENV: undefined },
    { DB_TEST_TARGET_MODE: undefined }, { DB_TEST_CLONE_ID: 'b'.repeat(32) },
    { SUPABASE_DB_POOLER_URL: 'postgres://postgres.other@aws-0-region.pooler.supabase.com/postgres' },
    ...['db.other.supabase.co', 'localhost', 'arbitrary.example'].map(host => ({ DIRECT_URL: env.DIRECT_URL.replace('127.0.0.1', host) })),
    { DIRECT_URL: env.DIRECT_URL + '?host=remote.example' }, { DIRECT_URL: 'bad-secret-url' },
    { DIRECT_URL: env.DIRECT_URL.replace(`matricia_test_${cloneId}`, 'postgres') },
  ]) assert.throws(() => resolveSafeDatabaseTarget({ ...env, ...patch }), error =>
    error.message === 'DB_TEST_RESERVED_LOCAL_CLONE_REQUIRED');
});

test('database identity read must match all clone claims before mutation', async () => {
  const target = resolveSafeDatabaseTarget(env);
  const row = { database: target.database, clone_id: cloneId, environment: 'reserved-local-clone' };
  await verifyDatabaseClone(async () => [row], target);
  for (const rows of [[], [row, row], [{ ...row, clone_id: null }], [{ ...row, database: 'postgres' }], [{ ...row, environment: 'production' }]]) {
    await assert.rejects(verifyDatabaseClone(async () => rows, target), /DB_TEST_CLONE_IDENTITY_MISMATCH/);
  }
});

test('full SQL evidence binds exact suite bytes, candidate and invocation; partial is never release evidence', async t => {
  const root = await mkdtemp(join(tmpdir(), 'matricia-db-proof-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'supabase/tests'), { recursive: true });
  await writeFile(join(root, 'supabase/tests/a.test.sql'), 'select 1;');
  await writeFile(join(root, 'supabase/tests/b.test.sql'), 'select 2;');
  const inventory = await sqlInventory(root), commit = 'a'.repeat(40), runId = 'invocation';
  const report = { schemaVersion: 1, outcome: 'PASS', scope: 'FULL', filter: null, commit, runId,
    inventorySha256: inventory.sha256, files: inventory.files, assertions: 2, concurrencyScenarios: 4,
    targetMode: 'reserved-local-clone' };
  const validate = value => validateDatabaseEvidence(value, inventory, { commit, runId });
  assert.equal(validate(report), 2);
  for (const patch of [{ outcome: 'PARTIAL' }, { scope: 'PARTIAL' }, { filter: '.*' }, { files: ['a.test.sql'] },
    { files: [...inventory.files].reverse() }, { commit: 'b'.repeat(40) }, { runId: 'stale' },
    { assertions: 0 }, { concurrencyScenarios: 3 }, { targetMode: 'staging' }, { inventorySha256: 'b'.repeat(64) }]) {
    assert.throws(() => validate({ ...report, ...patch }), /DB_RELEASE_FULL_EVIDENCE_REQUIRED/);
  }
  await writeFile(join(root, 'supabase/tests/a.test.sql'), 'select 3;');
  assert.throws(() => validateDatabaseEvidence(report, { ...inventory, sha256: 'changed' }, { commit, runId }));
  assert.notEqual((await sqlInventory(root)).sha256, inventory.sha256);
});

test('actual release command rejects filters before launching pnpm or a DB process', () => {
  const result = spawnSync(process.execPath, [resolve('scripts/release/run-checks.mjs'), 'database'], {
    env: { ...process.env, DB_TEST_PATTERN: '.*' }, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DB_RELEASE_FILTER_FORBIDDEN/);
});

test('actual SQL runner refuses arbitrary URL without loading postgres or exposing credentials', () => {
  const result = spawnSync(process.execPath, [resolve('scripts/run-db-tests.mjs')], {
    env: { ...process.env, ...env, DIRECT_URL: 'postgres://synthetic-user:synthetic-secret@remote.invalid/postgres' },
    encoding: 'utf8', timeout: 10000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^DB_TEST_FAILED:/);
  assert.doesNotMatch(result.stdout + result.stderr, /synthetic|remote.invalid|ERR_MODULE_NOT_FOUND/);
});

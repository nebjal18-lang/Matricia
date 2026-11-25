import test from 'node:test';
import assert from 'node:assert/strict';
import { runReservedCloneConcurrency } from '../run-db-tests.mjs';

test('importing concurrency entrypoint does not execute the SQL runner', () => {
  assert.equal(typeof runReservedCloneConcurrency, 'function');
});

test('concurrency entrypoint rejects hosted and unreserved targets before connecting', async () => {
  for (const env of [
    {},
    { APP_ENV: 'production', DIRECT_URL: 'postgresql://127.0.0.1:5432/postgres' },
    { APP_ENV: 'development', DB_TEST_TARGET_MODE: 'reserved-local-clone', DB_TEST_CLONE_ID: 'a'.repeat(32), DIRECT_URL: `postgresql://example.invalid:5432/matricia_test_${'a'.repeat(32)}` },
    { APP_ENV: 'development', DB_TEST_TARGET_MODE: 'reserved-local-clone', DB_TEST_CLONE_ID: 'a'.repeat(32), DIRECT_URL: 'postgresql://127.0.0.1:5432/postgres' },
  ]) await assert.rejects(runReservedCloneConcurrency(env), /DB_TEST_RESERVED_LOCAL_CLONE_REQUIRED/);
});

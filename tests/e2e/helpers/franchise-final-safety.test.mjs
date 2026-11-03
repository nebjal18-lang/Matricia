import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fixtureState, sourceCandidate } from './franchise-final-support.mjs';

test('Franchise browser tooling refuses a production invocation before reading a private state', async () => {
  const saved = process.env.APP_ENV;
  try { process.env.APP_ENV = 'production'; await assert.rejects(fixtureState(), /EXPLICIT_DEVELOPMENT_REQUIRED/); }
  finally { if (saved === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = saved; }
});
test('Franchise browser tooling requires a coordinated invocation even in development', async () => {
  const saved = process.env.APP_ENV;
  try { process.env.APP_ENV = 'development'; await assert.rejects(fixtureState(), /COORDINATED_FRANCHISE_RECIPE_REQUIRED/); }
  finally { if (saved === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = saved; }
});
test('Franchise browser tooling refuses an implicit or missing product candidate', async () => {
  await assert.rejects(sourceCandidate(), /EXPLICIT_INTEGRATED_CANDIDATE_SHA_REQUIRED/);
});

test('the outage command requires an additional exclusive-coordination flag before any fixture access', () => {
  const run = spawnSync(process.execPath, ['tests/e2e/helpers/franchise-final-outage.mjs'], { encoding: 'utf8', timeout: 5000 });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /EXCLUSIVE_COORDINATED_OWNED_REST_OUTAGE_REQUIRED/);
});

test('the identity outage also refuses execution before exclusive coordination', () => {
  const run = spawnSync(process.execPath, ['tests/e2e/helpers/franchise-final-auth-outage.mjs'], { encoding: 'utf8', timeout: 5000 });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /EXCLUSIVE_COORDINATED_OWNED_AUTH_OUTAGE_REQUIRED/);
});

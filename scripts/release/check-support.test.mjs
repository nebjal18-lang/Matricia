import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { corepackCommand, parseVitestSummary } from './check-support.mjs';

test('Vitest 5 summaries count test results only, regardless of ordering or workspace prefix', () => {
  const output = 'web:test: Test Files  1 failed | 2 passed | 1 skipped (4)\nweb:test: Tests  5 failed | 10 passed | 3 skipped | 2 todo (20)\ndomain:test: Test Files  1 skipped (1)\ndomain:test: Tests  4 passed | 2 skipped (6)';
  assert.deepEqual(parseVitestSummary(output), { assertions: 14, failed: 5, skipped: 5, expectedFailures: 2 });
  assert.deepEqual(parseVitestSummary('\u001b[32m Tests  10 passed (10)\u001b[0m'), { assertions: 10, failed: 0, skipped: 0, expectedFailures: 0 });
  assert.equal(parseVitestSummary('Tests  3 skipped | 5 passed (8)').assertions, 5);
  assert.equal(parseVitestSummary('Test Files  5 passed (5)').assertions, 0);
  for (const text of ['Tests  5 passed (6)', 'Tests  2 passed | 3 passed (5)', 'Tests  1 passed']) assert.throws(() => parseVitestSummary(text));
});

test('Corepack launches a JS CLI through Node, including a path with spaces, without a cmd shim', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'corepack cli '));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const cli = join(directory, 'node_modules/corepack/dist/corepack.js');
  await mkdir(join(cli, '..'), { recursive: true });
  await writeFile(cli, 'console.log(JSON.stringify(process.argv.slice(2)))');
  const launch = await corepackCommand({ COREPACK_CLI_PATH: cli, PATH: '' });
  assert.equal(launch.command, process.execPath);
  const result = spawnSync(launch.command, [...launch.args, 'test', 'literal & value'], { shell: false, encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), ['pnpm', 'test', 'literal & value']);
});

test('actual release launcher rejects mixed failure summary even with exit zero and counts skips once', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'release parser '));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const args of [['init'], ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-m', 'fixture']]) {
    assert.equal(spawnSync('git', args, { cwd: directory, encoding: 'utf8' }).status, 0);
  }
  const cli = join(directory, 'corepack.js');
  for (const [summary, status, passed, skipped] of [
    ['Test Files 1 failed | 1 passed (2)\nTests 5 failed | 10 passed (15)', 1, 'failed', 0],
    ['Test Files 1 skipped (1)\nTests 2 skipped | 10 passed (12)', 1, 'failed', 2],
    ['Test Files 1 passed (1)\nTests 10 passed (10)', 0, 'passed', 0],
  ]) {
    await writeFile(cli, `console.log(${JSON.stringify(summary)})`);
    const result = spawnSync(process.execPath, [resolve('scripts/release/run-checks.mjs'), 'unit'], {
      cwd: directory, env: { ...process.env, COREPACK_CLI_PATH: cli }, encoding: 'utf8', timeout: 10000,
    });
    assert.equal(result.status, status);
    const report = JSON.parse(await readFile(join(directory, 'artifacts/test-results/acceptance/unit-summary.json'), 'utf8'));
    assert.equal(report.status, passed); assert.equal(report.skipped, skipped);
  }
});

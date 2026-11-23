import { corepackCommand, parseVitestSummary } from './check-support.mjs';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { sqlInventory, validateDatabaseEvidence } from '../db-test-support-safety.mjs';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
const definitions = { lint: ['lint'], typecheck: ['typecheck'], unit: ['-r', '--no-bail', 'test'], integration: ['test:integration'], database: ['test:db'], build: ['build'] };
const checks = process.argv.slice(2);
if (!checks.length || checks.some(key => !Object.hasOwn(definitions, key))) throw new Error('Pass explicit release checks: lint typecheck unit integration database build');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const directory = resolve('artifacts/test-results/acceptance'); await mkdir(directory, { recursive: true });
if (checks.includes('database') && process.env.DB_TEST_PATTERN) throw new Error('DB_RELEASE_FILTER_FORBIDDEN');
for (const name of checks) {
  const runId = randomUUID();
  const dbPath = resolve('docs/evidence', `release-db-${runId}.json`);
  const inventory = name === 'database' ? await sqlInventory(process.cwd()) : null;
  let databaseEvidence;
  const env = name === 'database' ? { ...process.env, DB_TEST_RUN_ID: runId, DB_TEST_EVIDENCE_PATH: dbPath } : process.env;
  const startedAt = new Date().toISOString();
  let output = '';
  const launcher = await corepackCommand();
  const child = spawn(launcher.command, [...launcher.args, ...definitions[name]], { stdio: ['ignore', 'pipe', 'pipe'], env });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { output += data.toString(); });
  const exitCode = await new Promise((done, reject) => { child.once('error', reject); child.once('exit', (code, signal) => signal ? reject(new Error('RELEASE_CHECK_INTERRUPTED')) : done(code ?? 1)); });
  const text = output.replace(/\u001b\[[0-9;]*m/g, '');
  let assertions = 1, skipped = 0, flaky = 0, expectedFailures = 0;
  if (name === 'unit') {
    try {
      const counts = parseVitestSummary(text);
      ({ assertions, skipped, expectedFailures } = counts);
      if (counts.failed > 0) assertions = 0;
    } catch { assertions = 0; }
  } else if (name === 'integration') {
    assertions = Number(text.match(/(?:ℹ|#) pass (\d+)/)?.[1] ?? 0);
    skipped = Number(text.match(/(?:ℹ|#) skipped (\d+)/)?.[1] ?? 0);
    expectedFailures = Number(text.match(/(?:ℹ|#) todo (\d+)/)?.[1] ?? 0);
    if (Number(text.match(/(?:ℹ|#) tests (\d+)/)?.[1] ?? 0) !== assertions) assertions = 0;
  } else if (name === 'database') {
    assertions = 0;
    try {
      databaseEvidence = JSON.parse(await readFile(dbPath, 'utf8'));
      const after = await sqlInventory(process.cwd());
      if (after.sha256 !== inventory.sha256) throw new Error('DB_SUITE_CHANGED');
      assertions = validateDatabaseEvidence(databaseEvidence, inventory, { commit, runId });
    } catch { databaseEvidence = undefined; }
    finally { await rm(dbPath, { force: true }); }
  }
  const passed = exitCode === 0 && assertions > 0 && skipped === 0 && flaky === 0 && expectedFailures === 0;
  const report = { schemaVersion: 1, databaseEvidence, commit, check: name, command: `corepack pnpm ${definitions[name].join(' ')}`, startedAt, finishedAt: new Date().toISOString(), status: passed ? 'passed' : 'failed', exitCode, assertions, skipped, flaky, expectedFailures, outputSha256: createHash('sha256').update(output).digest('hex') };
  // Do not persist raw command output: providers or fixtures may emit credentials.
  await writeFile(resolve(directory, `${name}-summary.json`), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(`${name}: ${report.status}; observations/assertions=${assertions}; skipped=${skipped}`);
  if (!passed) process.exit(exitCode || 1);
}

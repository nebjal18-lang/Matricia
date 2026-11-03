import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const definitions = { lint: ['lint'], typecheck: ['typecheck'], unit: ['-r', '--no-bail', 'test'], integration: ['test:integration'], database: ['test:db'], build: ['build'] };
const checks = process.argv.slice(2);
if (!checks.length || checks.some(key => !Object.hasOwn(definitions, key))) throw new Error('Pass explicit release checks: lint typecheck unit integration database build');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const directory = resolve('artifacts/test-results/acceptance'); await mkdir(directory, { recursive: true });
for (const name of checks) {
  const startedAt = new Date().toISOString();
  let output = '';
  const child = spawn('corepack', ['pnpm', ...definitions[name]], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { output += data.toString(); });
  const exitCode = await new Promise((done, reject) => { child.once('error', reject); child.once('exit', (code, signal) => signal ? reject(new Error('RELEASE_CHECK_INTERRUPTED')) : done(code ?? 1)); });
  const text = output.replace(/\u001b\[[0-9;]*m/g, '');
  let assertions = 1, skipped = 0, flaky = 0, expectedFailures = 0;
  if (name === 'unit') {
    assertions = [...text.matchAll(/Tests\s+(\d+) passed/g)].reduce((sum, match) => sum + Number(match[1]), 0);
    skipped = [...text.matchAll(/(\d+) skipped/g)].reduce((sum, match) => sum + Number(match[1]), 0);
    expectedFailures = [...text.matchAll(/(\d+) todo/g)].reduce((sum, match) => sum + Number(match[1]), 0);
  } else if (name === 'integration') {
    assertions = Number(text.match(/(?:ℹ|#) pass (\d+)/)?.[1] ?? 0);
    skipped = Number(text.match(/(?:ℹ|#) skipped (\d+)/)?.[1] ?? 0);
    expectedFailures = Number(text.match(/(?:ℹ|#) todo (\d+)/)?.[1] ?? 0);
    if (Number(text.match(/(?:ℹ|#) tests (\d+)/)?.[1] ?? 0) !== assertions) assertions = 0;
  } else if (name === 'database') assertions = Number(text.match(/DB tests passed: \d+ files, (\d+) assertions, 4 concurrency scenarios/)?.[1] ?? 0);
  const passed = exitCode === 0 && assertions > 0 && skipped === 0 && flaky === 0 && expectedFailures === 0;
  const report = { schemaVersion: 1, commit, check: name, command: `corepack pnpm ${definitions[name].join(' ')}`, startedAt, finishedAt: new Date().toISOString(), status: passed ? 'passed' : 'failed', exitCode, assertions, skipped, flaky, expectedFailures, outputSha256: createHash('sha256').update(output).digest('hex') };
  // Do not persist raw command output: providers or fixtures may emit credentials.
  await writeFile(resolve(directory, `${name}-summary.json`), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(`${name}: ${report.status}; observations/assertions=${assertions}; skipped=${skipped}`);
  if (!passed) process.exit(exitCode || 1);
}

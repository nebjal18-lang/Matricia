import { spawn } from 'node:child_process';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { corepackCommand } from './release/check-support.mjs';
import { resolveSafeDatabaseTarget } from './db-test-support-safety.mjs';

// Keep raw output in memory: test fixtures can print confidential configuration.
const root = process.cwd();
const directory = resolve(root, 'artifacts/test-results/application-validation', new Date().toISOString().replace(/[:.]/g, '-'));
await mkdir(directory, { recursive: true });
const results = [];
const launcher = await corepackCommand();
async function files(path) {
  const entries = await readdir(path, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory()
    ? files(resolve(path, entry.name)) : [resolve(path, entry.name)]))).flat();
}
const e2e = (await files(resolve(root, 'tests/e2e'))).filter(path => path.endsWith('.spec.ts'));
const sql = (await files(resolve(root, 'supabase/tests'))).filter(path => path.endsWith('.sql'));
const pages = (await files(resolve(root, 'apps/web/app'))).filter(path => /[\\/]page\.tsx$/.test(path));
const report = { startedAt: new Date().toISOString(), node: process.version,
  runtimeConformant: process.versions.node.split('.')[0] === '22',
  inventory: { e2eFiles: e2e.map(path => path.slice(root.length + 1)), sqlFiles: sql.map(path => path.slice(root.length + 1)),
    pages: pages.map(path => ({ file: path.slice(root.length + 1), behavioralCoverage: 'not-established-by-inventory' })) }, results };
async function save() {
  await writeFile(resolve(directory, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
}
async function run(name, args, extraEnv = {}) {
  const startedAt = new Date().toISOString();
  console.log(`${name}: running`);
  let output = '';
  const child = spawn(launcher.command, [...launcher.args, ...args], {
    cwd: root, env: { ...process.env, ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { output += data; });
  const exitCode = await new Promise(done => {
    child.once('error', () => done(1));
    child.once('exit', code => done(code ?? 1));
  });
  const clean = output.replace(/\u001b\[[0-9;]*m/g, '');
  const counts = clean.split(/\r?\n/).filter(line => /(?:Tests\s+\d|^\s*\d+ (?:passed|failed|skipped)|^# (?:tests|pass|fail|skipped)|^ℹ (?:tests|pass|fail|skipped))/.test(line));
  const incomplete = counts.some(line => /\b[1-9]\d* (?:skipped|todo)|\b(?:skipped|todo) [1-9]\d*/.test(line));
  const status = exitCode !== 0 ? 'failed' : incomplete ? 'incomplete' : 'passed';
  results.push({ name, args, startedAt, finishedAt: new Date().toISOString(), exitCode, status, counts });
  console.log(`${name}: ${status}`);
  await save();
}
function blocked(name, reason) { results.push({ name, status: 'blocked', reason }); }
await save();
for (const [name, args] of [
  ['lint', ['lint']], ['typecheck', ['typecheck']],
  ['unit', ['-r', '--no-bail', 'test']], ['integration', ['test:integration']],
  ['tooling', ['test:tooling']], ['phase00', ['verify:phase00']],
  ['placeholders', ['no-placeholders']], ['releaseStructure', ['release:structure']],
]) await run(name, args);
await run('publicE2E', ['exec', 'playwright', 'test',
  'tests/e2e/public-experience.spec.ts', 'tests/e2e/cookie-preferences.spec.ts',
  'tests/e2e/design-premium-public.spec.ts', 'tests/e2e/public-forms-runtime.spec.ts',
  'tests/e2e/refonte-sans-catalogue-public.spec.ts', 'tests/e2e/route-interaction-smoke.spec.ts', '--retries=0']);
if (['CLIENT', 'PROVIDER', 'FRANCHISE', 'ADMIN'].every(role => process.env[`E2E_${role}_STORAGE_STATE`])) {
  await run('authenticatedE2E', ['test:e2e:authenticated']);
} else blocked('authenticatedE2E', 'E2E_{CLIENT,PROVIDER,FRANCHISE,ADMIN}_STORAGE_STATE required');
blocked('mutationWorkflows', 'Dedicated test environment and per-workflow fixtures must be verified before execution');
try { resolveSafeDatabaseTarget(process.env); await run('database', ['test:db']); }
catch { blocked('database', 'Reserved local clone required; production is not a SQL test target'); }
await run('build', ['build']);
blocked('paymentEmailDelivery', 'External sandbox receipt and webhook evidence required');
blocked('backupRestore', 'Recent backup and verified restoration to a separate environment required');
report.finishedAt = new Date().toISOString();
report.status = results.every(result => result.status === 'passed') && report.runtimeConformant ? 'passed' : 'incomplete';
await save();
console.log(`Report: ${directory}`);
process.exitCode = report.status === 'passed' ? 0 : 1;

import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname, delimiter } from 'node:path';

const auditDir = fileURLToPath(new URL('.', import.meta.url));
const root = fileURLToPath(new URL('../../../', import.meta.url));
const tasks = {
  lint: 'corepack pnpm lint',
  typecheck: 'corepack pnpm typecheck',
  unit: 'corepack pnpm test',
  integration: 'corepack pnpm test:integration',
  tooling: 'corepack pnpm test:tooling',
  phase00: 'corepack pnpm verify:phase00',
  placeholders: 'corepack pnpm no-placeholders',
  release: 'corepack pnpm release:structure',
  build: 'corepack pnpm build',
  dependencies: 'corepack pnpm audit --json',
  'unit-failures': 'corepack pnpm --filter @matricia/web exec vitest run modules/franchise/screens/access-readiness.test.tsx modules/franchise/data/library/mandate-choices.test.tsx modules/franchise/data/network/provider-dossier.test.tsx modules/shared/lib/account-security/connected-space.test.ts',
  'typecheck-clean': 'corepack pnpm --filter @matricia/web exec tsc --noEmit --incremental false',
  runtime: 'corepack pnpm exec node --version',
};
const task = process.argv[2];
if (!Object.hasOwn(tasks, task)) throw new Error('Unknown audit task');
const sensitiveValues = Object.entries(process.env)
  .filter(([name, value]) => /(?:SECRET|TOKEN|PASSWORD|(?:^|_)KEY|DATABASE_URL|DIRECT_URL)/i.test(name) && value?.length >= 8)
  .map(([, value]) => value);
function redact(value) {
  let text = value.replace(/\u001b\[[0-9;]*m/g, '');
  for (const secret of sensitiveValues) text = text.split(secret).join('[REDACTED]');
  return text
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_JWT]')
    .replace(/(postgres(?:ql)?:\/\/)[^\s@]+@/gi, '$1[REDACTED]@')
    .replace(/\b(?:sb_secret_|sbp_|sk_live_|sk_test_)[A-Za-z0-9_-]+/g, '[REDACTED_KEY]');
}
await mkdir(join(auditDir, 'evidence'), { recursive: true });
const startedAt = new Date().toISOString();
const start = Date.now();
const corepackCommand = execFileSync('where.exe', ['corepack.cmd'], { encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/)[0];
const corepackCli = join(dirname(corepackCommand), 'node_modules/corepack/dist/corepack.js');
const commandEnv = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' };
const originalPath = process.env.Path || process.env.PATH;
for (const key of Object.keys(commandEnv)) if (key.toLowerCase() === 'path') delete commandEnv[key];
commandEnv.Path = dirname(process.execPath) + delimiter + originalPath;
const child = spawn(process.execPath, [corepackCli, ...tasks[task].split(' ').slice(1)], {
  cwd: root, windowsHide: true, env: commandEnv,
  stdio: ['ignore', 'pipe', 'pipe'],
});
const output = [];
child.stdout.on('data', chunk => output.push(chunk.toString()));
child.stderr.on('data', chunk => output.push(chunk.toString()));
child.on('error', error => output.push(`SPAWN_ERROR: ${error.message}\n`));
const exitCode = await new Promise(resolve => child.on('close', resolve));
const result = {
  task, command: tasks[task], startedAt, finishedAt: new Date().toISOString(),
  durationMs: Date.now() - start, exitCode, nodeVersion: process.version,
  scope: 'Current working tree including the two preserved staged corrections; no application source corrections by audit',
};
await writeFile(join(auditDir, 'evidence', `${task}.log`), redact(output.join('')));
await writeFile(join(auditDir, 'evidence', `${task}.json`), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
console.log(redact(output.join('')).split(/\r?\n/).slice(-45).join('\n'));
process.exitCode = exitCode ?? 1;

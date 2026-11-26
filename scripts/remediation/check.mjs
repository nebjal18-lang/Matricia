import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, delimiter } from 'node:path';

if (process.versions.node.split('.')[0] !== '22') throw new Error('Run this verification with Node22');
const root = fileURLToPath(new URL('../../', import.meta.url));
const outputDir = join(root, 'docs/evidence/remediation-20261119');
const task = process.argv[2];
if (!task || !/^[a-z0-9-]+$/.test(task) || process.argv.length < 4) throw new Error('Expected safe evidence name and pnpm arguments');
const args = process.argv.slice(3);
const sourcePaths = ['apps', 'packages', 'scripts', 'supabase', 'tests', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', '.github'];
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
async function sourceIdentity() {
  const commit = git(['rev-parse', 'HEAD']).trim();
  const hash = createHash('sha256').update(commit).update(git(['diff', '--binary', 'HEAD', '--', ...sourcePaths]));
  const paths = git(['ls-files', '--others', '--exclude-standard', '-z', '--', ...sourcePaths]).split('\0').filter(Boolean).sort();
  for (const path of paths) {
    // Environment files never enter diagnostics or evidence collection.
    if (/(?:^|\/)\.env(?:\.|$)/.test(path)) continue;
    hash.update(path).update(await readFile(join(root, path)));
  }
  return { commit, sourceSha256: hash.digest('hex') };
}
const sensitiveValues = Object.entries(process.env).filter(([key, value]) => /SECRET|TOKEN|PASSWORD|(?:^|_)KEY|DATABASE_URL|DIRECT_URL/i.test(key) && value?.length >= 8).map(([, value]) => value);
const redact = value => {
  let result = value.replace(/\u001b\[[0-9;]*m/g, '');
  for (const secret of sensitiveValues) result = result.split(secret).join('[REDACTED]');
  return result.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_JWT]').replace(/(postgres(?:ql)?:\/\/)[^\s@]+@/gi, '$1[REDACTED]@').replace(/\b(?:sb_secret_|sbp_|sk_live_|sk_test_)[A-Za-z0-9_-]+/g, '[REDACTED_KEY]');
};
const corepack = execFileSync('where.exe', ['corepack.cmd'], { encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/)[0];
const env = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' };
const path = process.env.Path || process.env.PATH;
for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') delete env[key];
env.Path = dirname(process.execPath) + delimiter + path;
await mkdir(outputDir, { recursive: true });
const startedAt = new Date().toISOString();
const sourceBefore = await sourceIdentity();
const output = [];
const child = spawn(process.execPath, [join(dirname(corepack), 'node_modules/corepack/dist/corepack.js'), 'pnpm', ...args], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.on('data', data => output.push(data.toString()));
child.stderr.on('data', data => output.push(data.toString()));
child.on('error', error => output.push(error.message));
const exitCode = await new Promise(resolve => child.on('close', resolve));
const sourceAfter = await sourceIdentity();
const sourceUnchanged = sourceBefore.sourceSha256 === sourceAfter.sourceSha256;
const result = { task, command: ['pnpm', ...args], startedAt, finishedAt: new Date().toISOString(), nodeVersion: process.version, exitCode, sourceBefore, sourceAfter, sourceUnchanged };
await writeFile(join(outputDir, `${task}.log`), redact(output.join('')));
await writeFile(join(outputDir, `${task}.json`), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
console.log(redact(output.join('')).split(/\r?\n/).slice(-18).join('\n'));
process.exitCode = sourceUnchanged ? (exitCode ?? 1) : 1;

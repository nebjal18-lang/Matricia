import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname, delimiter } from 'node:path';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const evidence = fileURLToPath(new URL('./evidence/', import.meta.url));
const suite = process.argv[2] ?? 'integrity';
const files = { integrity: 'tests/e2e/public/diagnostic-need-integrity.spec.ts', legacy: 'tests/e2e/refonte-sans-catalogue-public.spec.ts' };
if (!Object.hasOwn(files, suite)) throw new Error('Unknown audit suite');
const command = `corepack pnpm exec playwright test ${files[suite]} --workers=2 --reporter=json --output docs/audits/2026-11-19-audit-360-b578c75c/evidence/e2e-${suite}-artifacts`;
const startedAt = new Date().toISOString();
const child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', command], { cwd: root, windowsHide: true,
  env: { ...process.env, PATH: dirname(process.execPath) + delimiter + process.env.PATH,
    E2E_EXTERNAL_SERVER: '1', E2E_BASE_URL: 'http://127.0.0.1:5175', PLAYWRIGHT_VIDEO: 'off',
    PLAYWRIGHT_JSON_OUTPUT_FILE: join(evidence, `e2e-${suite}-report.json`), NO_COLOR: '1', FORCE_COLOR: '0' },
  stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
child.stdout.on('data', chunk => { output += chunk; });
child.stderr.on('data', chunk => { output += chunk; });
const exitCode = await new Promise(resolve => child.on('close', resolve));
await writeFile(join(evidence, `e2e-${suite}.log`), output);
const metadata = { command, startedAt, finishedAt: new Date().toISOString(), nodeVersion: process.version, exitCode,
  scope: 'Anonymous FR/AR desktop+360 on isolated Node22 source checkout; integrity suite explicitly asserts no mutation requests' };
await writeFile(join(evidence, `e2e-${suite}.json`), JSON.stringify(metadata, null, 2));
console.log(JSON.stringify(metadata)); console.log(output.split(/\r?\n/).slice(-15).join('\n'));
process.exitCode = exitCode ?? 1;

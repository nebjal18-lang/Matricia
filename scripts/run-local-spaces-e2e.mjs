import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

if (process.versions.node.split('.')[0] !== '22') throw new Error('LOCAL_E2E_REQUIRES_NODE_22');
const mode = process.argv[2] ?? '--authenticated-route-smoke-only';
if (process.argv.length > 3 || !['--configuration-only', '--local-fixture-proofs-only', '--authenticated-route-smoke-only', '--local-auth-ui-only', '--all-workflows', '--marketing-only', '--marketing-spaces-only', '--business-spaces-only'].includes(mode)) throw new Error('LOCAL_E2E_MODE_INVALID');
const root = resolve(import.meta.dirname, '..');
const child = spawn(process.execPath, [resolve(root, 'tests/e2e/helpers/p24-p26-completion-run.mjs'), ...(mode === '--all-workflows' ? [] : [mode])], {
  cwd: root, windowsHide: true, stdio: 'inherit',
  env: {...process.env, PLAYWRIGHT_VIDEO:process.env.PLAYWRIGHT_VIDEO??'off', APP_ENV:'development', E2E_LOCAL_ISOLATED:'1', E2E_LOCAL_AUTO_CONFIG:'1', E2E_LOCAL_PROJECT_ID:'Matricia'},
});
child.once('error', () => { console.error('LOCAL_E2E_START_FAILED'); process.exitCode = 1; });
child.once('exit', code => { process.exitCode = code ?? 1; });

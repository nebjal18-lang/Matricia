import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const execute = promisify(execFile);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const auditDir = fileURLToPath(new URL('.', import.meta.url));
const runtimePath = join(auditDir, 'evidence/isolated-web.json');
const sha = 'b578c75c1c0f076c7fb46b0239d7ab5f2b0afc4c';
const env = { ...process.env, PATH: dirname(process.execPath) + delimiter + process.env.PATH };
if (process.argv[2] === 'prepare') {
  const snapshot = await mkdtemp(join(tmpdir(), 'matricia-audit-b578c75c-'));
  await execute('git', ['worktree', 'add', '--detach', snapshot, sha], { cwd: root, windowsHide: true });
  const startedAt = new Date().toISOString();
  const install = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'corepack pnpm install --offline --frozen-lockfile'], {
    cwd: snapshot, windowsHide: true, env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  install.stdout.on('data', value => { output += value; });
  install.stderr.on('data', value => { output += value; });
  const exitCode = await new Promise(resolve => install.on('close', resolve));
  await writeFile(join(auditDir, 'evidence/isolated-install.log'), output);
  const metadata = { snapshot, sha, startedAt, finishedAt: new Date().toISOString(), nodeVersion: process.version,
    installCommand: 'corepack pnpm install --offline --frozen-lockfile', exitCode,
    includesStagedLocalCorrections: false, applicationFilesModifiedByAuditor: false,
  };
  await writeFile(runtimePath, JSON.stringify(metadata, null, 2));
  console.log(JSON.stringify(metadata));
  console.log(output.split(/\r?\n/).slice(-18).join('\n'));
  process.exitCode = exitCode ?? 1;
} else if (process.argv[2] === 'serve') {
  const metadata = JSON.parse(await readFile(runtimePath, 'utf8'));
  if (metadata.exitCode !== 0 || metadata.sha !== sha) throw new Error('Isolated installation is not ready');
  const { stdout } = await execute(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'corepack pnpm exec supabase status --output json'], { cwd: root, windowsHide: true });
  const local = JSON.parse(stdout.slice(stdout.indexOf('{')));
  if (new URL(local.API_URL).hostname !== '127.0.0.1') throw new Error('Only local Supabase is permitted');
  const safeEnv = { ...env, APP_ENV: 'development',
    NEXT_PUBLIC_SUPABASE_URL: local.API_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY, NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:5175',
    PAYMENT_PROVIDER: 'DEMO', PAYMENT_PROVIDER_ALLOWLIST: 'DEMO', PAYMENT_LIVE_ENABLED: 'false',
    EMAIL_DELIVERY_MODE: 'DEMO', EMAIL_LIVE_DELIVERY_ENABLED: 'false',
    MARKETING_PUBLISH_MODE: 'sandbox', MARKETING_LIVE_PUBLISHING_ENABLED: 'false',
    MATRICIA_DEMO_ACCESS_ENABLED: 'false',
  };
  const webRoot = join(metadata.snapshot, 'apps/web');
  const require = createRequire(join(webRoot, 'package.json'));
  const next = require.resolve('next/dist/bin/next');
  const child = spawn(process.execPath, [next, 'dev', '--port', '5175', '--hostname', '127.0.0.1'], {
    cwd: webRoot, env: safeEnv, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const secrets = [local.ANON_KEY, local.SERVICE_ROLE_KEY].filter(Boolean);
  let output = '';
  const emit = chunk => {
    let text = chunk.toString();
    for (const value of secrets) text = text.split(value).join('[REDACTED]');
    text = text.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_JWT]');
    output += text; process.stdout.write(text);
  };
  child.stdout.on('data', emit); child.stderr.on('data', emit);
  const exitCode = await new Promise(resolve => child.on('close', resolve));
  await writeFile(join(auditDir, 'evidence/isolated-server.log'), output);
  process.exitCode = exitCode ?? 1;
} else throw new Error('Use prepare or serve');

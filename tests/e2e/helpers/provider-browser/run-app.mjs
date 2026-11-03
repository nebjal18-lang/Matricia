if (!process.argv.includes('--coordinated')) throw new Error('ORCHESTRATOR_COORDINATED_STAGE_REQUIRED');
import { requireDevelopment, loadOwnState } from './safety.mjs';
requireDevelopment();
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { candidateSnapshot } from './candidate.mjs';
const pin=await candidateSnapshot(process.argv.find(arg=>arg.startsWith('--candidate='))?.slice(12));
const s = await loadOwnState();
if(!s.candidate||s.candidate.appTree!==pin.appTree||JSON.stringify(s.candidate.migrations)!==JSON.stringify(pin.migrations))throw Error('PINNED_PROVIDER_CANDIDATE_REQUIRED');
const production = process.argv.includes('--production');
const env = { ...process.env, NODE_ENV: production ? 'production' : 'development', APP_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${s.gatewayPort}`, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: s.anonKey, SUPABASE_SERVICE_ROLE_KEY: s.serviceKey, NEXT_PUBLIC_APP_URL: 'https://matricia.test.invalid', PAYMENT_PROVIDER: 'DEMO', PAYMENT_PROVIDER_ALLOWLIST: 'DEMO', PAYMENT_LIVE_ENABLED: 'false', PAYMENT_WEBHOOK_SECRET_DEMO: randomBytes(32).toString('hex'), APP_ENCRYPTION_KEY: randomBytes(32).toString('hex'), CRON_SECRET: randomBytes(32).toString('hex'), INTERNAL_WEBHOOK_SECRET: randomBytes(32).toString('hex') };
const next = resolve('apps/web/node_modules/next/dist/bin/next');
async function run(args) {
    const child = spawn(process.execPath, [next, ...args], { cwd: resolve('apps/web'), env, stdio: 'inherit' });
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 1)); });
    if (code !== 0) process.exit(code);
}
if (production) await run(['build', '--webpack']);
await run([production ? 'start' : 'dev', ...(production ? [] : ['--webpack']), '--hostname', '127.0.0.1', '--port', String(s.appPort)]);

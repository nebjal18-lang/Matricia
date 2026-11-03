import { fixtureState, sourceCandidate } from './franchise-final-support.mjs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
const state = await fixtureState(), pin = await sourceCandidate();
const production = process.argv.includes('--production'), buildOnly = process.argv.includes('--build-only'), startOnly = process.argv.includes('--start-only');
if ((buildOnly || startOnly) && !production || buildOnly && startOnly) throw Error('EXPLICIT_OPTIMIZED_BUILD_OR_START_REQUIRED');
if (!buildOnly && JSON.stringify(state.candidate.migrations) !== JSON.stringify(pin.migrations)) throw Error('REVIEWED_EXACT_DATABASE_SCHEMA_REQUIRED');
const env = { ...process.env, NODE_ENV: production ? 'production' : 'development', APP_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${state.gatewayPort}`, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: state.anonKey, SUPABASE_SERVICE_ROLE_KEY: state.serviceKey, NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${state.appPort}`, PAYMENT_PROVIDER: 'DEMO', PAYMENT_PROVIDER_ALLOWLIST: 'DEMO', PAYMENT_LIVE_ENABLED: 'false', PAYMENT_WEBHOOK_SECRET_DEMO: randomBytes(32).toString('hex'), APP_ENCRYPTION_KEY: randomBytes(32).toString('hex'), CRON_SECRET: randomBytes(32).toString('hex'), INTERNAL_WEBHOOK_SECRET: randomBytes(32).toString('hex') };
const next = resolve('apps/web/node_modules/next/dist/bin/next');
async function run(args) {
  const child = spawn(process.execPath, [next, ...args], { cwd: resolve('apps/web'), env, stdio: 'inherit' });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 1)); });
  if (code !== 0) process.exit(code);
}
console.log(JSON.stringify({ scope: 'LOCAL_FRANCHISE_NATIVE_BROWSER', candidate: pin.commit, appTree: pin.appTree, productionBuild: production, buildOnly, startOnly, hostedCertification: false }));
if (production && !startOnly) await run(['build', '--webpack']);
if (!buildOnly) await run([production ? 'start' : 'dev', ...(production ? [] : ['--webpack']), '--hostname', '127.0.0.1', '--port', String(state.appPort)]);

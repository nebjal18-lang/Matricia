import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { loadSafeConfiguration } from './environment.mjs';

const root = process.cwd();
try {
  const config = await loadSafeConfiguration(root);
  if (!config.localDockerVerified || config.runtimeMode !== 'isolated-local-docker') throw new Error('LOCAL_SERVER_CONFIGURATION_REQUIRED');
  const child = spawn(process.execPath, [resolve(root, 'apps/web/node_modules/next/dist/bin/next'), 'dev', '--port', '5173'], {
    cwd: resolve(root, 'apps/web'), windowsHide: true, stdio: 'inherit',
    env: { ...process.env, APP_ENV: 'development',
      NEXT_PUBLIC_SUPABASE_URL: config.supabaseUrl, SUPABASE_URL: config.supabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: config.publishableKey, SUPABASE_SERVICE_ROLE_KEY: config.serviceRoleKey,
      DIRECT_URL: config.databaseUrl, SUPABASE_DB_POOLER_URL: '', NEXT_PUBLIC_APP_URL: config.baseUrl,
      PAYMENT_PROVIDER: 'DEMO', PAYMENT_PROVIDER_ALLOWLIST: 'DEMO', PAYMENT_LIVE_ENABLED: 'false',
      EMAIL_DELIVERY_MODE: 'DEMO', EMAIL_LIVE_DELIVERY_ENABLED: 'false', MARKETING_PUBLISH_MODE: 'sandbox', MARKETING_LIVE_PUBLISHING_ENABLED: 'false' },
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
  child.once('error', () => { console.error('LOCAL_SERVER_START_FAILED'); process.exitCode = 1; });
  child.once('exit', code => { process.exitCode = code ?? 1; });
} catch { console.error('LOCAL_SERVER_CONFIGURATION_FAILED'); process.exitCode = 1; }

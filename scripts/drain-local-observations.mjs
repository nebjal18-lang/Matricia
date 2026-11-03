#!/usr/bin/env node
// Process only existing MFA audit observations through the real worker and HTTP
// consumer. This is a local maintenance command, never a business-event replay.
import { createRequire, register } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { loadSafeConfiguration, resolveExpectedDatabaseUrl } from './p05-e2e/environment.mjs';

if (process.env.APP_ENV !== 'development' || process.env.E2E_LOCAL_ISOLATED !== '1'
    || process.env.E2E_LOCAL_PROJECT_ID !== 'Matricia') throw new Error('LOCAL_OBSERVATION_DRAIN_REQUIRES_ISOLATED_DEVELOPMENT');
process.umask(0o077);
const root = resolve(import.meta.dirname, '..');
const configuration = await loadSafeConfiguration(root);
if (configuration.runtimeMode !== 'isolated-local-docker' || !configuration.localDockerVerified) throw new Error('LOCAL_OBSERVATION_DRAIN_TARGET_INVALID');
const requireWorker = createRequire(resolve(root, 'apps/worker/package.json'));
const { createClient } = requireWorker('@supabase/supabase-js');
register(new URL('../tests/integration/typescript-resolution.mjs', import.meta.url), import.meta.url);
const { createSupabaseOutboxRepository } = await import('../apps/worker/src/outbox-repository.ts');
const { createWorkerDispatcher } = await import('../apps/worker/src/dispatcher.ts');
const { pollOutboxOnce } = await import('../apps/worker/src/poller.ts');
const { createDocumentScanOutboxConsumer } = await import('../apps/worker/src/client-compliance/outbox-consumer.ts');
const allowed = new Set(['UserMfaEnrolledV1', 'UserMfaVerificationRequestedV1']);
const sql = postgres(resolveExpectedDatabaseUrl(configuration), { max: 1, prepare: false });
const report = { environment: 'development-local', operation: 'existing-mfa-observations-only', status: 'failed', startedAt: new Date().toISOString(), cleanup: 'pending' };
let server;
try {
  const groups = await sql`select event_type,count(*)::integer count from public.event_outbox where published_at is null and dead_lettered_at is null group by event_type`;
  const count = groups.reduce((total, group) => total + group.count, 0);
  if (groups.some(group => !allowed.has(group.event_type)) || count > 50) throw new Error('LOCAL_OBSERVATION_DRAIN_SCOPE_REJECTED');
  if (count > 0) {
    // Refuse an existing application process rather than restart somebody's UI.
    const probe = createServer();
    probe.listen(5173, '127.0.0.1');
    await once(probe, 'listening');
    await new Promise((done, reject) => probe.close(error => error ? reject(error) : done()));
    const secret = randomBytes(32).toString('hex');
    server = spawn('corepack', ['pnpm', '--filter', '@matricia/web', 'dev'], {
      cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'development', INTERNAL_WEBHOOK_SECRET: secret,
        NEXT_PUBLIC_SUPABASE_URL: configuration.supabaseUrl,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: configuration.publishableKey,
        SUPABASE_SERVICE_ROLE_KEY: configuration.serviceRoleKey },
    });
    // Consume process output without persisting provider or application payloads.
    server.stdout.on('data', () => {}); server.stderr.on('data', () => {});
    let available = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (server.exitCode !== null) throw new Error('LOCAL_OBSERVATION_APP_START_FAILED');
      try {
        const response = await fetch('http://127.0.0.1:5173/api/readiness', { signal: AbortSignal.timeout(2_000), redirect: 'error' });
        if ([200, 503].includes(response.status) && ['ready', 'degraded', 'not_ready'].includes((await response.json()).status)) { available = true; break; }
      } catch { /* bounded local startup */ }
      await new Promise(done => setTimeout(done, 1_000));
    }
    if (!available) throw new Error('LOCAL_OBSERVATION_APP_UNAVAILABLE');
    const client = createClient(configuration.supabaseUrl, configuration.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const repository = createSupabaseOutboxRepository(client);
    const guardedRepository = { ...repository, async claim(workerId, limit) {
      const events = await repository.claim(workerId, limit);
      if (events.some(event => !allowed.has(event.eventType))) {
        for (const event of events) await repository.recordFailure(event.id, workerId, 'LOCAL_OBSERVATION_DRAIN_SCOPE_REJECTED');
        throw new Error('LOCAL_OBSERVATION_DRAIN_SCOPE_REJECTED');
      }
      return events;
    } };
    const dispatcher = createWorkerDispatcher({
      dispatchUrl: new URL('http://127.0.0.1:5173/api/internal/outbox'), webhookSecret: secret,
      documentScanConsumer: createDocumentScanOutboxConsumer(async () => { throw new Error('LOCAL_OBSERVATION_DOCUMENT_FORBIDDEN'); }),
    });
    report.result = await pollOutboxOnce(guardedRepository, dispatcher, randomUUID(), count);
    if (report.result.failed || report.result.published !== count) throw new Error('LOCAL_OBSERVATION_CONSUMPTION_FAILED');
  } else report.result = { claimed: 0, published: 0, failed: 0 };
  const [remaining] = await sql`select count(*)::integer count from public.event_outbox where published_at is null and dead_lettered_at is null`;
  report.remaining = remaining.count;
  if (remaining.count !== 0) throw new Error('LOCAL_OBSERVATION_QUEUE_NOT_EMPTY');
  report.status = 'passed';
} catch (error) {
  report.failure = /^LOCAL_OBSERVATION_[A-Z_]+$/.test(error.message) ? error.message : 'LOCAL_OBSERVATION_DRAIN_FAILED';
  process.exitCode = 1;
} finally {
  if (server?.pid) {
    try { process.kill(-server.pid, 'SIGTERM'); }
    catch (error) { if (error.code !== 'ESRCH') { report.cleanup = 'failed'; process.exitCode = 1; } }
    await Promise.race([once(server, 'exit').catch(() => {}), new Promise(done => setTimeout(done, 5_000))]);
  }
  await sql.end();
  report.cleanup = report.cleanup === 'failed' ? 'failed' : 'passed';
  report.finishedAt = new Date().toISOString();
  await mkdir(resolve(root, 'work/delivery-validation'), { recursive: true, mode: 0o700 });
  await writeFile(resolve(root, 'work/delivery-validation/local-observation-drain.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify(report));
}

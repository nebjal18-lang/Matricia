import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export function validateApiPlan(plan) {
  const url = new URL(plan?.origin);
  if (plan.environment !== 'staging' || url.origin !== plan.expectedOrigin || url.origin === plan.productionOrigin || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('API_PERFORMANCE_TARGET_INVALID');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('API_PERFORMANCE_HTTPS_REQUIRED');
  if (!Array.isArray(plan.paths) || !plan.paths.length || plan.paths.some(path => typeof path !== 'string' || !path.startsWith('/api/') || /[?#]|\.\.|\/\//.test(path) || /^\/api\/(workers|internal|webhooks|payments)(\/|$)/.test(path))) throw new Error('API_PERFORMANCE_READ_ONLY_PATH_REQUIRED');
  if (!Number.isSafeInteger(plan.samples) || plan.samples < 20 || plan.samples > 100) throw new Error('API_PERFORMANCE_SAMPLE_COUNT_INVALID');
  return url.origin;
}
export function percentile95(values) {
  if (!values.length || values.some(value => !Number.isFinite(value) || value < 0)) throw new Error('API_PERFORMANCE_MEASUREMENTS_INVALID');
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.ceil(ordered.length * 0.95) - 1];
}
async function main() {
  const plan = JSON.parse(await readFile(resolve(process.argv[2] ?? 'docs/release/api-performance-plan.json'), 'utf8'));
  const origin = validateApiPlan(plan), startedAt = new Date().toISOString(), measurements = [];
  for (const path of plan.paths) {
    const values = [];
    for (let index = 0; index < plan.samples; index++) {
      const start = performance.now();
      const response = await fetch(origin + path, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(10000), ...(process.env.PERF_BEARER_TOKEN ? { headers: { authorization: `Bearer ${process.env.PERF_BEARER_TOKEN}` } } : {}) });
      if (response.status !== 200) throw new Error('API_PERFORMANCE_HTTP_FAILURE');
      const reader = response.body?.getReader(); let bytes = 0;
      if (reader) try { for (;;) { const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.length; if (bytes > 65536) throw new Error('API_PERFORMANCE_RESPONSE_TOO_LARGE'); } } finally { await reader.cancel(); }
      values.push(performance.now() - start);
    }
    const p95Ms = percentile95(values);
    measurements.push({ path, samples: values.length, p95Ms, maxMs: Math.max(...values), passed: p95Ms < 500 });
  }
  const passed = measurements.every(item => item.passed);
  const report = { schemaVersion: 1, check: 'performanceApi', environment: ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname) ? 'development-local' : 'staging', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), command: 'node scripts/performance/api-latency.mjs <verified-staging-plan>', status: passed ? 'passed' : 'failed', exitCode: passed ? 0 : 1, assertions: measurements.length, startedAt, finishedAt: new Date().toISOString(), skipped: 0, flaky: 0, expectedFailures: 0, kind: 'controlled-read-only-api-not-external-provider-latency', measurements };
  await mkdir('artifacts/test-results/acceptance', { recursive: true });
  await writeFile('artifacts/test-results/acceptance/api-performance-summary.json', JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(`API performance: ${measurements.length} routes, ${passed ? 'PASS' : 'FAIL'}`);
  if (!passed) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

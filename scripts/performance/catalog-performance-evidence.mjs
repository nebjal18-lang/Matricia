import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { runGate, validateConfiguration } from './catalog-load-gate.mjs';
const config = validateConfiguration(process.env);
if (config.environment !== 'staging' || ![6000, 50000].every(size => config.sizes.includes(size))) throw new Error('RELEASE_CATALOG_FULL_STAGING_SIZES_REQUIRED');
const startedAt = new Date().toISOString();
const result = await runGate(config);
const report = { schemaVersion: 1, check: 'performanceCatalog', environment: config.environment,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  command: 'node scripts/performance/catalog-performance-evidence.mjs',
  status: result.passed ? 'passed' : 'failed', exitCode: result.passed ? 0 : 1,
  assertions: result.scenarios.length, skipped: 0, flaky: 0, expectedFailures: 0,
  startedAt, finishedAt: new Date().toISOString(), result };
await mkdir('artifacts/test-results/acceptance', { recursive: true });
await writeFile('artifacts/test-results/acceptance/catalog-performance-summary.json', JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
console.log(`Catalogue staging: ${result.scenarios.length} scénarios, ${result.passed ? 'PASS' : 'FAIL'}`);
if (!result.passed) process.exitCode = 1;

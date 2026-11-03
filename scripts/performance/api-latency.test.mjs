import test from 'node:test';
import assert from 'node:assert/strict';
import { percentile95, validateApiPlan } from './api-latency.mjs';
const plan = () => ({ environment: 'staging', origin: 'https://stage.example.invalid', expectedOrigin: 'https://stage.example.invalid', productionOrigin: 'https://prod.example.invalid', paths: ['/api/readiness'], samples: 20 });
test('read-only API plan is bounded and refuses mutation endpoints and production', () => {
  assert.equal(validateApiPlan(plan()), 'https://stage.example.invalid');
  for (const path of ['/api/workers/notifications', '/api/internal/outbox', '/api/payments/intents', '/api/readiness?secret=x', '//foreign.example/api']) assert.throws(() => validateApiPlan({ ...plan(), paths: [path] }));
  assert.throws(() => validateApiPlan({ ...plan(), samples: 0 }));
  assert.throws(() => validateApiPlan({ ...plan(), productionOrigin: plan().origin }));
});
test('p95 uses nearest-rank over nonempty real samples', () => {
  assert.equal(percentile95(Array.from({ length: 20 }, (_, i) => i + 1)), 19);
  assert.throws(() => percentile95([])); assert.throws(() => percentile95([NaN]));
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateMetrics, validatePlan } from './browser-vitals.mjs';
const plan = () => ({ environment: 'staging', origin: 'https://staging.example.invalid', expectedOrigin: 'https://staging.example.invalid', productionOrigin: 'https://production.example.invalid', routes: [{ path: '/fr', interaction: { type: 'click', selector: 'button' } }] });
test('performance plan requires exact staging identity, routes and real interactions', () => {
  assert.equal(validatePlan(plan()), 'https://staging.example.invalid');
  assert.throws(() => validatePlan({ ...plan(), environment: 'production' }));
  assert.throws(() => validatePlan({ ...plan(), expectedOrigin: 'https://other.example.invalid' }));
  assert.throws(() => validatePlan({ ...plan(), productionOrigin: plan().origin }));
  assert.throws(() => validatePlan({ ...plan(), routes: [] }));
});
test('missing metrics or interactions cannot turn into a passing zero', () => {
  assert.equal(evaluateMetrics({ lcpMs: 2400, cls: 0.09, interactions: 1, inpUpperBoundMs: 190 }), true);
  for (const failure of [{ lcpMs: 0 }, { lcpMs: 2600 }, { cls: 0.11 }, { interactions: 0 }, { inpUpperBoundMs: null }, { inpUpperBoundMs: 201 }]) {
    assert.equal(evaluateMetrics({ lcpMs: 2400, cls: 0.09, interactions: 1, inpUpperBoundMs: 190, ...failure }), false);
  }
});

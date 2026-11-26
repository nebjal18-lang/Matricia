import test from 'node:test';
import assert from 'node:assert/strict';

test('timeout diagnostics survive private browser artifact cleanup', async () => {
  const { summarizeBrowserReport } = await import('./browser-report.mjs');
  const report = { suites: [{ specs: [{ title: 'multiple surfaces', tests: [{ projectName: 'mobile', expectedStatus: 'passed', results: [{ status: 'timedOut', errors: [{ message: 'Test timeout of 30000ms exceeded.' }] }] }] }] }] };
  const summary = summarizeBrowserReport(report);
  assert.equal(summary.failed, 1);
  assert.equal(summary.failures[0].error, 'Test timeout of 30000ms exceeded.');
});

test('failed browser runs retain executed counts and sanitized actionable diagnostics', async () => {
  const { summarizeBrowserReport } = await import('./browser-report.mjs');
  const failed = { suites:[{specs:[{title:'FR client isolated',tests:[{projectName:'mobile',expectedStatus:'passed',results:[{status:'failed',errors:[{message:'Error: assertion failed\nLocator: user@example.invalid\nExpected pattern: /fr/client\nReceived string: http://localhost/?token=private-token'}]}]},{projectName:'desktop',expectedStatus:'passed',results:[{status:'passed'}]}]}]}] };
  const summary = summarizeBrowserReport(failed);
  assert.equal(summary.executed, 2);
  assert.equal(summary.failed, 1);
  assert.equal(summary.passed, 1);
  assert.equal(summary.skipped, 0);
  assert.match(summary.failures[0].error, /Expected pattern/);
  assert.doesNotMatch(JSON.stringify(summary), /user@example|private-token/);
});

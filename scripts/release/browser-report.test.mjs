import test from 'node:test';
import assert from 'node:assert/strict';

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

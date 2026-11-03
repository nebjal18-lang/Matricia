export function validateBrowserReport(report) {
  const stats = report?.stats;
  if (!stats || !Number.isInteger(stats.expected) || stats.expected <= 0 || stats.unexpected !== 0 || stats.flaky !== 0 || stats.skipped !== 0) throw new Error('BROWSER_ACCEPTANCE_COUNTS_INVALID');
  const tests = [];
  function visit(suite) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) tests.push(test);
    for (const child of suite.suites ?? []) visit(child);
  }
  for (const suite of report.suites ?? []) visit(suite);
  if (tests.length !== stats.expected || tests.some(test => test.expectedStatus !== 'passed' || test.results?.length !== 1 || test.results[0].status !== 'passed')) throw new Error('BROWSER_ACCEPTANCE_RESULT_INVALID');
  return tests.length;
}

export function summarizeBrowserReport(report) {
  const rows = [];
  function visit(suite) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) rows.push({ title: spec.title, project: test.projectName, test });
    for (const child of suite.suites ?? []) visit(child);
  }
  for (const suite of report?.suites ?? []) visit(suite);
  const clean = value => String(value ?? '').replace(/\u001b\[[0-9;]*m/gu,'').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu,'[email-redacted]').replace(/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/giu,'[uuid-redacted]').replace(/(?:Bearer\s+)?[A-Za-z0-9_-]{40,}/gu,'[token-redacted]').replace(/\b\d{6,8}\b/gu,'[code-redacted]').replace(/([?&](?:token|key|secret|code|session|state)=)[^\s&]+/giu,'$1[redacted]');
  const status = row => row.test.results?.at(-1)?.status;
  return {
    executed: rows.filter(row => row.test.results?.length && status(row) !== 'skipped').length,
    passed: rows.filter(row => status(row) === 'passed' && row.test.expectedStatus === 'passed').length,
    failed: rows.filter(row => ['failed','timedOut','interrupted'].includes(status(row))).length,
    skipped: rows.filter(row => status(row) === 'skipped' || !row.test.results?.length).length,
    flaky: rows.filter(row => row.test.results?.length > 1).length,
    failures: rows.filter(row => ['failed','timedOut','interrupted'].includes(status(row))).map(row => {
      const result = row.test.results.at(-1);
      const raw = result.errors?.[0]?.message ?? result.error?.message ?? '';
      const lines = clean(raw).split(/\r?\n/u).map(line => line.trim()).filter(line => /^(Error:|Locator:|Expected(?: pattern)?:|Received(?: string)?:|TimeoutError:)/u.test(line));
      return { title: clean(row.title).slice(0,200), project: clean(row.project).slice(0,80), error: (lines.length ? lines.slice(0,4).join(' | ') : 'Browser assertion failed').slice(0,600) };
    }),
  };
}

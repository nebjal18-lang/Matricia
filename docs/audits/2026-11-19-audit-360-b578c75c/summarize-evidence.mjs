import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const evidence = fileURLToPath(new URL('./evidence/', import.meta.url));
async function json(file) { try { return JSON.parse(await readFile(join(evidence, file), 'utf8')); } catch { return null; } }
const fr = await json('browser-fr-first-scan.json');
const ar = await json('browser-audit.json');
const pages = [...(fr?.pages ?? []), ...(ar?.pages ?? [])];
const protectedRoutes = [...(fr?.protectedRoutes ?? []), ...(ar?.protectedRoutes ?? [])];
const browser = {
  pages: pages.length, axeScans: pages.filter(p => p.axe).length,
  violations: pages.flatMap(p => (p.axe?.violations ?? []).map(v => ({ locale: p.locale, route: p.route, width: p.width, ...v }))),
  overflow: pages.filter(p => p.contentWidth > p.viewport).map(p => ({ locale: p.locale, route: p.route, width: p.width, contentWidth: p.contentWidth, elements: p.overflowingElements, screenshot: p.screenshot })),
  errors: pages.filter(p => p.status === 'NAVIGATION_ERROR' || p.httpStatus >= 400 || p.pageErrors?.length).map(p => ({ locale: p.locale, route: p.route, width: p.width, httpStatus: p.httpStatus, pageErrors: p.pageErrors, error: p.error })),
  protectedRoutes, keyboard: [...(fr?.keyboard ?? []), ...(ar?.keyboard ?? [])],
  caveats: ['FR keyboard probe aborted after gathering all FR pages due to its own name-changing locator; page scans retained', 'AR probe used corrected stable element handle', 'No authenticated pages scanned'],
};
const sql = await json('sql-all-files.json');
const e2e = await json('e2e-integrity-report.json');
const e2eFailures = [];
function visit(suite) {
  for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) for (const result of test.results ?? []) {
    if (result.status !== 'passed') e2eFailures.push({ file: spec.file, title: spec.title, project: test.projectName, status: result.status, error: result.error?.message?.replace(/\u001b\[[0-9;]*m/g, '').slice(0, 1300) });
  }
  for (const child of suite.suites ?? []) visit(child);
}
if (e2e) for (const suite of e2e.suites ?? []) visit(suite);
const result = { generatedAt: new Date().toISOString(), browser, e2e: e2e ? { stats: e2e.stats, failures: e2eFailures } : null,
  sql: sql ? { files: sql.files, passed: sql.passed, failed: sql.failed, errors: sql.errors, assertionsExecuted: sql.assertionsExecuted,
    failures: sql.records.filter(r => r.status !== 'PASS') } : { status: 'RUNNING' },
};
await writeFile(join(evidence, 'summary.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

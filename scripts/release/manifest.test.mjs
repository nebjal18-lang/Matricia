import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareManifest, REQUIRED_APPROVALS, REQUIRED_CHECKS, validateArtifacts, validateManifestShape } from './manifest.mjs';
import { validateBrowserReport } from './browser-report.mjs';
const commit = 'a'.repeat(40);
function passing() {
  const m = prepareManifest(commit), time = new Date().toISOString();
  m.authors = ['developer'];
  for (const row of Object.values(m.requirements)) Object.assign(row, { status: 'VERIFIED', reviewer: 'independent-reviewer', signoffReference: 'signed-acceptance' });
  for (const row of Object.values(m.checks)) Object.assign(row, { status: 'passed', exitCode: 0, assertions: 1, command: 'test command', startedAt: time, finishedAt: time, artifact: { path: 'proof.json', sha256: 'b'.repeat(64) } });
  for (const row of Object.values(m.approvals)) Object.assign(row, { status: 'approved', approvedBy: 'reviewer', approvedAt: time, reference: 'external-approval', artifact: { path: 'proof.json', sha256: 'b'.repeat(64) } });
  return m;
}
test('preparation never grants approval or invents passing evidence', () => {
  const m = prepareManifest(commit); assert.equal(Object.keys(m.requirements).length, 76);
  assert.ok(REQUIRED_CHECKS.every(name => m.checks[name].status === 'not_run'));
  assert.ok(REQUIRED_APPROVALS.every(name => m.approvals[name].status === 'not_approved'));
  assert.ok(validateManifestShape(m, { commit }).length > 76);
});
test('current candidate with complete evidence shape passes; wrong SHA, stale results and unclosed issues fail', () => {
  const m = passing(); assert.deepEqual(validateManifestShape(m, { commit }), []);
  assert.ok(validateManifestShape(m, { commit: 'c'.repeat(40) }).includes('RELEASE_COMMIT_MISMATCH'));
  m.generatedAt = '2000-01-01T00:00:00Z'; assert.ok(validateManifestShape(m, { commit }).includes('RELEASE_MANIFEST_EXPIRED'));
  m.openIssues.push({ priority: 'P2', status: 'open' }); assert.ok(validateManifestShape(m, { commit }).includes('RELEASE_OPEN_PRODUCT_ISSUES'));
});
test('zero counts, skipped, flaky, expected failure and self-review cannot certify a release', () => {
  const m = passing(); m.authors = ['reviewer']; m.checks.unit.assertions = 0; m.checks.e2ePublic.skipped = 1; m.checks.e2eAuthenticated.flaky = 1; m.checks.e2eWorkflows.expectedFailures = 1;
  const errors = validateManifestShape(m, { commit });
  for (const key of ['unit', 'e2ePublic', 'e2eAuthenticated', 'e2eWorkflows']) assert.ok(errors.includes(`CHECK_COUNTS_INVALID:${key}`));
  assert.ok(errors.includes('REVIEWER_NOT_INDEPENDENT:independentSecurity'));
});
test('evidence must match its bytes and stay inside the checkout, including symlink resolution', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'matricia-release-'));
  try {
    const root = join(directory, 'checkout'); await import('node:fs/promises').then(fs => fs.mkdir(root));
    const m = passing();
    const report = { schemaVersion: 1, environment: 'staging', commit, status: 'passed', exitCode: 0, assertions: 1, skipped: 0, flaky: 0, expectedFailures: 0, startedAt: m.checks.unit.startedAt, finishedAt: m.checks.unit.finishedAt };
    const approvalBytes = '{}';
    await writeFile(join(root, 'proof.json'), approvalBytes);
    for (const row of Object.values(m.approvals)) row.artifact.sha256 = createHash('sha256').update(approvalBytes).digest('hex');
    for (const [check, row] of Object.entries(m.checks)) {
      const bytes = JSON.stringify({ ...report, check });
      row.artifact.path = check + '.json'; row.artifact.sha256 = createHash('sha256').update(bytes).digest('hex');
      await writeFile(join(root, row.artifact.path), bytes);
    }
    await writeFile(join(directory, 'external.json'), JSON.stringify({ ...report, check: 'unit' }));
    assert.deepEqual(await validateArtifacts(m, root), []);
    await writeFile(join(root, 'unit.json'), '{"changed":true}'); assert.ok((await validateArtifacts(m, root)).length > 0);
    await symlink(join(directory, 'external.json'), join(root, 'escape.json')); m.checks.unit.artifact.path = 'escape.json';
    assert.ok((await validateArtifacts(m, root)).includes('EVIDENCE_UNAVAILABLE_OR_CHANGED:unit'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('browser acceptance rejects empty, skipped, flaky and expected-failure reports', () => {
  const report = { stats: { expected: 1, unexpected: 0, flaky: 0, skipped: 0 }, suites: [{ specs: [{ tests: [{ expectedStatus: 'passed', results: [{ status: 'passed' }] }] }] }] };
  assert.equal(validateBrowserReport(report), 1);
  assert.throws(() => validateBrowserReport({ ...report, stats: { ...report.stats, expected: 0 } }));
  assert.throws(() => validateBrowserReport({ ...report, stats: { ...report.stats, skipped: 1 } }));
  report.suites[0].specs[0].tests[0].expectedStatus = 'failed'; assert.throws(() => validateBrowserReport(report));
});

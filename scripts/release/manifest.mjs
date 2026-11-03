import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

export const REQUIRED_CHECKS = Object.freeze(['lint', 'typecheck', 'unit', 'integration', 'database', 'build', 'e2ePublic', 'e2eAuthenticated', 'e2eWorkflows', 'accessibility', 'performance', 'performanceApi', 'performanceCatalog', 'security', 'externalIntegrations', 'backupRestore']);
export const REQUIRED_STAGING_CHECKS = Object.freeze(['performance', 'performanceApi', 'performanceCatalog', 'security', 'externalIntegrations', 'backupRestore']);
export const REQUIRED_APPROVALS = Object.freeze(['independentQuality', 'independentSecurity', 'legalAccounting', 'clientAcceptance', 'operationsHandover']);
export const REQUIRED_IDS = Object.freeze([...Array.from({ length: 68 }, (_, i) => `MAT-FUNC-${String(i + 1).padStart(3, '0')}`), ...Array.from({ length: 8 }, (_, i) => `MARKETING-${String(i + 1).padStart(3, '0')}`)]);
const sha = /^[0-9a-f]{40}$/;
const digest = /^[0-9a-f]{64}$/;

export function validateManifestShape(manifest, { commit, now = Date.now(), maxAgeMs = 72 * 60 * 60 * 1000 } = {}) {
  const failures = [];
  if (manifest?.schemaVersion !== 1) return ['RELEASE_MANIFEST_SCHEMA_INVALID'];
  if (!sha.test(manifest.commit ?? '') || manifest.commit !== commit) failures.push('RELEASE_COMMIT_MISMATCH');
  if (manifest.environment !== 'staging') failures.push('RELEASE_STAGING_REQUIRED');
  const generated = Date.parse(manifest.generatedAt);
  if (!Number.isFinite(generated) || generated > now + 60_000 || now - generated > maxAgeMs) failures.push('RELEASE_MANIFEST_EXPIRED');
  for (const id of REQUIRED_IDS) {
    const row = manifest.requirements?.[id];
    if (row?.status !== 'VERIFIED' || row.commit !== commit || !row.reviewer?.trim() || !row.signoffReference?.trim()) failures.push(`REQUIREMENT_NOT_SIGNED:${id}`);
  }
  for (const name of REQUIRED_CHECKS) {
    const check = manifest.checks?.[name];
    if (check?.status !== 'passed' || check.commit !== commit || check.exitCode !== 0) failures.push(`CHECK_NOT_PASSED:${name}`);
    if (!Number.isSafeInteger(check?.assertions) || check.assertions <= 0 || check.skipped !== 0 || check.flaky !== 0 || check.expectedFailures !== 0) failures.push(`CHECK_COUNTS_INVALID:${name}`);
    const start = Date.parse(check?.startedAt), end = Date.parse(check?.finishedAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end > now + 60_000 || now - end > maxAgeMs) failures.push(`CHECK_TIME_INVALID:${name}`);
    if (!check?.command?.trim() || !check?.artifact?.path || !digest.test(check.artifact.sha256 ?? '')) failures.push(`CHECK_EVIDENCE_INVALID:${name}`);
  }
  if (!Array.isArray(manifest.authors) || manifest.authors.length === 0 || manifest.authors.some(author => typeof author !== 'string' || !author.trim())) failures.push('RELEASE_AUTHORS_REQUIRED');
  if (Object.keys(manifest.requirements ?? {}).length !== REQUIRED_IDS.length) failures.push('RELEASE_REQUIREMENT_SCOPE_INVALID');
  const authors = new Set(manifest.authors ?? []);
  for (const name of REQUIRED_APPROVALS) {
    const approval = manifest.approvals?.[name];
    if (approval?.status !== 'approved' || approval.commit !== commit || !approval.approvedBy?.trim() || !approval.reference?.trim() || !Number.isFinite(Date.parse(approval.approvedAt)) || Date.parse(approval.approvedAt) > now + 60_000 || !approval.artifact?.path || !digest.test(approval.artifact.sha256 ?? '')) failures.push(`APPROVAL_REQUIRED:${name}`);
    if (name.startsWith('independent') && authors.has(approval?.approvedBy)) failures.push(`REVIEWER_NOT_INDEPENDENT:${name}`);
  }
  if (!Array.isArray(manifest.openIssues) || manifest.openIssues.some(issue => ['P0', 'P1', 'P2'].includes(issue.priority) && issue.status !== 'closed')) failures.push('RELEASE_OPEN_PRODUCT_ISSUES');
  return failures;
}

export async function validateArtifacts(manifest, root) {
  const failures = [];
  const realRoot = await realpath(root);
  const evidence = [...REQUIRED_CHECKS.map(key => [key, manifest.checks?.[key]?.artifact]), ...REQUIRED_APPROVALS.map(key => [key, manifest.approvals?.[key]?.artifact])];
  for (const [name, artifact] of evidence) {
    try {
      if (!artifact || isAbsolute(artifact.path)) throw new Error('PATH');
      const target = await realpath(resolve(root, artifact.path));
      const rel = relative(realRoot, target);
      if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) throw new Error('PATH');
      const bytes = await readFile(target);
      const actual = createHash('sha256').update(bytes).digest('hex');
      if (actual !== artifact.sha256) throw new Error('DIGEST');
      if (REQUIRED_CHECKS.includes(name)) {
        const report = JSON.parse(bytes.toString('utf8'));
        const claimed = manifest.checks[name];
        if (REQUIRED_STAGING_CHECKS.includes(name) && report.environment !== 'staging') throw new Error('STAGING_EVIDENCE_REQUIRED');
        if (report.schemaVersion !== 1 || report.check !== name || report.commit !== manifest.commit || report.status !== 'passed' || report.exitCode !== 0 || report.assertions !== claimed.assertions || report.assertions <= 0 || report.skipped !== 0 || report.flaky !== 0 || report.expectedFailures !== 0 || report.startedAt !== claimed.startedAt || report.finishedAt !== claimed.finishedAt) throw new Error('REPORT');
      }
    } catch { failures.push(`EVIDENCE_UNAVAILABLE_OR_CHANGED:${name}`); }
  }
  return failures;
}

export function prepareManifest(commit) {
  return { schemaVersion: 1, commit, generatedAt: new Date().toISOString(), environment: 'staging', authors: [],
    requirements: Object.fromEntries(REQUIRED_IDS.map(id => [id, { status: 'NOT_REVIEWED', commit, reviewer: '', signoffReference: '' }])),
    checks: Object.fromEntries(REQUIRED_CHECKS.map(name => [name, { status: 'not_run', commit, exitCode: null, assertions: 0, skipped: 0, flaky: 0, expectedFailures: 0, command: '', startedAt: null, finishedAt: null, artifact: { path: '', sha256: '' } }])),
    approvals: Object.fromEntries(REQUIRED_APPROVALS.map(name => [name, { status: 'not_approved', commit, approvedBy: '', approvedAt: null, reference: '', artifact: { path: '', sha256: '' } }])), openIssues: [] };
}

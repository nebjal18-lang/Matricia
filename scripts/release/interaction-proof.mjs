import { createHash } from 'node:crypto';
export function inventoryRows(groups, commit) {
  const entries = [];
  for (const [category, rows] of Object.entries(groups)) for (const row of rows) {
    const identity = [category, row.file, row.line ?? '', row.name ?? '', row.kind ?? '', row.route].join(':');
    entries.push({ id: createHash('sha256').update(identity).digest('hex'), category, file: row.file, line: row.line ?? 1, route: row.route, sourceSha256: row.sourceSha256 });
  }
  return { schemaVersion: 1, commit, entries };
}
export function validateInteractionProof(proof, inventory) {
  const failures = [];
  if (proof?.schemaVersion !== 1 || proof.commit !== inventory.commit) return ['INTERACTION_PROOF_STALE_OR_INVALID'];
  const rows = new Map();
  for (const row of proof.entries ?? []) {
    if (rows.has(row.id)) failures.push('INTERACTION_PROOF_DUPLICATE:' + row.id);
    rows.set(row.id, row);
  }
  for (const entry of inventory.entries) {
    const row = rows.get(entry.id);
    if (!row || row.sourceSha256 !== entry.sourceSha256 || row.status !== 'passed' || row.skipped !== 0 || row.flaky !== 0 || !row.reviewer?.trim() || !row.testSource?.trim() || !row.scenario?.trim() || !row.artifact?.path || !/^[0-9a-f]{64}$/.test(row.artifact.sha256 ?? '')) failures.push('INTERACTION_RUNTIME_NOT_PROVEN:' + entry.id);
  }
  for (const id of rows.keys()) if (!inventory.entries.some(row => row.id === id)) failures.push('INTERACTION_PROOF_UNKNOWN:' + id);
  return failures;
}

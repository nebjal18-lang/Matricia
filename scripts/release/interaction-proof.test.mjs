import test from 'node:test';
import assert from 'node:assert/strict';
import { inventoryRows, validateInteractionProof } from './interaction-proof.mjs';
const commit = 'a'.repeat(40);
const inventory = () => inventoryRows({ interactions: [{ file: 'app/page.tsx', line: 10, kind: 'form', route: '/fr/form', sourceSha256: 'b'.repeat(64) }] }, commit);
test('a static parent reference or exclusion never substitutes runtime evidence', () => {
  const current = inventory();
  assert.equal(validateInteractionProof({ schemaVersion: 1, commit, entries: [] }, current).length, 1);
  const entry = { ...current.entries[0], status: 'passed', skipped: 0, flaky: 0, reviewer: 'independent', testSource: 'tests/e2e/submit.spec.ts', scenario: 'submit/persist/reload/refuse-foreign', artifact: { path: 'proof.json', sha256: 'c'.repeat(64) } };
  const proof = { schemaVersion: 1, commit, entries: [entry] };
  assert.deepEqual(validateInteractionProof(proof, current), []);
  assert.equal(validateInteractionProof({ ...proof, commit: 'd'.repeat(40) }, current)[0], 'INTERACTION_PROOF_STALE_OR_INVALID');
  entry.status = 'excluded'; assert.equal(validateInteractionProof(proof, current).length, 1);
  entry.status = 'passed'; entry.sourceSha256 = 'e'.repeat(64); assert.equal(validateInteractionProof(proof, current).length, 1);
});

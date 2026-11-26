import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMigrationIdentities } from '../migration-identities.mjs';

test('distinct names cannot conceal a shared migration version', () => {
  const result = validateMigrationIdentities(['20261118160000_admin.sql', '20261118160000_box.sql']);
  assert.equal(result.passed, false);
  assert.equal(result.errors[0].code, 'DUPLICATE_MIGRATION_VERSION');
});
test('unique canonical versions pass independently of enumeration order', () => {
  assert.deepEqual(validateMigrationIdentities(['20261118160100_admin.sql', 'notes.md', '20261118160000_box.sql']), { passed: true, migrationCount: 2, errors: [] });
});
test('malformed SQL names cannot escape validation', () => {
  assert.equal(validateMigrationIdentities(['later.sql']).passed, false);
});

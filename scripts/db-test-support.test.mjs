import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareSqlTest } from './db-test-support.mjs';

test('the framework grant is inside the existing transaction and cannot grant application access', () => {
  const source = '-- fixture\nbegin;\nset local role authenticated;\nselect extensions.ok(true);\nrollback;';
  const prepared = prepareSqlTest(source);
  assert.ok(prepared.indexOf('begin;') < prepared.indexOf('grant execute'));
  assert.ok(prepared.indexOf('grant execute') < prepared.indexOf('set local role authenticated'));
  assert.match(prepared, /extension_record\.extname='pgtap'/);
  assert.doesNotMatch(prepared, /grant (?:usage|select|insert|update|delete)|to public|on all functions/i);
  assert.ok(prepared.endsWith('rollback;'));
});

test('tests without a rollback transaction or with a commit cannot enable the framework grant', () => {
  for (const source of ['select 1;', 'begin; select 1;', 'begin;\ncommit;\nrollback;']) {
    assert.throws(() => prepareSqlTest(source), /SQL_TEST_REQUIRES_BEGIN/);
  }
});

test('a function body and a leading block comment remain unchanged', () => {
  const source = '/* fixture */\nbegin;\ndo $$ begin perform 1; end $$;\nrollback;';
  const prepared = prepareSqlTest(source);
  assert.ok(prepared.startsWith('/* fixture */\nbegin;'));
  assert.ok(prepared.includes('do $$ begin perform 1; end $$;'));
});

import { prepareSqlTestBatches } from './db-test-support.mjs';
test('explicit request boundaries preserve one rollback transaction and one framework grant', () => {
  const source = 'begin;\nselect clock_timestamp();\n-- matricia:test-request-boundary\nselect statement_timestamp();\nrollback;';
  const batches = prepareSqlTestBatches(source);
  assert.equal(batches.length, 2);
  assert.match(batches[0], /^begin;/);
  assert.match(batches[0], /PGTAP_TEST_FRAMEWORK_MISSING/);
  assert.doesNotMatch(batches[1], /grant execute|begin;/i);
  assert.match(batches[1], /rollback;$/);
  assert.equal(prepareSqlTestBatches('begin; select 1; rollback;').length, 1);
});
test('a boundary cannot authorize a commit or an unbounded test', () => {
  for (const source of ['begin;\n-- matricia:test-request-boundary\ncommit;\nrollback;', 'select 1;\n-- matricia:test-request-boundary\nrollback;']) assert.throws(() => prepareSqlTestBatches(source), /SQL_TEST_REQUIRES_BEGIN/);
});

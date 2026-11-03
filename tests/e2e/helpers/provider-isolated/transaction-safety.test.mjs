import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const script=fileURLToPath(new URL('./transaction.mjs',import.meta.url));
const token='11111111-1111-4111-8111-111111111111';
const args=['--browser-root=/nonexistent-test-target',`--target-token=${token}`,'--migration=/nonexistent/migration.sql','--test=/nonexistent/test.sql',`--output=${root}work/transaction-safety-unit`];
function refused(input,mode='development'){
 try{execFileSync(process.execPath,[script,...input],{cwd:root,env:{...process.env,APP_ENV:mode},stdio:['ignore','pipe','pipe']});assert.fail('unsafe invocation unexpectedly succeeded');}
 catch(error){assert.equal(error.status,1);return String(error.stderr);}
}
test('production is refused before opening test state or running Docker',()=>{assert.match(refused(args,'production'),/EXPLICIT_DEVELOPMENT_REQUIRED/);});
test('a target token must be explicitly provided',()=>{assert.match(refused(args.filter(a=>!a.startsWith('--target-token='))),/EXPLICIT_TARGET_AND_OUTPUT_REQUIRED/);});
test('a malformed target token is refused before state access',()=>{assert.match(refused(args.map(a=>a.startsWith('--target-token=')?'--target-token=production':a)),/EXPLICIT_ABSOLUTE_LOCAL_ARGUMENTS_REQUIRED/);});
test('a receipt cannot be written outside ignored work output',()=>{assert.match(refused(args.map(a=>a.startsWith('--output=')?'--output=/tmp/not-owned-output':a)),/IGNORED_WORK_OUTPUT_REQUIRED/);});
test('pgTAP files cannot accidentally share a session plan',()=>{assert.match(refused([...args,'--test=/nonexistent/second.test.sql']),/ONE_SQL_TEST_PER_ROLLBACK_TRANSACTION_REQUIRED/);});

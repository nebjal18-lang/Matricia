import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareSqlTestBatches } from '../../../scripts/db-test-support.mjs';

const execute = promisify(execFile);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const auditDir = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(join(root, 'package.json'));
const postgres = require('postgres');
const { stdout } = await execute(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'corepack pnpm exec supabase status --output json'], { cwd: root, windowsHide: true });
const local = JSON.parse(stdout.slice(stdout.indexOf('{')));
const target = new URL(local.DB_URL);
if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.port !== '54322') throw new Error('Audit SQL must remain local');
target.pathname = '/matricia_audit_20261119_b578c75c';
target.username = 'supabase_admin';
const sql = postgres(target.toString(), { max: 1, prepare: false, connect_timeout: 10, idle_timeout: 0, onnotice: () => {} });
const startedAt = new Date().toISOString();
const records = [];
const recheck = process.argv[2] === 'recheck';
function tapLines(value, lines = []) {
  if (Array.isArray(value)) for (const item of value) tapLines(item, lines);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) tapLines(item, lines);
  else if (typeof value === 'string') for (const raw of value.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^(?:not )?ok\b|^1\.\.\d+\b|^Bail out!|^#/i.test(line)) lines.push(line);
  }
  return lines;
}
try {
  const identity = await sql`select current_database() as database`;
  if (identity[0].database !== 'matricia_audit_20261119_b578c75c') throw new Error('Clone identity mismatch');
  const failedBaseline = recheck ? new Set(JSON.parse(await readFile(join(auditDir, 'evidence/sql-all-files.json'), 'utf8')).records.filter(r => r.status !== 'PASS').map(r => r.file)) : null;
  const files = (await readdir(join(root, 'supabase/tests'))).filter(file => file.endsWith('.test.sql') && (!failedBaseline || failedBaseline.has(file))).sort();
  for (const file of files) {
    const start = Date.now();
    let result;
    try {
      const source = await readFile(join(root, 'supabase/tests', file), 'utf8');
      const replies = [];
      for (const batch of prepareSqlTestBatches(source)) replies.push(await sql.unsafe(batch, [], { simple: true }));
      const lines = tapLines(replies);
      const plans = lines.filter(line => /^1\.\.\d+\b/.test(line));
      const assertions = lines.filter(line => /^(?:not )?ok\b/.test(line));
      const planned = Number(plans[0]?.match(/^1\.\.(\d+)/)?.[1] ?? 0);
      const failures = lines.filter(line => /^not ok\b|^Bail out!/i.test(line));
      const skips = assertions.filter(line => /#\s*(?:SKIP|TODO)\b/i.test(line));
      const numberingValid = assertions.every((line, index) => Number(line.match(/^(?:not )?ok\s+(\d+)\b/)?.[1]) === index + 1);
      const passed = plans.length === 1 && planned > 0 && planned === assertions.length && numberingValid && failures.length === 0 && skips.length === 0;
      result = { file, status: passed ? 'PASS' : 'FAIL', planned, assertions: assertions.length, numberingValid, failures,
        skips, diagnostics: passed ? [] : lines.filter(line => line.startsWith('#')), durationMs: Date.now() - start };
    } catch (error) {
      result = { file, status: 'ERROR', code: error.code ?? null,
        message: String(error.message).replace(/\beyJ[A-Za-z0-9_.-]+\b/g, '[REDACTED_JWT]'), durationMs: Date.now() - start };
    } finally {
      await sql.unsafe('ROLLBACK; RESET ROLE; RESET ALL;', [], { simple: true });
    }
    records.push(result);
    if (result.status !== 'PASS' || recheck) console.log(`${result.status} ${file}${result.status === 'PASS' ? '' : ' ' + (result.failures?.join(' | ') || result.message)}`);
  }
} finally {
  await sql.end({ timeout: 2 });
  const result = { startedAt, finishedAt: new Date().toISOString(), nodeVersion: process.version,
    environment: recheck ? 'audit clone after diagnostic reconciliation with three existing repository migrations and original DB-specific hook setting' : 'separate local snapshot database', target: target.pathname.slice(1),
    filteredRecheck: recheck,
    protocol: 'All repository pgTAP files, same prepareSqlTestBatches helper; check one plan, assertion count/order, no skips; rollback/reset between files; not a fresh migration replay; pg_cron excluded; concurrency not part of this harness',
    files: records.length, passed: records.filter(r => r.status === 'PASS').length,
    failed: records.filter(r => r.status === 'FAIL').length, errors: records.filter(r => r.status === 'ERROR').length,
    assertionsExecuted: records.reduce((total, r) => total + (r.assertions || 0), 0), records };
  await writeFile(join(auditDir, 'evidence', recheck ? 'sql-rechecked-files.json' : 'sql-all-files.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, records: undefined }));
  process.exitCode = result.failed || result.errors ? 1 : 0;
}

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const execute = promisify(execFile);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const auditDir = fileURLToPath(new URL('.', import.meta.url));
const name = process.argv[2];
if (!/^[a-z][a-z0-9-]+$/.test(name ?? '')) throw new Error('Invalid probe name');
const source = await readFile(join(auditDir, 'probes', `${name}.sql`), 'utf8');
if (!/^\s*BEGIN;/i.test(source) || !/ROLLBACK;\s*$/i.test(source) || /^\s*COMMIT\s*;/im.test(source)) throw new Error('Probe must be rollback-only');
const { stdout } = await execute(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'corepack pnpm exec supabase status --output json'], { cwd: root, windowsHide: true });
const local = JSON.parse(stdout.slice(stdout.indexOf('{')));
const target = new URL(local.DB_URL);
if (target.hostname !== '127.0.0.1' || target.port !== '54322') throw new Error('Only local audit database permitted');
target.username = 'supabase_admin'; target.pathname = '/matricia_audit_20261119_b578c75c';
const require = createRequire(join(root, 'package.json'));
const postgres = require('postgres');
const notices = [];
const sql = postgres(target.toString(), { max: 1, prepare: false, connect_timeout: 5, onnotice: value => notices.push({ severity: value.severity, code: value.code, message: value.message }) });
const metadata = { name, startedAt: new Date().toISOString(), target: target.pathname.slice(1), nodeVersion: process.version,
  permission: 'Synthetic rollback-only fixtures on isolated audit database; no application source changes', results: [], notices };
try {
  const identity = await sql`select current_database() as database`;
  if (identity[0].database !== target.pathname.slice(1)) throw new Error('Clone mismatch');
  const before = await sql`select count(*)::int as organizations from public.organizations`;
  const results = await sql.unsafe(source, [], { simple: true });
  metadata.results = results.filter(result => Array.isArray(result) && result.length).map(result => [...result]);
  metadata.executed = true;
  metadata.beforeOrganizations = before[0].organizations;
} catch (error) {
  metadata.executed = false; metadata.error = { code: error.code ?? null, message: error.message, context: error.where };
} finally {
  await sql.unsafe('ROLLBACK; RESET ROLE; RESET ALL;', [], { simple: true });
  const after = await sql`select count(*)::int as organizations from public.organizations`;
  metadata.afterOrganizations = after[0].organizations;
  metadata.finishedAt = new Date().toISOString();
  await sql.end();
  await writeFile(join(auditDir, 'evidence', `${name}-probe.json`), JSON.stringify(metadata, null, 2));
  console.log(JSON.stringify(metadata, null, 2));
  process.exitCode = metadata.executed ? 0 : 1;
}

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const evidence = fileURLToPath(new URL('./evidence/', import.meta.url));
const execute = promisify(execFile);
const { stdout } = await execute(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'corepack pnpm exec supabase status --output json'], { cwd: root, windowsHide: true });
const local = JSON.parse(stdout.slice(stdout.indexOf('{')));
const target = new URL(local.DB_URL);
if (target.hostname !== '127.0.0.1' || target.port !== '54322') throw new Error('Non-local endpoint forbidden');
target.username = 'supabase_admin'; target.pathname = '/matricia_audit_20261119_b578c75c';
const postgres = createRequire(join(root, 'package.json'))('postgres');
const sql = postgres(target.toString(), { max: 1, prepare: false, onnotice: () => {} });
const migrations = [
  '20261118161000_ensure_demo_regional_actor_v1.sql',
  '20261118170000_reset_demo_workspace_v1.sql',
  '20261118180000_admin_fiche_membership_identity_v1.sql',
];
const result = { startedAt: new Date().toISOString(), target: target.pathname.slice(1), scope: 'Diagnostic reconciliation of audit clone ONLY; applies existing repository SQL, does not fix sources, does not alter original DB or migration history, and does not prove clean CLI replay', appliedExistingSql: [] };
try {
  const identity = await sql`select current_database() as database`;
  if (identity[0].database !== target.pathname.slice(1)) throw new Error('Clone identity mismatch');
  await sql.unsafe("ALTER ROLE authenticator IN DATABASE matricia_audit_20261119_b578c75c SET pgrst.db_pre_request = 'public.enforce_current_auth_session_v1'");
  result.databaseSpecificSettingRestored = 'pgrst.db_pre_request=public.enforce_current_auth_session_v1';
  for (const migration of migrations) {
    const source = await readFile(join(root, 'supabase/migrations', migration), 'utf8');
    await sql.unsafe(source, [], { simple: true });
    result.appliedExistingSql.push(migration);
  }
  result.originalAndCloneOrganizationCounts = { clone: Number((await sql`select count(*) as n from public.organizations`)[0].n) };
  result.succeeded = true;
} catch (error) { result.succeeded = false; result.error = { code: error.code, message: error.message }; }
finally {
  await sql.end(); result.finishedAt = new Date().toISOString();
  await writeFile(join(evidence, 'clone-reconciliation.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2)); process.exitCode = result.succeeded ? 0 : 1;
}

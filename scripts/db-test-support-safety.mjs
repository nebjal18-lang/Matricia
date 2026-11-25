import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// No implicit .env, hosted fallback, DNS alias or pooler is safe for this mutating runner.
export function resolveSafeDatabaseTarget(env) {
  const fail = () => { throw new Error('DB_TEST_RESERVED_LOCAL_CLONE_REQUIRED'); };
  if (env.APP_ENV !== 'development' || env.DB_TEST_TARGET_MODE !== 'reserved-local-clone' || env.SUPABASE_DB_POOLER_URL) fail();
  let url;
  try { url = new URL(env.DIRECT_URL); } catch { fail(); }
  const cloneId = env.DB_TEST_CLONE_ID;
  if (!/^[0-9a-f]{32}$/.test(cloneId ?? '') || !['postgres:', 'postgresql:'].includes(url.protocol)
    || !['127.0.0.1', '[::1]'].includes(url.hostname) || !url.port || url.search || url.hash
    || url.pathname !== `/matricia_test_${cloneId}`) fail();
  return { url: url.href, cloneId, database: url.pathname.slice(1) };
}

export async function verifyDatabaseClone(sql, target) {
  const rows = await sql`select current_database() as database,
    current_setting('matricia.test_clone_id', true) as clone_id,
    current_setting('matricia.test_environment', true) as environment`;
  if (rows.length !== 1 || rows[0].database !== target.database || rows[0].clone_id !== target.cloneId
    || rows[0].environment !== 'reserved-local-clone') throw new Error('DB_TEST_CLONE_IDENTITY_MISMATCH');
}

export async function sqlInventory(root) {
  const directory = resolve(root, 'supabase/tests');
  const files = (await readdir(directory)).filter(file => file.endsWith('.test.sql')).sort();
  const entries = await Promise.all(files.map(async file => ({ file,
    sha256: createHash('sha256').update(await readFile(resolve(directory, file))).digest('hex') })));
  return { files, sha256: createHash('sha256').update(JSON.stringify(entries)).digest('hex') };
}

export function validateDatabaseEvidence(report, inventory, { commit, runId } = {}) {
  if (report?.schemaVersion !== 1 || report.outcome !== 'PASS' || report.scope !== 'FULL'
    || report.filter !== null || report.commit !== commit || (runId !== undefined && report.runId !== runId)
    || report.inventorySha256 !== inventory.sha256 || inventory.files.length === 0
    || JSON.stringify(report.files) !== JSON.stringify(inventory.files)
    || !Number.isSafeInteger(report.assertions) || report.assertions < 1 || report.concurrencyScenarios !== 4
    || report.targetMode !== 'reserved-local-clone') throw new Error('DB_RELEASE_FULL_EVIDENCE_REQUIRED');
  return report.assertions;
}

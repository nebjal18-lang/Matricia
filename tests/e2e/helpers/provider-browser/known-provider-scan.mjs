import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { loadOwnState, docker } from './safety.mjs';
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu;
const hash = /^[a-f0-9]{64}$/u;
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";

/** Test-only scanner port: only the exact known synthetic files are accepted. */
export async function scanKnownProviderDocuments(state, documents) {
  const current = await loadOwnState();
  if (current.token !== state.token || !documents.length || documents.length > 20) throw new Error('OWNED_KNOWN_PROVIDER_DOCUMENT_BATCH_REQUIRED');
  for (const doc of documents) if (!uuid.test(doc.id) || !hash.test(doc.sha256) || !Number.isInteger(doc.sizeBytes) || doc.sizeBytes < 1 || typeof doc.path !== 'string') throw new Error('EXACT_KNOWN_PROVIDER_DOCUMENT_RECEIPT_REQUIRED');
  const { createClient } = createRequire(resolve('apps/web/package.json'))('@supabase/supabase-js');
  const service = createClient(`http://127.0.0.1:${state.gatewayPort}`, state.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const observed = [], pending = new Map();
  for (const doc of documents) {
    const file = await service.storage.from('provider-qualification').download(doc.path);
    if (file.error || !file.data) throw new Error('KNOWN_PROVIDER_SCANNER_ORIGINAL_BYTES_REQUIRED');
    const bytes = Buffer.from(await file.data.arrayBuffer());
    if (bytes.length !== doc.sizeBytes || createHash('sha256').update(bytes).digest('hex') !== doc.sha256 || !bytes.includes(Buffer.from('TEST ONLY'))) throw new Error('ONLY_EXACT_KNOWN_SYNTHETIC_PDF_MAY_USE_TEST_SCANNER');
    // Read-only recovery of an actually committed native scan, never a direct
    // state write or a success inferred from the document's display status.
    const jobs = JSON.parse(docker(['exec', '-i', state.database, 'psql', '-X', '-U', 'supabase_admin', '-d', 'postgres', '-Atq', '-v', 'ON_ERROR_STOP=1'], {
      input: `select coalesce(json_agg(json_build_object('id',j.id,'path',j.storage_object_path,'hash',j.declared_sha256,'scanStatus',j.scan_status,'nativeResult',r.result,'nativeHash',r.computed_sha256,'engine',r.engine_code)),'[]')from public.provider_document_scan_jobs j left join private.provider_document_scan_results r on r.id=j.current_scan_result_id and r.upload_id=j.id where j.document_version_id=${literal(doc.id)}::uuid;`,
    }));
    if (jobs.length !== 1 || jobs[0].path !== doc.path || jobs[0].hash !== doc.sha256) throw new Error('NATIVE_PROVIDER_UPLOAD_AND_HASH_BINDING_REQUIRED');
    if (jobs[0].scanStatus === 'CLEAN' && jobs[0].nativeResult === 'CLEAN' && jobs[0].nativeHash === doc.sha256 && jobs[0].engine === 'LOCAL_KNOWN_FIXTURE_PDF') {
      observed.push({ documentId: doc.id, jobId: jobs[0].id, result: 'CLEAN', source: 'VERIFIED_EXISTING_NATIVE_SCAN', sha256: doc.sha256 });
    } else {
      if (jobs[0].scanStatus !== 'PENDING') throw new Error('PROVIDER_SCAN_STATE_CANNOT_BE_RESET_TO_PASS');
      pending.set(jobs[0].id, doc);
    }
  }
  if (pending.size) {
    const workerId = randomUUID();
    const claimed = await service.rpc('claim_provider_document_scan_jobs', { p_worker_id: workerId, p_limit: pending.size, p_lease_seconds: 300 });
    if (claimed.error || !Array.isArray(claimed.data) || claimed.data.length !== pending.size || claimed.data.some(job => !pending.has(job.proof_id))) throw new Error('EXACT_KNOWN_PROVIDER_SCAN_LEASES_REQUIRED');
    // Lease tokens are credentials and stay only in ignored private state.
    await writeFile(resolve(state.directory, `scanner-leases-${workerId}.private.json`), JSON.stringify(claimed.data), { mode: 0o600 });
    for (const job of claimed.data) {
      const doc = pending.get(job.proof_id);
      if (job.storage_bucket !== 'provider-qualification' || job.storage_path !== doc.path || job.expected_sha256 !== doc.sha256) throw new Error('NATIVE_PROVIDER_SCANNER_CLAIM_BINDING_REQUIRED');
      const result = await service.rpc('complete_provider_document_scan_job', { p_proof_id: job.proof_id, p_lease_token: job.lease_token, p_worker_id: job.worker_id, p_expected_row_version: job.row_version, p_result: 'CLEAN', p_engine_code: 'LOCAL_KNOWN_FIXTURE_PDF', p_engine_version: '1.0.0', p_computed_sha256: doc.sha256, p_idempotency_key: `native-provider-scan-${doc.id}` });
      if (result.error || result.data?.outcome !== 'PROVIDER_DOCUMENT_SCAN_RECORDED') throw new Error('NATIVE_PROVIDER_SCAN_COMPLETION_REQUIRED:' + (result.error?.code ?? 'INVALID_RESPONSE'));
      observed.push({ documentId: doc.id, jobId: job.proof_id, result: 'CLEAN', source: 'NATIVE_CLAIM_AND_COMPLETE', sha256: doc.sha256 });
    }
  }
  return { scope: 'KNOWN_SYNTHETIC_PDF_SCANNER_TEST_PORT', physicalAntivirusCertified: false, observed };
}

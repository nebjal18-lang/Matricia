import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { loadOwnState } from './safety.mjs';

/** Isolated TEST scanner, never an assertion about a real antivirus provider. */
export async function scanKnownDeliveryProof(state, document) {
  const owned = await loadOwnState();
  if (owned.token !== state.token || !/^[a-f0-9-]{36}$/u.test(document.id ?? '') || !/^[a-f0-9]{64}$/u.test(document.sha256 ?? '') || !Number.isSafeInteger(document.sizeBytes) || document.sizeBytes < 1 || !document.path) throw Error('OWNED_EXACT_KNOWN_DELIVERY_FILE_REQUIRED');
  const { createClient } = createRequire(resolve('apps/web/package.json'))('@supabase/supabase-js');
  const service = createClient(`http://127.0.0.1:${state.gatewayPort}`, state.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const row = await service.from('delivery_proofs').select('id,storage_bucket,storage_path,evidence_hash,scan_status').eq('id', document.id).single();
  if (row.error || row.data.storage_bucket !== 'delivery-proofs' || row.data.storage_path !== document.path || row.data.evidence_hash !== document.sha256 || row.data.scan_status !== 'PENDING') throw Error('EXACT_PENDING_NATIVE_DELIVERY_BINDING_REQUIRED');
  const file = await service.storage.from('delivery-proofs').download(document.path);
  if (file.error || !file.data) throw Error('KNOWN_DELIVERY_SCANNER_ORIGINAL_BYTES_REQUIRED');
  const bytes = Buffer.from(await file.data.arrayBuffer());
  if (bytes.length !== document.sizeBytes || createHash('sha256').update(bytes).digest('hex') !== document.sha256 || !bytes.includes(Buffer.from('TEST ONLY'))) throw Error('ONLY_EXACT_KNOWN_SYNTHETIC_DELIVERY_FILE_MAY_USE_TEST_SCANNER');
  const workerId = randomUUID();
  const claim = await service.rpc('claim_delivery_proof_scan_jobs', { p_worker_id: workerId, p_limit: 1, p_lease_seconds: 300 });
  if (claim.error || claim.data?.length !== 1 || claim.data[0].proof_id !== document.id) throw Error('EXACT_NATIVE_DELIVERY_SCAN_LEASE_REQUIRED');
  const job = claim.data[0];
  if (job.storage_bucket !== 'delivery-proofs' || job.storage_path !== document.path || job.expected_sha256 !== document.sha256) throw Error('NATIVE_DELIVERY_SCAN_CLAIM_BINDING_REQUIRED');
  await writeFile(resolve(state.directory, `delivery-scanner-lease-${workerId}.private.json`), JSON.stringify(job), { mode: 0o600 });
  const result = await service.rpc('complete_delivery_proof_scan_job', { p_proof_id: document.id, p_lease_token: job.lease_token, p_worker_id: job.worker_id, p_expected_row_version: job.row_version, p_result: 'CLEAN', p_engine_code: 'LOCAL_KNOWN_FIXTURE_PDF', p_engine_version: '1.0.0', p_computed_sha256: document.sha256, p_idempotency_key: `native-delivery-scan-${document.id}` });
  if (result.error || result.data?.outcome !== 'DELIVERY_PROOF_SCAN_RECORDED') throw Error('NATIVE_DELIVERY_SCAN_COMPLETION_REQUIRED:' + (result.error?.code ?? 'INVALID_RESPONSE'));
  return { scope: 'KNOWN_SYNTHETIC_DELIVERY_PDF_SCANNER_TEST_PORT', proofId: document.id, sha256: document.sha256, result: 'CLEAN', physicalAntivirusCertified: false };
}

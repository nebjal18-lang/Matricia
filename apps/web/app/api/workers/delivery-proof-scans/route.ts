import { withOperationalHeartbeat } from "@/modules/shared/lib/operations/heartbeat";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { scanDocumentBytes } from "@/modules/shared/lib/document-scanning/scanner";

import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const headers = { "cache-control": "no-store" } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Claim={proof_id:unknown;lease_token:unknown;worker_id:unknown;row_version:unknown;attempt_count:unknown;storage_bucket:unknown;storage_path:unknown;expected_sha256:unknown;media_type:unknown};

function authorized(request:Request){const expected=process.env.CRON_SECRET??"",supplied=request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]??"",a=Buffer.from(expected),b=Buffer.from(supplied);return a.length>=32&&a.length===b.length&&timingSafeEqual(a,b)}
function requestedLimit(request:Request){const raw=new URL(request.url).searchParams.get("limit")??"2";if(!/^\d{1,3}$/.test(raw))return null;const value=Number(raw);return Number.isSafeInteger(value)&&value>=1&&value<=100?Math.min(value,2):null}
function validClaim(value:Claim,workerId:string){return typeof value.proof_id==="string"&&UUID.test(value.proof_id)&&typeof value.lease_token==="string"&&UUID.test(value.lease_token)&&value.worker_id===workerId&&Number.isSafeInteger(value.row_version)&&(value.row_version as number)>0&&Number.isSafeInteger(value.attempt_count)&&(value.attempt_count as number)>=0&&(value.attempt_count as number)<5&&value.storage_bucket==="delivery-proofs"&&typeof value.storage_path==="string"&&value.storage_path.length<=500&&/^[0-9a-f]{64}$/.test(String(value.expected_sha256))}
function validPaymentClaim(value:Claim,workerId:string){return typeof value.proof_id==="string"&&UUID.test(value.proof_id)&&typeof value.lease_token==="string"&&UUID.test(value.lease_token)&&value.worker_id===workerId&&Number.isSafeInteger(value.row_version)&&(value.row_version as number)>0&&Number.isSafeInteger(value.attempt_count)&&(value.attempt_count as number)>=0&&(value.attempt_count as number)<5&&value.storage_bucket==="provider-qualification"&&typeof value.storage_path==="string"&&value.storage_path.length<=400&&/^[0-9a-f]{64}$/.test(String(value.expected_sha256))}

async function runCycle(request:Request){
  if(!authorized(request))return Response.json({code:"UNAUTHORIZED"},{status:401,headers});
  const limit=requestedLimit(request);if(!limit)return Response.json({code:"INVALID_LIMIT"},{status:400,headers});
  const client=getSupabaseAdminClient(),workerId=randomUUID(),correlationId=randomUUID();
  try{
    const claimed=await client.rpc("claim_delivery_proof_scan_jobs",{p_worker_id:workerId,p_limit:limit>1?limit-1:limit,p_lease_seconds:300});
    if(claimed.error||!Array.isArray(claimed.data))return Response.json({code:"DELIVERY_PROOF_SCAN_CLAIM_FAILED"},{status:503,headers});
    let completed=0,retried=0;
    for(const claim of claimed.data as Claim[]){
      if(!validClaim(claim,workerId))return Response.json({code:"DELIVERY_PROOF_SCAN_INVALID_CLAIM"},{status:503,headers});
      const downloaded=await client.storage.from("delivery-proofs").download(claim.storage_path as string);
      if(downloaded.error||!downloaded.data){const failed=await client.rpc("fail_delivery_proof_scan_job",{p_proof_id:claim.proof_id,p_lease_token:claim.lease_token,p_worker_id:workerId,p_expected_row_version:claim.row_version,p_failure_code:"STORAGE_DOWNLOAD_FAILED",p_computed_sha256:claim.expected_sha256,p_correlation_id:correlationId});if(failed.error||!["DELIVERY_PROOF_SCAN_RETRY_SCHEDULED","DELIVERY_PROOF_SCAN_DEAD_LETTERED"].includes(String(failed.data?.outcome)))return Response.json({code:"DELIVERY_PROOF_SCAN_RETRY_FAILED"},{status:503,headers});retried++;continue;}
      const array=await downloaded.data.arrayBuffer();if(array.byteLength>10*1024*1024)return Response.json({code:"DELIVERY_PROOF_SCAN_OBJECT_TOO_LARGE"},{status:503,headers});const bytes=Buffer.from(array),computed=createHash("sha256").update(bytes).digest("hex"),verdict=computed===claim.expected_sha256?await scanDocumentBytes(bytes,computed,claim.media_type):{result:"ERROR" as const,engineCode:"MATRICIA_HASH_GUARD",engineVersion:"1.0.0"};
      if(verdict.retryable){const failed=await client.rpc("fail_delivery_proof_scan_job",{p_proof_id:claim.proof_id,p_lease_token:claim.lease_token,p_worker_id:workerId,p_expected_row_version:claim.row_version,p_failure_code:verdict.retryCode??"SCANNER_INVALID_RESPONSE",p_computed_sha256:computed,p_correlation_id:correlationId});if(failed.error||!["DELIVERY_PROOF_SCAN_RETRY_SCHEDULED","DELIVERY_PROOF_SCAN_DEAD_LETTERED"].includes(String(failed.data?.outcome)))return Response.json({code:"DELIVERY_PROOF_SCAN_RETRY_FAILED"},{status:503,headers});retried++;continue;}
      const completedJob=await client.rpc("complete_delivery_proof_scan_job",{p_proof_id:claim.proof_id,p_lease_token:claim.lease_token,p_worker_id:workerId,p_expected_row_version:claim.row_version,p_result:verdict.result,p_engine_code:verdict.engineCode,p_engine_version:verdict.engineVersion,p_computed_sha256:computed,p_idempotency_key:`delivery-proof-scan:${claim.proof_id}:${claim.expected_sha256}`,p_correlation_id:correlationId});
      if(completedJob.error||completedJob.data?.outcome!=="DELIVERY_PROOF_SCAN_RECORDED")return Response.json({code:"DELIVERY_PROOF_SCAN_COMPLETION_FAILED"},{status:503,headers});completed++;
    }
    let paymentClaimed=0,paymentCompleted=0,paymentRetried=0;
    if(limit>1){
      const paymentJobs=await client.rpc("claim_provider_payment_proof_scan_jobs",{p_worker_id:workerId,p_limit:1,p_lease_seconds:300});
      if(paymentJobs.error||!Array.isArray(paymentJobs.data))return Response.json({code:"PROVIDER_PAYMENT_PROOF_SCAN_CLAIM_FAILED"},{status:503,headers});
      paymentClaimed=paymentJobs.data.length;
      for(const claim of paymentJobs.data as Claim[]){
        if(!validPaymentClaim(claim,workerId))return Response.json({code:"PROVIDER_PAYMENT_PROOF_SCAN_INVALID_CLAIM"},{status:503,headers});
        const downloaded=await client.storage.from("provider-qualification").download(claim.storage_path as string);
        if(downloaded.error||!downloaded.data){const failed=await client.rpc("fail_provider_payment_proof_scan_job",{p_proof_id:claim.proof_id,p_lease_token:claim.lease_token,p_worker_id:workerId,p_expected_row_version:claim.row_version,p_failure_code:"STORAGE_DOWNLOAD_FAILED",p_computed_sha256:claim.expected_sha256,p_correlation_id:correlationId});if(failed.error||!["PROVIDER_PAYMENT_PROOF_SCAN_RETRY_SCHEDULED","PROVIDER_PAYMENT_PROOF_SCAN_DEAD_LETTERED"].includes(String(failed.data?.outcome)))return Response.json({code:"PROVIDER_PAYMENT_PROOF_SCAN_RETRY_FAILED"},{status:503,headers});paymentRetried++;continue;}
        const array=await downloaded.data.arrayBuffer();if(array.byteLength>10*1024*1024)return Response.json({code:"PROVIDER_PAYMENT_PROOF_SCAN_OBJECT_TOO_LARGE"},{status:503,headers});const bytes=Buffer.from(array),computed=createHash("sha256").update(bytes).digest("hex"),verdict=computed===claim.expected_sha256?await scanDocumentBytes(bytes,computed,claim.media_type):{result:"ERROR"as const,engineCode:"MATRICIA_HASH_GUARD",engineVersion:"1.0.0"};
        if(verdict.retryable){const failed=await client.rpc("fail_provider_payment_proof_scan_job",{p_proof_id:claim.proof_id,p_lease_token:claim.lease_token,p_worker_id:workerId,p_expected_row_version:claim.row_version,p_failure_code:verdict.retryCode??"SCANNER_INVALID_RESPONSE",p_computed_sha256:computed,p_correlation_id:correlationId});if(failed.error||!["PROVIDER_PAYMENT_PROOF_SCAN_RETRY_SCHEDULED","PROVIDER_PAYMENT_PROOF_SCAN_DEAD_LETTERED"].includes(String(failed.data?.outcome)))return Response.json({code:"PROVIDER_PAYMENT_PROOF_SCAN_RETRY_FAILED"},{status:503,headers});paymentRetried++;continue;}
        const done=await client.rpc("complete_provider_payment_proof_scan_job",{p_proof_id:claim.proof_id,p_lease_token:claim.lease_token,p_worker_id:workerId,p_expected_row_version:claim.row_version,p_result:verdict.result,p_engine_code:verdict.engineCode,p_engine_version:verdict.engineVersion,p_computed_sha256:computed,p_idempotency_key:`provider-payment-proof-scan:${claim.proof_id}:${claim.expected_sha256}`,p_correlation_id:correlationId});
        if(done.error||done.data?.outcome!=="PROVIDER_PAYMENT_PROOF_SCAN_RECORDED")return Response.json({code:"PROVIDER_PAYMENT_PROOF_SCAN_COMPLETION_FAILED"},{status:503,headers});paymentCompleted++;
      }
    }
    const cleanup=await client.rpc("cleanup_delivery_proof_storage_orphans",{p_limit:limit,p_correlation_id:correlationId});
    if(cleanup.error||cleanup.data?.outcome!=="DELIVERY_PROOF_ORPHANS_CLEANED"||!Number.isSafeInteger(cleanup.data?.count))return Response.json({code:"DELIVERY_PROOF_ORPHAN_CLEANUP_FAILED"},{status:503,headers});
    return Response.json({outcome:"DELIVERY_PROOF_SCANS_PROCESSED",orphansCleaned:cleanup.data.count,claimed:claimed.data.length,completed,retried,paymentProofs:{claimed:paymentClaimed,completed:paymentCompleted,retried:paymentRetried}},{headers:{...headers,"x-correlation-id":correlationId}});
  }catch{return Response.json({code:"DELIVERY_PROOF_SCAN_WORKER_FAILED"},{status:503,headers})}
}
export const GET=POST;

export async function POST(request: Request) { return withOperationalHeartbeat("DELIVERY_PROOF_SCANNER", 900, () => runCycle(request)); }

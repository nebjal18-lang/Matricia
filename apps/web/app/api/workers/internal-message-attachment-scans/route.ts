import {createHash,randomUUID,timingSafeEqual} from "node:crypto";
import {z} from "zod";
import {scanDocumentBytes} from "@/modules/shared/lib/document-scanning/scanner";
import {withOperationalHeartbeat} from "@/modules/shared/lib/operations/heartbeat";
import {getSupabaseAdminClient} from "@/modules/shared/lib/supabase/admin";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const headers={"cache-control":"no-store"};
const claimSchema=z.object({proof_id:z.string().uuid(),lease_token:z.string().uuid(),worker_id:z.string().uuid(),row_version:z.number().int().positive(),attempt_count:z.number().int().min(0).max(4),storage_bucket:z.literal("private-message-attachments"),storage_path:z.string().min(1).max(500),expected_sha256:z.string().regex(/^[0-9a-f]{64}$/u),media_type:z.enum(["application/pdf","image/jpeg","image/png","text/plain"]),size_bytes:z.number().int().positive().max(10*1024*1024)});
async function runCycle(request:Request){
 const expected=Buffer.from(process.env.CRON_SECRET??""),supplied=Buffer.from(request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/iu)?.[1]??"");
 if(expected.length<32||expected.length!==supplied.length||!timingSafeEqual(expected,supplied))return Response.json({code:"UNAUTHORIZED"},{status:401,headers});
 const client=getSupabaseAdminClient(),workerId=randomUUID(),correlationId=randomUUID();
 const rpc=(name:string,args:Record<string,unknown>)=>client.rpc(name,args).abortSignal(AbortSignal.timeout(5_000));
 const claimed=await rpc("claim_internal_message_attachment_scan_jobs",{p_worker_id:workerId,p_limit:1,p_lease_seconds:300});
 if(claimed.error||!Array.isArray(claimed.data))return Response.json({code:"INTERNAL_MESSAGE_ATTACHMENT_SCAN_CLAIM_FAILED"},{status:503,headers});
 if(!claimed.data.length)return Response.json({outcome:"NO_JOB"},{headers});
 const parsed=claimSchema.safeParse(claimed.data[0]);if(!parsed.success||parsed.data.worker_id!==workerId)return Response.json({code:"INTERNAL_MESSAGE_ATTACHMENT_SCAN_INVALID_CLAIM"},{status:503,headers});
 const claim=parsed.data,base={p_proof_id:claim.proof_id,p_lease_token:claim.lease_token,p_worker_id:workerId,p_expected_row_version:claim.row_version,p_correlation_id:correlationId};
 const retry=async(code:string,hash:string|null=null)=>{
  const result=await rpc("fail_internal_message_attachment_scan_job",{...base,p_failure_code:code,p_computed_sha256:hash});
  return Response.json({outcome:result.data?.outcome??"INTERNAL_MESSAGE_ATTACHMENT_SCAN_RETRY_FAILED"},{status:!result.error&&["INTERNAL_MESSAGE_ATTACHMENT_SCAN_RETRY_SCHEDULED","INTERNAL_MESSAGE_ATTACHMENT_SCAN_DEAD_LETTERED"].includes(result.data?.outcome)?200:503,headers});
 };
 try{
  const download=await client.storage.from(claim.storage_bucket).download(claim.storage_path,{}, {signal:AbortSignal.timeout(10_000)});
  if(download.error||!download.data)return retry("STORAGE_DOWNLOAD_FAILED");
  if(download.data.size!==claim.size_bytes)return retry("STORAGE_SIZE_MISMATCH");
  const bytes=Buffer.from(await download.data.arrayBuffer()),hash=createHash("sha256").update(bytes).digest("hex");
  const verdict=hash===claim.expected_sha256?await scanDocumentBytes(bytes,hash,claim.media_type):{result:"ERROR" as const,engineCode:"MATRICIA_HASH_GUARD",engineVersion:"1.0.0"};
  if("retryable"in verdict&&verdict.retryable)return retry(verdict.retryCode??"SCANNER_INVALID_RESPONSE",hash);
  const result=await rpc("complete_internal_message_attachment_scan_job",{...base,p_result:verdict.result,p_engine_code:verdict.engineCode,p_engine_version:verdict.engineVersion,p_computed_sha256:hash,p_idempotency_key:`internal-message-attachment-scan:${claim.proof_id}:${claim.expected_sha256}`});
  if(result.error||result.data?.outcome!=="INTERNAL_MESSAGE_ATTACHMENT_SCAN_RECORDED")return Response.json({code:"INTERNAL_MESSAGE_ATTACHMENT_SCAN_COMPLETION_FAILED"},{status:503,headers});
  return Response.json({outcome:result.data.outcome},{headers});
 }catch{return retry("SCANNER_UNAVAILABLE")}
}
export async function POST(request:Request){return withOperationalHeartbeat("INTERNAL_MESSAGE_ATTACHMENT_SCANNER",900,()=>runCycle(request))}
export const GET=POST;

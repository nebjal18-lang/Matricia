import { withOperationalHeartbeat } from "@/modules/shared/lib/operations/heartbeat";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { serviceContentInput } from "@/modules/shared/lib/marketing-autopilot/content-engine";
import { configuredProviders, generateWithFailover } from "@/modules/shared/lib/marketing-autopilot/provider-orchestrator";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers={"cache-control":"no-store"} as const;
const claimSchema=serviceContentInput.extend({outcome:z.literal("CLAIMED"),idempotencyKey:z.string().trim().min(8).max(200),workerId:z.string().uuid(),leaseToken:z.string().uuid(),claimRowVersion:z.number().int().positive()});

function authorized(request:Request){const expected=process.env.CRON_SECRET??"",supplied=request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]??"";const a=Buffer.from(expected),b=Buffer.from(supplied);return a.length>=32&&a.length===b.length&&timingSafeEqual(a,b)}

async function runCycle(request:Request){
  if(!authorized(request))return Response.json({code:"UNAUTHORIZED"},{status:401,headers});
  const admin=getSupabaseAdminClient(),workerId=crypto.randomUUID();
  const claim=await admin.rpc("claim_next_marketing_content_generation_v1",{p_worker_id:workerId,p_lease_seconds:120});
  if(claim.error)return Response.json({code:"CLAIM_FAILED"},{status:503,headers});
  if((claim.data as {outcome?:unknown}|null)?.outcome==="NO_JOB")return Response.json({outcome:"NO_JOB"},{headers});
  const parsed=claimSchema.safeParse(claim.data);if(!parsed.success)return Response.json({code:"INVALID_CLAIM"},{status:503,headers});
  const idempotencyKey=parsed.data.idempotencyKey,input=serviceContentInput.parse(parsed.data);
  const recordFailure=async(errorCode:string)=>admin.rpc("record_marketing_content_generation_failure_v1",{p_campaign_id:input.campaignId,p_worker_id:parsed.data.workerId,p_lease_token:parsed.data.leaseToken,p_expected_claim_row_version:parsed.data.claimRowVersion,p_error_code:errorCode,p_idempotency_key:`${idempotencyKey}:failure:${parsed.data.claimRowVersion}`});
  let generated;
  try{generated=await generateWithFailover(input,configuredProviders())}catch{await recordFailure("PROVIDER_UNAVAILABLE");return Response.json({code:"PROVIDER_UNAVAILABLE"},{status:503,headers})}
  const result=await admin.rpc("persist_marketing_content_batch_v1",{p_organization_id:input.organizationId,p_campaign_id:input.campaignId,p_service_id:input.serviceId,p_library_id:input.libraryId,p_language:input.language,p_template_key:input.templateKey,p_source_hash:input.sourceHash,p_provider:generated.provider,p_failover_used:generated.failoverUsed,p_contents:generated.contents,p_idempotency_key:idempotencyKey,p_worker_id:parsed.data.workerId,p_lease_token:parsed.data.leaseToken,p_expected_claim_row_version:parsed.data.claimRowVersion});
  if(result.error){await recordFailure("PERSIST_FAILED");return Response.json({code:"PERSIST_FAILED"},{status:503,headers})}
  return Response.json({outcome:"MARKETING_CONTENT_BATCH_GENERATED",provider:generated.provider,failoverUsed:generated.failoverUsed,count:generated.contents.length,result:result.data},{headers});
}
// Vercel Cron invokes GET; authorization and claims are identical for both methods.
export const GET = POST;

export async function POST(request: Request) { return withOperationalHeartbeat("MARKETING_CONTENT", 900, () => runCycle(request)); }

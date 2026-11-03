import {randomUUID,timingSafeEqual} from "node:crypto";
import {z} from "zod";
import {withOperationalHeartbeat} from "@/modules/shared/lib/operations/heartbeat";
import {getSupabaseAdminClient} from "@/modules/shared/lib/supabase/admin";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const headers={"cache-control":"no-store"};
const leaseSchema=z.object({job_id:z.string().uuid(),worker_id:z.string().uuid(),lease_token:z.string().uuid(),row_version:z.string().regex(/^[1-9]\d{0,18}$/u)});
async function runCycle(request:Request){
 const expected=Buffer.from(process.env.CRON_SECRET??""),supplied=Buffer.from(request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/iu)?.[1]??"");
 if(expected.length<32||expected.length!==supplied.length||!timingSafeEqual(expected,supplied))return Response.json({code:"UNAUTHORIZED"},{status:401,headers});
 const client=getSupabaseAdminClient({timeoutMs:5_000}),workerId=randomUUID();
 const discovered=await client.rpc("discover_subscription_credit_jobs_v1",{p_limit:10});
 if(discovered.error||discovered.data?.outcome!=="SUBSCRIPTION_CREDIT_DISCOVERY_COMPLETED")return Response.json({code:"SC_DISCOVERY_FAILED"},{status:503,headers});
 const started=performance.now();let processed=0;const outcomes:string[]=[];
 while(processed<5&&performance.now()-started<35_000){
  const claimed=await client.rpc("claim_subscription_credit_jobs_v1",{p_worker_id:workerId,p_limit:1,p_lease_seconds:120});
  if(claimed.error||!Array.isArray(claimed.data))return Response.json({code:"SC_CLAIM_FAILED"},{status:503,headers});
  if(claimed.data.length===0)break;
  const parsed=leaseSchema.safeParse(claimed.data[0]);
  if(!parsed.success||parsed.data.worker_id!==workerId)return Response.json({code:"SC_LEASE_INVALID"},{status:503,headers});
  const result=await client.rpc("execute_subscription_credit_job_v1",{p_job_id:parsed.data.job_id,p_worker_id:workerId,p_lease_token:parsed.data.lease_token,p_expected_row_version:parsed.data.row_version,p_correlation_id:randomUUID()});
  const completed=z.object({outcome:z.enum(["SUBSCRIPTION_CREDIT_ISSUED","SUBSCRIPTION_CREDIT_ALREADY_ISSUED","SUBSCRIPTION_CREDIT_SLOT_EXPIRED","SUBSCRIPTION_CREDIT_RETRY_SCHEDULED","SUBSCRIPTION_CREDIT_DEAD_LETTERED"])}).safeParse(result.data);
  if(result.error||!completed.success)return Response.json({code:"SC_EXECUTION_FAILED"},{status:503,headers});
  outcomes.push(completed.data.outcome);processed++;
 }
 return Response.json({outcome:processed?"SUBSCRIPTION_CREDIT_CYCLE_COMPLETED":"NO_JOB",processed,outcomes},{headers});
}
export async function POST(request:Request){return withOperationalHeartbeat("SUBSCRIPTION_CREDIT_GRANTS",900,()=>runCycle(request))}
export const GET=POST;

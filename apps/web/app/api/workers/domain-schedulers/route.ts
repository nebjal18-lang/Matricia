import { withOperationalHeartbeat } from "@/modules/shared/lib/operations/heartbeat";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";
import { runDomainSchedulerWorker } from "./runner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function runCycle(request:Request){const client=getSupabaseAdminClient();return runDomainSchedulerWorker(request,{rpc:async(name,args)=>{const result=await client.rpc(name,args);return{data:result.data,error:result.error}},env:process.env})}

export const GET = POST;

export async function POST(request: Request) { return withOperationalHeartbeat("DOMAIN_SCHEDULERS", 180, () => runCycle(request)); }

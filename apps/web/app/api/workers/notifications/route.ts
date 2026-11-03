import { withOperationalHeartbeat } from "@/modules/shared/lib/operations/heartbeat";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";
import { deliverNotification } from "@/modules/shared/lib/notification-delivery/adapter";
import { runNotificationWorker } from "./runner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function runCycle(request:Request){const client=getSupabaseAdminClient();return runNotificationWorker(request,{rpc:async(name,args)=>{const result=await client.rpc(name,args);return{data:result.data,error:result.error}},deliver:deliverNotification,env:process.env})}
export const GET=POST;

export async function POST(request: Request) { return withOperationalHeartbeat("NOTIFICATIONS", 180, () => runCycle(request)); }

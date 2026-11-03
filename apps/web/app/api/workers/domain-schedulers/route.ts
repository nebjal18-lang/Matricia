import { withOperationalHeartbeat } from "@/modules/shared/lib/operations/heartbeat";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "cache-control": "no-store" } as const;

type RpcResult={data:unknown;error:unknown};type SchedulerDependencies={rpc:(name:string,args:Record<string,unknown>)=>Promise<RpcResult>;env:NodeJS.ProcessEnv};
export async function runDomainSchedulerWorker(request: Request, dependencies:SchedulerDependencies) {
  const expected=dependencies.env.CRON_SECRET??"",supplied=request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]??"",a=Buffer.from(expected),b=Buffer.from(supplied);
  if (!(a.length>=32&&a.length===b.length&&timingSafeEqual(a,b))) return Response.json({ code: "UNAUTHORIZED" }, { status: 401, headers });
  const url = new URL(request.url), limitRaw = url.searchParams.get("limit") ?? "100";
  const asOf = url.searchParams.get("asOf") ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{1,3}$/.test(limitRaw) || Number(limitRaw) < 1 || Number(limitRaw) > 500 || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return Response.json({ code: "INVALID_SCHEDULER_INPUT" }, { status: 400, headers });
  const correlationId = randomUUID(), deadline = Date.now() + 45_000;
  let pageCount = 0, data: unknown = null, outcome = "";
  do {
    const result = await dependencies.rpc("run_domain_automation_schedulers_v1", { p_as_of: asOf, p_limit: Number(limitRaw) });
    if (result.error) return Response.json({ code: "DOMAIN_SCHEDULER_FAILED", pageCount }, { status: 503, headers });
    data = result.data;
    outcome = typeof (data as { outcome?: unknown } | null)?.outcome === "string" ? (data as { outcome: string }).outcome : "";
    pageCount++;
    if (!["DOMAIN_AUTOMATIONS_PARTIAL", "DOMAIN_AUTOMATIONS_COMPLETED", "DOMAIN_AUTOMATIONS_REPLAYED", "DOMAIN_AUTOMATIONS_ALREADY_RUNNING"].includes(outcome)) return Response.json({ code: "DOMAIN_SCHEDULER_INVALID_RESULT", pageCount }, { status: 503, headers });
  } while (outcome === "DOMAIN_AUTOMATIONS_PARTIAL" && Date.now() < deadline && pageCount < 100);
  return Response.json({ ...(data as Record<string, unknown>), pageCount, continuationRequired: outcome === "DOMAIN_AUTOMATIONS_PARTIAL" }, { status: outcome === "DOMAIN_AUTOMATIONS_PARTIAL" ? 202 : 200, headers: { ...headers, "x-correlation-id": correlationId } });
}

async function runCycle(request:Request){const client=getSupabaseAdminClient();return runDomainSchedulerWorker(request,{rpc:async(name,args)=>{const result=await client.rpc(name,args);return{data:result.data,error:result.error}},env:process.env})}

export const GET = POST;

export async function POST(request: Request) { return withOperationalHeartbeat("DOMAIN_SCHEDULERS", 180, () => runCycle(request)); }

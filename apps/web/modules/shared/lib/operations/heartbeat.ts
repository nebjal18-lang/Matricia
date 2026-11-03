import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";
/** Unauthorized traffic cannot refresh a cron's liveness evidence. */
export async function withOperationalHeartbeat(service: string, expiresAfterSeconds: number, run: () => Promise<Response>): Promise<Response> {
  const startedAt = performance.now();
  let response: Response;
  try { response = await run(); }
  catch { response = Response.json({ code: "WORKER_CYCLE_FAILED" }, { status: 503, headers: { "cache-control": "no-store" } }); }
  if (response.status === 401 || response.status === 403) return response;
  try {
    const result = await getSupabaseAdminClient({timeoutMs:5000}).rpc("record_operational_job_run_v1", { p_service_code: service, p_healthy: response.ok, p_expires_after_seconds: expiresAfterSeconds, p_duration_ms: Math.min(3600000, Math.max(0, Math.round(performance.now() - startedAt))) });
    if (result.error) return Response.json({ code: "HEARTBEAT_RECORD_FAILED" }, { status: 503, headers: { "cache-control": "no-store" } });
  } catch { return Response.json({ code: "HEARTBEAT_RECORD_FAILED" }, { status: 503, headers: { "cache-control": "no-store" } }); }
  return response;
}

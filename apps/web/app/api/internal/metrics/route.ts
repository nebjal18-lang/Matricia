import { timingSafeEqual } from "node:crypto";
import { prometheusMetrics } from "@/modules/shared/lib/operations/metrics";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = { "cache-control": "no-store" };
  const expected = Buffer.from(process.env.INTERNAL_METRICS_TOKEN ?? ""), supplied = Buffer.from(request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/iu)?.[1] ?? "");
  if (expected.length < 32 || expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return Response.json({ code: "UNAUTHORIZED" }, { status: 401, headers });
  try {
    const result = await getSupabaseAdminClient().rpc("operational_metrics_v1");
    if (result.error) throw new Error("METRICS_UNAVAILABLE");
    return new Response(prometheusMetrics(result.data), { headers: { ...headers, "content-type": "text/plain; version=0.0.4; charset=utf-8" } });
  } catch { return Response.json({ code: "METRICS_UNAVAILABLE" }, { status: 503, headers }); }
}

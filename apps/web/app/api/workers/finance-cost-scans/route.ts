import { timingSafeEqual } from "node:crypto";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";
import { scanOneFinanceCostDocument } from "@/modules/shared/lib/finance-cost-proofs/scan-consumer";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  const expected = Buffer.from(process.env.CRON_SECRET ?? "");
  const supplied = Buffer.from(request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/iu)?.[1] ?? "");
  if (expected.length < 32 || supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) return Response.json({ code: "UNAUTHORIZED" }, { status: 401, headers: { "cache-control": "no-store" } });
  const result = await scanOneFinanceCostDocument(getSupabaseAdminClient());
  return Response.json({ outcome: result.code, ...(result.scanStatus ? { scan_status: result.scanStatus } : {}) }, { status: result.ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}
export const GET = POST;

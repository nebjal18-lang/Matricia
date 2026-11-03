import {createHash} from "node:crypto";
import {NextResponse} from "next/server";
import {z} from "zod";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
export const dynamic = "force-dynamic";
export async function GET(_: Request, {params}: {params: Promise<{responseId: string}>}) {
  const {responseId} = await params;
  const headers = {"Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer"};
  if (!z.string().uuid().safeParse(responseId).success) return NextResponse.json({error: "INVALID_RESPONSE"}, {status: 400, headers});
  const client = await getSupabaseServerClient();
  const {data: auth} = await client.auth.getUser();
  if (!auth.user) return NextResponse.json({error: "UNAUTHENTICATED"}, {status: 401, headers});
  const result = await client.rpc("get_private_dsr_response_v1", {p_response_id: responseId});
  if (result.error) return NextResponse.json({error: "PRIVATE_RESPONSE_UNAVAILABLE"}, {status: result.error.code === "42501" ? 403 : 503, headers});
  const parsed = z.object({response_json: z.string().max(16777216), response_id: z.literal(responseId), sha256: z.string().regex(/^[a-f0-9]{64}$/u)}).safeParse(result.data);
  if (!parsed.success) return NextResponse.json({error: "INVALID_RESPONSE"}, {status: 503, headers});
  const bytes = Buffer.from(parsed.data.response_json, "utf8");
  if (bytes.length > 16777216 || createHash("sha256").update(bytes).digest("hex") !== parsed.data.sha256) return NextResponse.json({error: "RESPONSE_INTEGRITY_ERROR"}, {status: 503, headers});
  return new NextResponse(bytes, {headers: {...headers, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="privacy-response-${responseId}.json"`, "X-Matricia-Export-SHA256": parsed.data.sha256}});
}

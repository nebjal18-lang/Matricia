import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

export const runtime = "nodejs";
const headers = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };
const schema = z.object({
  firstName: z.string().trim().min(1).max(100).regex(/^[^\u0000-\u001f\u007f]+$/u),
  lastName: z.string().trim().min(1).max(100).regex(/^[^\u0000-\u001f\u007f]+$/u), locale: z.enum(["fr", "en"]),
  fields: z.array(z.object({ documentSha256: z.string().regex(/^[a-f0-9]{64}$/u), page: z.number().int().min(1).max(9999), x: z.number().int().min(0).max(9999), y: z.number().int().min(0).max(9999) }).strict()).min(1).max(10),
}).strict();

/** This stores only the authenticated signer's explicit preparation. The SQL
 * command freezes changes before the first durable dispatch claim and does
 * not approve a legal policy or rewrite a source document. */
export async function PUT(request: Request, { params }: { params: Promise<{ signerId: string }> }): Promise<Response> {
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site" || request.headers.get("content-type")?.split(";", 1)[0]?.trim() !== "application/json") return Response.json({ code: "ORIGIN_REQUIRED" }, { status: 403, headers });
  const { signerId } = await params;
  if (!z.string().uuid().safeParse(signerId).success) return Response.json({ code: "YOUSIGN_SIGNER_NOT_FOUND" }, { status: 404, headers });
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/u.test(declared) || Number(declared) > 8192)) return Response.json({ code: "PAYLOAD_TOO_LARGE" }, { status: 413, headers });
  let body: unknown;
  try {
    if (!request.body) return Response.json({ code: "INVALID_REQUEST" }, { status: 400, headers });
    const reader = request.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 8192) { await reader.cancel(); return Response.json({ code: "PAYLOAD_TOO_LARGE" }, { status: 413, headers }); }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  }
  catch { return Response.json({ code: "INVALID_REQUEST" }, { status: 400, headers }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ code: "INVALID_REQUEST" }, { status: 400, headers });
  const client = await getSupabaseServerClient();
  const auth = await client.auth.getUser();
  if (auth.error || !auth.data.user) return Response.json({ code: "UNAUTHENTICATED" }, { status: 401, headers });
  const result = await client.rpc("configure_yousign_signer_v1", { p_signer_id: signerId, p_first_name: parsed.data.firstName, p_last_name: parsed.data.lastName, p_locale: parsed.data.locale, p_fields: parsed.data.fields });
  if (result.error || result.data?.outcome !== "YOUSIGN_SIGNER_CONFIGURED") return Response.json({ code: "YOUSIGN_SIGNER_CONFIGURATION_UNAVAILABLE" }, { status: result.error?.code === "42501" ? 403 : 409, headers });
  return Response.json({ outcome: "YOUSIGN_SIGNER_CONFIGURED", signerId }, { headers });
}

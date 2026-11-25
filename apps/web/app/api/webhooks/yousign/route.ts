import { createYousignRuntime } from "@/modules/shared/lib/signature-runtime/yousign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
const maxBytes = 128 * 1024;

/** HMAC is verified against exactly these bytes, before parsing or DB lookup. */
export async function POST(request: Request): Promise<Response> {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/u.test(declared) || Number(declared) > maxBytes)) return Response.json({ code: "YOUSIGN_WEBHOOK_TOO_LARGE" }, { status: 413, headers });
  if (!request.body) return Response.json({ code: "YOUSIGN_WEBHOOK_INVALID" }, { status: 400, headers });
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) { await reader.cancel(); return Response.json({ code: "YOUSIGN_WEBHOOK_TOO_LARGE" }, { status: 413, headers }); }
      chunks.push(part.value);
    }
    const raw = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.byteLength; }
    const signature = request.headers.get("x-yousign-signature-256");
    if (!signature || !/^sha256=[a-f0-9]{64}$/iu.test(signature)) return Response.json({ code: "YOUSIGN_WEBHOOK_INVALID" }, { status: 401, headers });
    const result = await (await createYousignRuntime()).webhook(raw, { "x-yousign-signature-256": signature }, new Date());
    return Response.json({ outcome: "YOUSIGN_EVENT_RECORDED", replayed: result.replayed }, { status: 200, headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    // Fixed classifications only; never provider bodies, secrets or signer data.
    const invalid = ["YOUSIGN_WEBHOOK_SIGNATURE_INVALID", "YOUSIGN_WEBHOOK_INVALID", "YOUSIGN_WEBHOOK_STALE", "YOUSIGN_WEBHOOK_ENVIRONMENT_MISMATCH"].includes(code);
    return Response.json({ code: invalid ? "YOUSIGN_WEBHOOK_INVALID" : "YOUSIGN_WEBHOOK_RECONCILIATION_REQUIRED" }, { status: invalid ? 401 : 503, headers });
  }
}

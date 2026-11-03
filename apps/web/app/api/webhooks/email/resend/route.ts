import { verifyResendReceipt } from "@/modules/shared/lib/notification-delivery/resend-receipt";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";
export async function POST(request: Request) {
  const headers = { "cache-control": "no-store" };
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return Response.json({ code: "EMAIL_RECEIPT_UNCONFIGURED" }, { status: 503, headers });
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ code: "EMAIL_RECEIPT_INVALID" }, { status: 400, headers });
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 262144) { await reader.cancel(); return Response.json({ code: "PAYLOAD_TOO_LARGE" }, { status: 413, headers }); }
      chunks.push(value);
    }
  } catch { return Response.json({ code: "EMAIL_RECEIPT_INVALID" }, { status: 400, headers }); }
  const raw = Buffer.concat(chunks).toString("utf8");
  let receipt;
  try { receipt = verifyResendReceipt(raw, request.headers, secret); } catch { return Response.json({ code: "EMAIL_RECEIPT_INVALID" }, { status: 401, headers }); }
  const result = await getSupabaseAdminClient().rpc("record_resend_receipt_v1", { p_event_id: receipt.eventId, p_provider_message_id: receipt.messageId, p_status: receipt.status, p_payload_hash: receipt.hash, p_occurred_at: receipt.occurredAt });
  if (result.error) return Response.json({ code: "EMAIL_RECEIPT_REJECTED" }, { status: 409, headers });
  return Response.json({ received: true }, { headers });
}

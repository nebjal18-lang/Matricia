import { createPaymentGateway } from "@matricia/infrastructure";
import { z } from "zod";
import { getPaymentRuntimeConfig } from "@/modules/shared/lib/env";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";
const sendSchema = z.object({ outcome: z.literal("REFUND_SEND_AUTHORIZED"), capture_id: z.string(), amount_minor: z.string().regex(/^[1-9]\d*$/u), currency: z.string().regex(/^[A-Z]{3}$/u), idempotency_key: z.string().uuid() });
export async function consumeSubscriptionRefund(requestId: string): Promise<{ ok: boolean; code: string }> {
  // Validate runtime configuration before changing the durable request into SENDING.
  let gateway;
  try { gateway = createPaymentGateway(getPaymentRuntimeConfig()); } catch { return { ok: false, code: "REFUND_PROVIDER_UNCONFIGURED" }; }
  if (gateway.code !== "PAYPAL" || !("requestRefund" in gateway)) return { ok: false, code: "REFUND_PROVIDER_UNSUPPORTED" };
  const client = getSupabaseAdminClient();
  const prepared = await client.rpc("prepare_subscription_refund_send_v2", { p_request_id: requestId,p_provider_environment:gateway.providerEnvironment });
  if (prepared.error) return { ok: false, code: "REFUND_RECONCILIATION_REQUIRED" };
  if ((prepared.data as { outcome?: unknown })?.outcome === "REFUND_ALREADY_SUBMITTED") return { ok: true, code: "REFUND_SUBMITTED" };
  const send = sendSchema.safeParse(prepared.data);
  if (!send.success) return { ok: false, code: "REFUND_PREPARATION_INVALID" };
  let refundId: string;
  try {
    const result = await gateway.requestRefund({ captureId: send.data.capture_id, amountMinor: send.data.amount_minor, currency: send.data.currency, idempotencyKey: send.data.idempotency_key });
    refundId = result.refundId;
  } catch {
    await client.rpc("record_subscription_refund_send_v1", { p_request_id: requestId, p_provider_refund_id: null });
    return { ok: false, code: "REFUND_RECONCILIATION_REQUIRED" };
  }
  const recorded = await client.rpc("record_subscription_refund_send_v1", { p_request_id: requestId, p_provider_refund_id: refundId });
  const outcome = (recorded.data as { outcome?: unknown } | null)?.outcome;
  return recorded.error || !["REFUND_AWAITING_WEBHOOK", "REFUND_CONFIRMED"].includes(String(outcome)) ? { ok: false, code: "REFUND_RECONCILIATION_REQUIRED" } : { ok: true, code: "REFUND_SUBMITTED" };
}

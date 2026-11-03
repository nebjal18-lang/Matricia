import { createPaymentGateway } from "@matricia/infrastructure";
import { z } from "zod";
import { getPaymentRuntimeConfig } from "@/modules/shared/lib/env";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";
const schema = z.object({ outcome: z.literal("REFUND_RECONCILIATION_AUTHORIZED"), refund_request_id: z.string().uuid(), provider_refund_id: z.string(), capture_id: z.string(), amount_minor: z.string().regex(/^[1-9]\d*$/u), currency: z.string() });
export async function consumeRefundReconciliation(requestId: string): Promise<{ ok: boolean; code: string }> {
  let gateway;
  try { gateway = createPaymentGateway(getPaymentRuntimeConfig()); } catch { return { ok: false, code: "REFUND_PROVIDER_UNCONFIGURED" }; }
  if (gateway.code !== "PAYPAL" || !("lookupRefund" in gateway)) return { ok: false, code: "REFUND_PROVIDER_UNSUPPORTED" };
  const client = getSupabaseAdminClient(), loaded = await client.rpc("load_refund_reconciliation_work_v2", { p_request_id: requestId,p_provider_environment:gateway.providerEnvironment });
  if (loaded.error) return { ok: false, code: "REFUND_RECONCILIATION_UNAUTHORIZED" };
  if ((loaded.data as { outcome?: unknown })?.outcome === "REFUND_ALREADY_RECONCILED") return { ok: true, code: "REFUND_RECONCILED" };
  const work = schema.safeParse(loaded.data);
  if (!work.success) return { ok: false, code: "REFUND_RECONCILIATION_INVALID" };
  let proof;
  try { proof = await gateway.lookupRefund(work.data.provider_refund_id); } catch { return { ok: false, code: "REFUND_NATIVE_PROOF_UNAVAILABLE" }; }
  if (proof.refundId !== work.data.provider_refund_id || proof.captureId !== work.data.capture_id || proof.invoiceId !== work.data.refund_request_id || proof.amountMinor !== work.data.amount_minor || proof.currency !== work.data.currency || proof.verificationMethod !== "API_OAUTH2_TLS") return { ok: false, code: "REFUND_NATIVE_PROOF_MISMATCH" };
  const recorded = await client.rpc("complete_refund_native_reconciliation_v2", { p_request_id: requestId,p_provider_environment:gateway.providerEnvironment, p_provider_refund_id: proof.refundId, p_capture_id: proof.captureId, p_invoice_id: proof.invoiceId, p_amount_minor: proof.amountMinor, p_currency: proof.currency, p_status: proof.status, p_response_hash: proof.responseHash, p_occurred_at: proof.occurredAt });
  const outcome = (recorded.data as { outcome?: unknown } | null)?.outcome;
  return recorded.error || !["REFUND_RECONCILIATION_CONFIRMED", "REFUND_FAILURE_CONFIRMED"].includes(String(outcome)) ? { ok: false, code: "REFUND_RECONCILIATION_PENDING" } : { ok: true, code: "REFUND_RECONCILED" };
}

import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), lookup: vi.fn(), refund: vi.fn() }));
vi.mock("@matricia/infrastructure", () => ({ createPaymentGateway: () => ({ code: "PAYPAL",providerEnvironment:"SANDBOX", lookupRefund: mocks.lookup, requestRefund: mocks.refund }) }));
vi.mock("@/modules/shared/lib/env", () => ({ getPaymentRuntimeConfig: () => ({}) }));
vi.mock("@/modules/shared/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }));
import { consumeRefundReconciliation } from "./reconciliation-consumer";
const id = "11111111-1111-4111-8111-111111111111", refund = "22222222-2222-4222-8222-222222222222";
const work = { outcome: "REFUND_RECONCILIATION_AUTHORIZED", refund_request_id: refund, provider_refund_id: "REFUND-12345678", capture_id: "CAPTURE-12345678", amount_minor: "1200", currency: "EUR" };
const proof = { refundId: work.provider_refund_id, captureId: work.capture_id, invoiceId: refund, amountMinor: "1200", currency: "EUR", status: "COMPLETED", verificationMethod: "API_OAUTH2_TLS", responseHash: "a".repeat(64), occurredAt: "2026-10-31T12:00:00Z" };
beforeEach(() => { vi.resetAllMocks(); mocks.lookup.mockResolvedValue(proof); });
it("requires a durable approved reconciliation before querying PayPal", async () => {
 mocks.rpc.mockResolvedValue({ error: { code: "42501" } }); expect((await consumeRefundReconciliation(id)).ok).toBe(false); expect(mocks.lookup).not.toHaveBeenCalled(); expect(mocks.refund).not.toHaveBeenCalled();
});
it("verifies exact amount, capture and invoice instead of trusting an operator identifier", async () => {
 mocks.rpc.mockResolvedValue({ data: work, error: null }); mocks.lookup.mockResolvedValue({ ...proof, invoiceId: id });
 expect((await consumeRefundReconciliation(id)).code).toBe("REFUND_NATIVE_PROOF_MISMATCH"); expect(mocks.rpc).toHaveBeenCalledTimes(1); expect(mocks.refund).not.toHaveBeenCalled();
});
it("records a successful authenticated proof without issuing another refund", async () => {
 mocks.rpc.mockResolvedValueOnce({ data: work, error: null }).mockResolvedValueOnce({ data: { outcome: "REFUND_RECONCILIATION_CONFIRMED" }, error: null });
 expect((await consumeRefundReconciliation(id)).ok).toBe(true); expect(mocks.refund).not.toHaveBeenCalled();
 expect(mocks.rpc).toHaveBeenLastCalledWith("complete_refund_native_reconciliation_v2", expect.objectContaining({ p_invoice_id: refund, p_response_hash: proof.responseHash, p_status: "COMPLETED" }));
});
it("does not acknowledge a still-pending native refund", async () => {
 mocks.rpc.mockResolvedValueOnce({ data: work, error: null }).mockResolvedValueOnce({ data: { outcome: "REFUND_STILL_PENDING" }, error: null }); mocks.lookup.mockResolvedValue({ ...proof, status: "PENDING" });
 expect((await consumeRefundReconciliation(id)).ok).toBe(false); expect(mocks.refund).not.toHaveBeenCalled();
});
it("replays a confirmed reconciliation without another provider query", async () => {
 mocks.rpc.mockResolvedValue({ data: { outcome: "REFUND_ALREADY_RECONCILED" }, error: null }); expect((await consumeRefundReconciliation(id)).ok).toBe(true); expect(mocks.lookup).not.toHaveBeenCalled();
});

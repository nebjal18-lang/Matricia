import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), refund: vi.fn() }));
vi.mock("@matricia/infrastructure", () => ({ createPaymentGateway: () => ({ code: "PAYPAL",providerEnvironment:"SANDBOX", requestRefund: mocks.refund }) }));
vi.mock("@/modules/shared/lib/env", () => ({ getPaymentRuntimeConfig: () => ({}) }));
vi.mock("@/modules/shared/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }));
import { consumeSubscriptionRefund } from "./consumer";
const id = "11111111-1111-4111-8111-111111111111";
const prepared = { outcome: "REFUND_SEND_AUTHORIZED", capture_id: "CAPTURE-12345678", amount_minor: "1200", currency: "EUR", idempotency_key: id };
beforeEach(() => vi.resetAllMocks());
it("requires durable four-eyes authorization before calling PayPal", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
  expect(await consumeSubscriptionRefund(id)).toEqual({ ok: false, code: "REFUND_RECONCILIATION_REQUIRED" }); expect(mocks.refund).not.toHaveBeenCalled();
});
it("does not resend a submitted refund", async () => {
  mocks.rpc.mockResolvedValue({ data: { outcome: "REFUND_ALREADY_SUBMITTED" }, error: null });
  expect((await consumeSubscriptionRefund(id)).ok).toBe(true); expect(mocks.refund).not.toHaveBeenCalled();
});
it("records an ambiguous provider result without reporting success", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: prepared, error: null }).mockResolvedValueOnce({ data: {}, error: null }); mocks.refund.mockRejectedValue(new Error("transport timeout"));
  expect((await consumeSubscriptionRefund(id)).ok).toBe(false);
  expect(mocks.rpc).toHaveBeenLastCalledWith("record_subscription_refund_send_v1", { p_request_id: id, p_provider_refund_id: null });
});
it("acknowledges only a provider acceptance durably recorded for webhook reconciliation", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: prepared, error: null }).mockResolvedValueOnce({ data: { outcome: "REFUND_AWAITING_WEBHOOK" }, error: null }); mocks.refund.mockResolvedValue({ refundId: "REFUND-12345678", status: "PENDING_WEBHOOK" });
  expect(await consumeSubscriptionRefund(id)).toEqual({ ok: true, code: "REFUND_SUBMITTED" });
  expect(mocks.refund).toHaveBeenCalledWith({ captureId: prepared.capture_id, amountMinor: "1200", currency: "EUR", idempotencyKey: id });
});

it("does not acknowledge an unknown SQL submission result", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: prepared, error: null }).mockResolvedValueOnce({ data: { outcome: "UNKNOWN" }, error: null }); mocks.refund.mockResolvedValue({ refundId: "REFUND-12345678", status: "PENDING_WEBHOOK" });
  expect((await consumeSubscriptionRefund(id)).ok).toBe(false);
});

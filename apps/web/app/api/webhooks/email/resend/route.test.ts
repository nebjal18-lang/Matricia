import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ environment: vi.fn(), verify: vi.fn(), rpc: vi.fn() }));
vi.mock("@/modules/shared/lib/platform-configuration/runtime", () => ({ getPlatformRuntimeEnvironment: mocks.environment }));
vi.mock("@/modules/shared/lib/notification-delivery/resend-receipt", () => ({ verifyResendReceipt: mocks.verify }));
vi.mock("@/modules/shared/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }));
import { POST } from "./route";
const request = () => new Request("https://app.example/api/webhooks/email/resend", { method: "POST", body: "{\"native\":true}" });
beforeEach(() => vi.clearAllMocks());
it("verifies receipts using the active Admin webhook secret", async () => {
  mocks.environment.mockResolvedValue({ RESEND_WEBHOOK_SECRET: "approved-current-secret" });
  mocks.verify.mockReturnValue({ eventId: "event", messageId: "provider-message", status: "DELIVERED", hash: "a".repeat(64), occurredAt: "2026-11-09T00:00:00Z" });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(mocks.verify).toHaveBeenCalledWith('{"native":true}', expect.any(Headers), "approved-current-secret");
  expect(mocks.rpc).toHaveBeenCalledWith("record_resend_receipt_v1", expect.objectContaining({ p_event_id: "event", p_provider_message_id: "provider-message" }));
  expect(await response.text()).not.toContain("secret");
});
it("fails closed before parsing or writing a receipt if current vault access fails", async () => {
  mocks.environment.mockRejectedValue(new Error("secret provider error"));
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(mocks.verify).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(await response.json()).toEqual({ code: "EMAIL_RECEIPT_UNCONFIGURED" });
});
it("does not use old deployment keys after managed deactivation", async () => {
  mocks.environment.mockResolvedValue({});
  expect((await POST(request())).status).toBe(503);
  expect(mocks.verify).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("rejects a native signature failure without recording a delivery", async () => {
  mocks.environment.mockResolvedValue({ RESEND_WEBHOOK_SECRET: "approved-current-secret" });
  mocks.verify.mockImplementation(() => { throw new Error("signature invalid"); });
  expect((await POST(request())).status).toBe(401);
  expect(mocks.rpc).not.toHaveBeenCalled();
});

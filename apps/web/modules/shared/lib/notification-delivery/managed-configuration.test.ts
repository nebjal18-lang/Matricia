import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ environment: vi.fn() }));
vi.mock("@/modules/shared/lib/platform-configuration/runtime", () => ({ getPlatformRuntimeEnvironment: mocks.environment }));
import { deliverNotification, type NotificationDeliveryJob } from "./adapter";
const job: NotificationDeliveryJob = { deliveryId: "managed-delivery", channel: "EMAIL", recipientEmail: "owner@example.com", locale: "fr-MA", subject: "Configuration", body: "Approved email", ctaPath: null, providerIdempotencyKey: "managed-delivery-idempotence" };
const configured = { EMAIL_DELIVERY_MODE: "EXTERNAL", EMAIL_LIVE_DELIVERY_ENABLED: "true", EMAIL_RECIPIENT_ALLOWLIST: "owner@example.com", RESEND_API_KEY: "approved-configuration-key-123456789", RESEND_FROM_EMAIL: "verified@example.com" };
beforeEach(() => vi.clearAllMocks());
it("uses approved current Admin credentials for real Resend dispatch", async () => {
  mocks.environment.mockResolvedValue(configured);
  const request = vi.fn().mockResolvedValue(Response.json({ id: "managed-resend-id" }));
  const result = await deliverNotification(job, { env: { RESEND_API_KEY: "old-deployment-key" }, fetch: request });
  expect(result).toMatchObject({ outcome: "SENT", providerMessageId: "managed-resend-id" });
  expect(request).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ headers: expect.objectContaining({ authorization: `Bearer ${configured.RESEND_API_KEY}` }) }));
  expect(JSON.stringify(result)).not.toContain(configured.RESEND_API_KEY);
});
it("blocks a disabled managed provider even when deployment credentials remain", async () => {
  mocks.environment.mockResolvedValue({ EMAIL_LIVE_DELIVERY_ENABLED: "false" });
  const request = vi.fn();
  expect(await deliverNotification(job, { env: configured, fetch: request })).toMatchObject({ outcome: "PERMANENT_FAILURE", errorCode: "EMAIL_MODE_UNCONFIGURED" });
  expect(request).not.toHaveBeenCalled();
});
it("retries without network or legacy fallback when vault reads fail", async () => {
  mocks.environment.mockRejectedValue(new Error("private-vault-error-never-forwarded"));
  const request = vi.fn();
  const result = await deliverNotification(job, { env: configured, fetch: request });
  expect(result).toMatchObject({ outcome: "RETRYABLE_FAILURE", errorCode: "EMAIL_CONFIGURATION_UNAVAILABLE" });
  expect(request).not.toHaveBeenCalled();
  expect(JSON.stringify(result)).not.toContain("private-vault-error");
});
it("keeps in-app delivery independent from unrelated provider outages", async () => {
  const result = await deliverNotification({ ...job, channel: "IN_APP" }, { env: {}, fetch: vi.fn() });
  expect(result.outcome).toBe("DELIVERED");
  expect(mocks.environment).not.toHaveBeenCalled();
});

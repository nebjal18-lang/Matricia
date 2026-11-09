import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ active: vi.fn() }));
vi.mock("./repository", () => ({ loadActiveConfigurationEnvironment: mocks.active }));
import { getPlatformRuntimeEnvironment } from "./runtime";
const base = { APP_ENV: "staging", NEXT_PUBLIC_SUPABASE_URL: "https://staging.example", SUPABASE_SERVICE_ROLE_KEY: "bootstrap-service-key", RESEND_API_KEY: "legacy-deployment-key", EMAIL_LIVE_DELIVERY_ENABLED: "true" };
beforeEach(() => vi.clearAllMocks());
it("reads managed state even when the master key is absent and removes disabled legacy keys", async () => {
  mocks.active.mockResolvedValue({ environment: "STAGING", managedSections: ["RESEND"], values: {} });
  const environment = await getPlatformRuntimeEnvironment(base);
  expect(mocks.active).toHaveBeenCalledWith(base);
  expect(environment.RESEND_API_KEY).toBeUndefined();
  expect(environment.EMAIL_LIVE_DELIVERY_ENABLED).toBe("false");
});
it("fails closed on any vault read or decryption failure without falling back to deployment keys", async () => {
  mocks.active.mockRejectedValue(new Error("CONFIGURATION_SECRETS_UNAVAILABLE"));
  await expect(getPlatformRuntimeEnvironment(base)).rejects.toThrow("CONFIGURATION_SECRETS_UNAVAILABLE");
  expect(base.RESEND_API_KEY).toBe("legacy-deployment-key");
});
it("observes deactivation on the next call without a stale cache", async () => {
  mocks.active.mockResolvedValueOnce({ environment: "STAGING", managedSections: ["RESEND"], values: { RESEND_API_KEY: "active-approved-key", EMAIL_LIVE_DELIVERY_ENABLED: "true" } });
  mocks.active.mockResolvedValueOnce({ environment: "STAGING", managedSections: ["RESEND"], values: {} });
  expect((await getPlatformRuntimeEnvironment(base)).RESEND_API_KEY).toBe("active-approved-key");
  expect((await getPlatformRuntimeEnvironment(base)).RESEND_API_KEY).toBeUndefined();
  expect(mocks.active).toHaveBeenCalledTimes(2);
});
it("refuses a different database environment even if the returned integration is otherwise valid", async () => {
  mocks.active.mockResolvedValue({ environment: "PRODUCTION", managedSections: ["RESEND"], values: { RESEND_API_KEY: "different-environment-key" } });
  await expect(getPlatformRuntimeEnvironment(base)).rejects.toThrow("PLATFORM_CONFIGURATION_ENVIRONMENT_MISMATCH");
});

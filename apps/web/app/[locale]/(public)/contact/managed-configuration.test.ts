import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ environment: vi.fn(), rpc: vi.fn(), deliver: vi.fn() }));
vi.mock("@/modules/shared/lib/platform-configuration/runtime", () => ({ getPlatformRuntimeEnvironment: mocks.environment }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/modules/shared/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/modules/shared/lib/notification-delivery/adapter", () => ({ deliverNotification: mocks.deliver }));
import { submitContactRequest } from "./actions";
const form = () => {
  const input = new FormData();
  for (const [key,value] of Object.entries({ locale:"fr",category:"CLIENT",replyEmail:"visitor@example.com",message:"Une demande professionnelle à enregistrer.",website:"" })) input.set(key,value);
  return input;
};
beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: "12345678-1234-4234-8234-123456789abc", error: null }); mocks.deliver.mockResolvedValue({ outcome: "SENT" }); });
it("routes persisted public requests to the approved company contact address", async () => {
  mocks.environment.mockResolvedValue({ PUBLIC_CONTACT_NOTIFICATION_EMAIL: "approved-support@example.com" });
  expect(await submitContactRequest({ status:"idle" },form())).toEqual({ status:"success",reference:"12345678" });
  expect(mocks.deliver).toHaveBeenCalledWith(expect.objectContaining({recipientEmail:"approved-support@example.com"}),expect.objectContaining({env:expect.objectContaining({PUBLIC_CONTACT_NOTIFICATION_EMAIL:"approved-support@example.com"})}));
});
it("does not revive a removed support address after company deactivation", async () => {
  mocks.environment.mockResolvedValue({});
  expect((await submitContactRequest({ status:"idle" },form())).status).toBe("success");
  expect(mocks.deliver).not.toHaveBeenCalled();
});
it("preserves the persisted intake but sends nothing when current configuration cannot be read", async () => {
  mocks.environment.mockRejectedValue(new Error("private vault unavailable"));
  expect((await submitContactRequest({ status:"idle" },form())).status).toBe("success");
  expect(mocks.deliver).not.toHaveBeenCalled();
});

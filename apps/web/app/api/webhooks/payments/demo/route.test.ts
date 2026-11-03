import { afterEach, expect, it, vi } from "vitest";
const { admin } = vi.hoisted(() => ({ admin: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/admin", () => ({ getSupabaseAdminClient: admin }));
import { POST } from "./route";
afterEach(() => vi.unstubAllEnvs());
it.each(["NODE_ENV", "APP_ENV"])("blocks a DEMO webhook when %s is production even with a configured secret", async name => {
  vi.stubEnv("PAYMENT_PROVIDER", "DEMO"); vi.stubEnv("PAYMENT_PROVIDER_ALLOWLIST", "DEMO"); vi.stubEnv("PAYMENT_WEBHOOK_SECRET_DEMO", "s".repeat(32)); vi.stubEnv(name, "production");
  expect((await POST(new Request("https://app.example.com/api/webhooks/payments/demo", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }))).status).toBe(503);
  expect(admin).not.toHaveBeenCalled();
});

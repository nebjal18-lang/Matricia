import { beforeEach, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => ({ rpc }) }));
import { withOperationalHeartbeat } from "./heartbeat";
beforeEach(() => rpc.mockReset().mockResolvedValue({ error: null }));
it("records a successful cron and bounded duration", async () => {
  const response = await withOperationalHeartbeat("NOTIFICATIONS", 180, async () => new Response("ok"));
  expect(response.status).toBe(200);
  expect(rpc).toHaveBeenCalledWith("record_operational_job_run_v1", { p_service_code: "NOTIFICATIONS", p_healthy: true, p_expires_after_seconds: 180, p_duration_ms: expect.any(Number) });
});
it("does not let unauthorized traffic refresh a stopped cron", async () => {
  expect((await withOperationalHeartbeat("NOTIFICATIONS", 180, async () => new Response(null, { status: 401 }))).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});
it("attests a failed cycle without leaking its exception", async () => {
  const response = await withOperationalHeartbeat("NOTIFICATIONS", 180, async () => { throw new Error("recipient secret"); });
  expect(response.status).toBe(503); expect(await response.text()).not.toContain("recipient secret");
  expect(rpc).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ p_healthy: false }));
});
it("fails the invocation when heartbeat evidence cannot be persisted", async () => {
  rpc.mockResolvedValue({ error: { message: "internal SQL" } });
  expect((await withOperationalHeartbeat("NOTIFICATIONS", 180, async () => new Response("ok"))).status).toBe(503);
});

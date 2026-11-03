import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), scan: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/admin", () => ({ getSupabaseAdminClient: mocks.admin }));
vi.mock("@/modules/shared/lib/finance-cost-proofs/scan-consumer", () => ({ scanOneFinanceCostDocument: mocks.scan }));
import { POST } from "./route";
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("CRON_SECRET", "t".repeat(32)); mocks.admin.mockReturnValue({ trusted: true }); });
afterEach(() => { vi.unstubAllEnvs(); });
describe("Finance proof scan service endpoint", () => {
  it("does not create a service client for an unauthorized caller", async () => {
    expect((await POST(new Request("https://matricia.example/api/workers/finance-cost-scans", { method: "POST" }))).status).toBe(401);
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.scan).not.toHaveBeenCalled();
  });
  it("returns a real dependency failure for a pending scan rather than an ACK", async () => {
    mocks.scan.mockResolvedValue({ ok: false, code: "FINANCE_COST_SCAN_UNAVAILABLE", scanStatus: "ERROR" });
    const response = await POST(new Request("https://matricia.example/api/workers/finance-cost-scans", { method: "POST", headers: { authorization: `Bearer ${"t".repeat(32)}` } }));
    expect(response.status).toBe(503);
    expect((await response.json()).scan_status).toBe("ERROR");
  });
  it("reports a genuinely empty unfiltered sweep", async () => {
    mocks.scan.mockResolvedValue({ ok: true, code: "NO_JOB" });
    const response = await POST(new Request("https://matricia.example/api/workers/finance-cost-scans", { method: "POST", headers: { authorization: `Bearer ${"t".repeat(32)}` } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: "NO_JOB" });
  });
});

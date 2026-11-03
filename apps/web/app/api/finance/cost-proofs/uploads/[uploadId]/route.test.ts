import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ transfer: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/admin", () => ({ getSupabaseAdminClient: vi.fn(() => { throw new Error("UNEXPECTED_ADMIN_READ"); }) }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: vi.fn(() => { throw new Error("UNEXPECTED_SESSION_READ"); }) }));
vi.mock("@/modules/shared/lib/finance-cost-proofs/server", () => ({ transferFinanceCostDocument: mocks.transfer, financeCostFileFailure: (code: string, status: number) => Response.json({ code }, { status }) }));
import { POST } from "./route";
const id = "e3700000-0000-4000-8000-000000000001";
const request = (origin: string, body = "{}") => new Request(`https://matricia.example/api/finance/cost-proofs/uploads/${id}`, { method: "POST", headers: { "content-type": "application/json", origin, "sec-fetch-site": origin === "https://matricia.example" ? "same-origin" : "cross-site" }, body });
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://matricia.example"); mocks.transfer.mockResolvedValue(Response.json({ outcome: "FINANCE_COST_DOCUMENT_UPLOADED", upload_id: id, scan_status: "PENDING" })); });
afterEach(() => { vi.unstubAllEnvs(); });
describe("Finance evidence upload commit HTTP boundary", () => {
  it("denies a cross-origin mutation before native authorization or storage", async () => {
    const response = await POST(request("https://outsider.example"), { params: Promise.resolve({ uploadId: id }) });
    expect(response.status).toBe(403);
    expect(mocks.transfer).not.toHaveBeenCalled();
  });
  it("fails closed when the local runtime public URL differs from the browser origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://matricia.test.invalid");
    const localRequest = () => new Request(`http://127.0.0.1:19273/api/finance/cost-proofs/uploads/${id}`, {
      method: "POST", headers: { "content-type": "application/json", origin: "http://127.0.0.1:19273", "sec-fetch-site": "same-origin" }, body: "{}",
    });
    const denied = await POST(localRequest(), { params: Promise.resolve({ uploadId: id }) });
    expect(denied.status).toBe(403);
    expect(await denied.json()).toEqual({ code: "REQUEST_ORIGIN_DENIED" });
    expect(mocks.transfer).not.toHaveBeenCalled();

    // Correct the test runtime, retaining the exact origin check and original reservation.
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:19273");
    const resumed = await POST(localRequest(), { params: Promise.resolve({ uploadId: id }) });
    expect(resumed.status).toBe(200);
    expect(await resumed.json()).toMatchObject({ upload_id: id, scan_status: "PENDING" });
    expect(mocks.transfer).toHaveBeenCalledExactlyOnceWith(id, true);
  });
  it("does not accept caller hashes, scan verdicts or arbitrary target fields", async () => {
    const response = await POST(request("https://matricia.example", JSON.stringify({ scan_status: "CLEAN", sha256: "a".repeat(64), target_id: id })), { params: Promise.resolve({ uploadId: id }) });
    expect(response.status).toBe(400);
    expect(mocks.transfer).not.toHaveBeenCalled();
  });
  it("delegates only the exact native upload ID after a same-origin empty request", async () => {
    const response = await POST(request("https://matricia.example"), { params: Promise.resolve({ uploadId: id }) });
    expect(response.status).toBe(200);
    expect(mocks.transfer).toHaveBeenCalledWith(id, true);
  });
});

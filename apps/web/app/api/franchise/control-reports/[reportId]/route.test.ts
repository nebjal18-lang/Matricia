import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { nativeControlFixture } from "@/modules/franchise/data/performance/native-control.fixture";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn(), response: null as unknown }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ auth: { getUser: mocks.auth }, from: mocks.from }) }));
const reportId = "a3651000-0000-4000-8000-000000000001";
const get = () => GET(new Request(`http://localhost/api/franchise/control-reports/${reportId}`), { params: Promise.resolve({ reportId }) });
beforeEach(() => {
  vi.clearAllMocks(); mocks.auth.mockResolvedValue({ data: { user: { id: "test" } }, error: null }); mocks.response = { data: nativeControlFixture().reports[0], error: null };
  mocks.from.mockImplementation(() => { const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: async () => mocks.response }; query.select.mockReturnValue(query); query.eq.mockReturnValue(query); return query; });
});
describe("private native control exports", () => {
  it("downloads only the authorized immutable report and disables caching", async () => {
    const response = await get(); expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await response.json()).source_evidence_hash).toBe("a".repeat(64)); expect(mocks.from).toHaveBeenCalledExactlyOnceWith("franchise_control_reports_v1");
  });
  it("does not reveal existence when RLS hides a foreign report", async () => {
    mocks.response = { data: null, error: null }; const response = await get(); expect(response.status).toBe(404); expect(await response.json()).toEqual({ error: "NOT_FOUND" });
  });
  it("reports an Auth outage distinctly from session absence", async () => {
    mocks.auth.mockResolvedValue({ data: { user: { id: "cached" } }, error: { status: 503 } }); expect((await get()).status).toBe(503); expect(mocks.from).not.toHaveBeenCalled();
    mocks.auth.mockResolvedValue({ data: { user: null }, error: { status: 401 } }); expect((await get()).status).toBe(401); expect(mocks.from).not.toHaveBeenCalled();
  });
  it("does not export malformed or mismatched records as success", async () => {
    mocks.response = { data: { ...nativeControlFixture().reports[0], id: "a3651000-0000-4000-8000-000000000002" }, error: null }; expect((await get()).status).toBe(503);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordNativePlanProgress } from "./native-plan-actions";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ auth: { getUser: mocks.auth }, rpc: mocks.rpc }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
const form = () => { const f = new FormData(); Object.entries({ locale: "ar", planId: "a3652000-0000-4000-8000-000000000001", kind: "PROGRESS", comment: "Texte français du responsable", progress: "25", idempotencyKey: "a3653000-0000-4000-8000-000000000001" }).forEach(([key, value]) => f.set(key, value)); return f; };
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ data: { user: { id: "test" } }, error: null }); mocks.rpc.mockResolvedValue({ data: { outcome: "FRANCHISE_CONTROL_PLAN_EVENT_RECORDED", eventId: 1 }, error: null }); });
describe("native corrective plan commands", () => {
  it("passes the exact selected plan, stable key and original comment to server authority", async () => {
    expect(await recordNativePlanProgress({ status: "idle" }, form())).toEqual({ status: "success" });
    expect(mocks.rpc).toHaveBeenCalledWith("record_franchise_control_plan_event_v1", { p_plan_id: "a3652000-0000-4000-8000-000000000001", p_kind: "PROGRESS", p_comment: "Texte français du responsable", p_progress_percent: 25, p_idempotency_key: "a3653000-0000-4000-8000-000000000001" });
    expect(mocks.revalidate).toHaveBeenCalledWith("/ar/franchise/performance");
  });
  it("does not convert an Auth outage into a successful or permission-denied mutation", async () => {
    mocks.auth.mockResolvedValue({ data: { user: { id: "cached" } }, error: { status: 503 } });
    expect(await recordNativePlanProgress({ status: "idle" }, form())).toEqual({ status: "error", reason: "QUERY_FAILED" }); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("keeps a server scope/MFA refusal explicit", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    expect(await recordNativePlanProgress({ status: "idle" }, form())).toEqual({ status: "error", reason: "FORBIDDEN" }); expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("distinguishes MFA and an unfinished remeasurement from a technical incident", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "FRANCHISE_CONTROL_ADMIN_AAL2_REQUIRED" } });
    expect(await recordNativePlanProgress({ status: "idle" }, form())).toEqual({ status: "error", reason: "MFA_REQUIRED" });
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "23514", message: "FRANCHISE_CONTROL_REMEASUREMENT_REQUIRED" } });
    expect(await recordNativePlanProgress({ status: "idle" }, form())).toEqual({ status: "error", reason: "CONFLICT" });
  });
  it("requires a finite integer progress and does not accept arbitrary action names", async () => {
    const invalid = form(); invalid.set("progress", "101"); expect(await recordNativePlanProgress({ status: "idle" }, invalid)).toEqual({ status: "error", reason: "VALIDATION" });
    invalid.set("kind", "SUSPEND_FRANCHISE"); expect(await recordNativePlanProgress({ status: "idle" }, invalid)).toEqual({ status: "error", reason: "VALIDATION" }); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not turn malformed acknowledgements into success", async () => {
    mocks.rpc.mockResolvedValue({ data: { outcome: "UNKNOWN" }, error: null }); expect(await recordNativePlanProgress({ status: "idle" }, form())).toEqual({ status: "error", reason: "QUERY_FAILED" }); expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});

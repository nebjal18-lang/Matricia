import { beforeEach, describe, expect, it, vi } from "vitest";

const complete = vi.fn();
const transition = vi.fn();
vi.mock("@/modules/shared/lib/diagnostics-opportunities/server-repository", () => ({ createServerDiagnosticsRepository: async () => ({ complete, transition }) }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { completeAction, opportunityAction } from "./actions";

function form(value: Record<string, string>) { const data = new FormData(); Object.entries(value).forEach(([key, item]) => data.set(key, item)); return data; }
const base = { locale: "fr", idempotencyKey: "00000000-0000-4000-8000-000000000001" };

describe("diagnostic actions", () => {
  beforeEach(() => { transition.mockReset(); complete.mockReset(); });
  const opportunity = { ...base, runId: "00000000-0000-4000-8000-000000000002", opportunityId: "00000000-0000-4000-8000-000000000003", action: "DEFER", rowVersion: "1" };
  it.each(["2026-02-30", "2026-13-01"])("rejects impossible deferral %s before RPC", async (deferredUntil) => {
    transition.mockResolvedValue({ status: "success" });
    expect(await opportunityAction({ status: "idle" }, form({ ...opportunity, deferredUntil }))).toEqual({ status: "error", reason: "VALIDATION" });
    expect(transition).not.toHaveBeenCalled();
  });
  it.each([["2024-11-01", "2024-11-01T22:59:59.000Z"], ["2024-03-15", "2024-03-15T23:59:59.000Z"]])("uses Casablanca end of day for %s", async (deferredUntil, expected) => {
    transition.mockResolvedValue({ status: "success" });
    expect(await opportunityAction({ status: "idle" }, form({ ...opportunity, deferredUntil }))).toEqual({ status: "success" });
    expect(transition).toHaveBeenCalledWith(expect.objectContaining({ deferredUntil: expected }));
  });
  it("rejects malformed completion before RPC", async () => {
    expect(await completeAction({ status: "idle" }, form({ ...base, sessionId: "bad", serviceId: "bad" }))).toEqual({ status: "error", reason: "VALIDATION" });
    expect(complete).not.toHaveBeenCalled();
  });
  it("requires a date to defer", async () => {
    expect(await opportunityAction({ status: "idle" }, form({ ...base, runId: "00000000-0000-4000-8000-000000000002", opportunityId: "00000000-0000-4000-8000-000000000003", action: "DEFER", deferredUntil: "", rowVersion: "1" }))).toEqual({ status: "error", reason: "VALIDATION" });
    expect(transition).not.toHaveBeenCalled();
  });
});

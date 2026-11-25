import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ rpc }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { actOnPublicDiagnosticOpportunity, promotePublicDiagnostic } from "./public-diagnostic-actions";

const idle = { status: "idle" as const };
const ids = { locale: "fr", intakeId: "00000000-0000-4000-8000-000000000002", opportunityId: "00000000-0000-4000-8000-000000000003", idempotencyKey: "00000000-0000-4000-8000-000000000004" };
function form(values: Record<string, string>) { const data = new FormData(); Object.entries(values).forEach(([key, value]) => data.set(key, value)); return data; }

beforeEach(() => rpc.mockReset());

describe("public diagnostic promotion", () => {
  it("rejects a deferral without a date before calling the database", async () => {
    await expect(actOnPublicDiagnosticOpportunity(idle, form({ ...ids, action: "DEFER", deferredUntil: "", rowVersion: "1" }))).resolves.toEqual({ status: "error", reason: "VALIDATION" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("promotes the saved first-visit intake", async () => {
    rpc.mockResolvedValue({ data: { outcome: "PUBLIC_DIAGNOSTIC_PROMOTED" }, error: null });
    await expect(promotePublicDiagnostic(idle, form(ids))).resolves.toEqual({ status: "success" });
    expect(rpc).toHaveBeenCalledWith("promote_public_diagnostic_intake", { p_intake_id: ids.intakeId, p_idempotency_key: ids.idempotencyKey });
  });

  it("returns the need intake created for a quote request", async () => {
    rpc.mockResolvedValue({ data: { status: "NEED_REQUESTED", need_intake_id: ids.intakeId, service_code: "IT-BACKUP" }, error: null });
    await expect(actOnPublicDiagnosticOpportunity(idle, form({ ...ids, action: "REQUEST_QUOTES", deferredUntil: "", rowVersion: "1" }))).resolves.toEqual({ status: "success", opportunityId: ids.opportunityId, needIntakeId: ids.intakeId, serviceCode: "IT-BACKUP" });
    expect(rpc).toHaveBeenCalledWith("act_on_public_diagnostic_opportunity", expect.objectContaining({ p_action: "REQUEST_QUOTES", p_deferred_until: null }));
  });

  it("refuses a quote request answer without a need intake", async () => {
    rpc.mockResolvedValue({ data: { status: "NEED_REQUESTED", need_intake_id: null, service_code: null }, error: null });
    await expect(actOnPublicDiagnosticOpportunity(idle, form({ ...ids, action: "REQUEST_QUOTES", deferredUntil: "", rowVersion: "1" }))).resolves.toEqual({ status: "error", reason: "UNAVAILABLE" });
  });

  it("scopes an ignore decision to its opportunity", async () => {
    rpc.mockResolvedValue({ data: { status: "CLOSED", need_intake_id: null, service_code: null }, error: null });
    await expect(actOnPublicDiagnosticOpportunity(idle, form({ ...ids, action: "CLOSE", deferredUntil: "", rowVersion: "1" }))).resolves.toEqual({ status: "success", opportunityId: ids.opportunityId });
  });
});

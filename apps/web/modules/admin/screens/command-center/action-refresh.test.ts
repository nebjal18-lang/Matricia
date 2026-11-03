import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), refresh: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({ auth: { getUser: mocks.auth }, rpc: mocks.rpc }),
}));
import { claimAdminWork, resolveAdminWork, decideAdminAction, requestAdminAction, sweepExceptionsFromCenter } from "./actions";
const id = "11111111-1111-4111-8111-111111111111";
function form(locale: string) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ locale, idempotencyKey: id, workItemId: id, expectedRowVersion: "2", reason: "Décision humaine après vérification", resolutionCode: "COMPLETED", evidence: "{}", actionRequestId: id, decision: "APPROVE", actionType: "MANUAL_EXCEPTION", targetEnvironment: "STAGING", resourceType: "mission", resourceId: id, requestPayloadHash: "a".repeat(64), redactedSummary: "{}" })) data.set(key, value);
  return data;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ data: { user: { id } } });
  mocks.rpc.mockResolvedValue({ data: { outcome: "ADMIN_OPERATION_RECORDED" }, error: null });
});
for (const [name, action] of Object.entries({ claimAdminWork, resolveAdminWork, decideAdminAction, requestAdminAction, sweepExceptionsFromCenter })) {
  describe(name, () => {
    it.each(["fr", "ar"])("refreshes the %s command center once after a valid receipt", async locale => {
      expect(await action({ status: "idle" }, form(locale))).toMatchObject({ status: "success" });
      expect(mocks.refresh).toHaveBeenCalledExactlyOnceWith(`/${locale}/administration/command-center`);
    });
    it.each([
      { error: { code: "42501" }, data: null },
      { error: { code: "40001" }, data: null },
      { error: null, data: { unexpected: true } },
    ])("does not announce a refreshed success after rejection or an invalid receipt", async response => {
      mocks.rpc.mockResolvedValue(response);
      expect(await action({ status: "idle" }, form("fr"))).toMatchObject({ status: "error" });
      expect(mocks.refresh).not.toHaveBeenCalled();
    });
    it("does not refresh or call the RPC without a session", async () => {
      mocks.auth.mockResolvedValue({ data: { user: null } });
      expect(await action({ status: "idle" }, form("ar"))).toEqual({ status: "error", reason: "UNAUTHENTICATED" });
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(mocks.refresh).not.toHaveBeenCalled();
    });
  });
}

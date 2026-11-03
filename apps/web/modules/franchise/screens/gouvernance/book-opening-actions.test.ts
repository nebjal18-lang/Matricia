import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), assurance: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/modules/shared/lib/account-security/platform-access", () => ({ loadMyPlatformAccess: mocks.access }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { loadBookOpeningContext, openFranchiseBookForMandate } from "./book-opening-actions";
const id = "11111111-1111-4111-8111-111111111111", mandate = "22222222-2222-4222-8222-222222222222", rule = "33333333-3333-4333-8333-333333333333";
const idle = { status: "idle" } as const;
const access = () => ({ status: "ok", roles: new Set(["FINANCE_MANAGER"]), requirementSatisfied: true, client: { rpc: mocks.rpc, auth: { mfa: { getAuthenticatorAssuranceLevel: mocks.assurance } } } });
function form() { const value = new FormData(); Object.entries({ locale: "ar", franchiseId: id, approvedMandateVersionId: mandate, expectedMandateHash: "a".repeat(64), financeRuleId: rule, currency: "MAD", idempotencyKey: "44444444-4444-4444-8444-444444444444" }).forEach(([k,v]) => value.set(k,v)); return value; }
beforeEach(() => {
  mocks.access.mockReset().mockResolvedValue(access()); mocks.assurance.mockReset().mockResolvedValue({ data: { currentLevel: "aal2" }, error: null });
  mocks.rpc.mockReset().mockResolvedValue({ data: { outcome: "FRANCHISE_PNL_BOOK_OPENED", book_id: rule, franchise_id: id, approved_mandate_version_id: mandate, basis_hash: "b".repeat(64) }, error: null }); mocks.revalidate.mockReset();
});
describe("native approved mandate book opening", () => {
  it("submits the exact approved basis and keeps the same key on a retry", async () => {
    const f = form(); const first = await openFranchiseBookForMandate(idle, f); const second = await openFranchiseBookForMandate(idle, f);
    expect(first).toEqual({ status: "success", bookId: rule, franchiseId: id }); expect(second).toEqual(first);
    expect(mocks.rpc).toHaveBeenCalledWith("open_franchise_pnl_book_for_mandate_v1", { p_franchise_id: id, p_approved_mandate_version_id: mandate, p_expected_mandate_hash: "a".repeat(64), p_currency: "MAD", p_rule_version_id: rule, p_idempotency_key: "44444444-4444-4444-8444-444444444444" });
    expect(mocks.revalidate).toHaveBeenCalledWith("/ar/administration/gouvernance-franchise/livres");
  });
  it.each(["franchiseId", "approvedMandateVersionId", "expectedMandateHash", "financeRuleId", "currency", "locale", "idempotencyKey"])("rejects invalid %s before any access or write", async field => {
    const f = form(); f.set(field, "invalid"); expect(await openFranchiseBookForMandate(idle, f)).toEqual({ status: "error", reason: "VALIDATION" }); expect(mocks.access).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not mistake an Admin reader for an authorized financial writer", async () => {
    mocks.access.mockResolvedValue({ ...access(), roles: new Set(["MATRICIA_ADMIN"]) }); expect(await openFranchiseBookForMandate(idle, form())).toEqual({ status: "error", reason: "FORBIDDEN" }); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["aal1", null])("requires actual current AAL2 even when policy is satisfied (%s)", async currentLevel => {
    mocks.assurance.mockResolvedValue({ data: { currentLevel }, error: null }); expect(await openFranchiseBookForMandate(idle, form())).toEqual({ status: "error", reason: "MFA_REQUIRED" }); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([["40001", "FRANCHISE_MANDATE_CHANGED", "CHANGED"], ["55000", "FRANCHISE_LEGACY_BOOK_RECONCILIATION_REQUIRED", "RECONCILIATION"], ["42501", "FRANCHISE_BOOK_DENIED", "FORBIDDEN"], ["08006", "transport", "UNAVAILABLE"]])("keeps %s/%s distinct", async (code, message, reason) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message } }); expect(await openFranchiseBookForMandate(idle, form())).toEqual({ status: "error", reason }); expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("never accepts a success receipt for a different mandate", async () => {
    mocks.rpc.mockResolvedValue({ data: { outcome: "FRANCHISE_PNL_BOOK_OPENED", book_id: rule, franchise_id: id, approved_mandate_version_id: rule, basis_hash: "b".repeat(64) }, error: null });
    expect(await openFranchiseBookForMandate(idle, form())).toEqual({ status: "error", reason: "UNAVAILABLE" }); expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("reads a complete selector for the exact scoped franchise", async () => {
    const context = { complete: true, reviewRequired: true, choices: [] }; mocks.rpc.mockResolvedValue({ data: context, error: null });
    expect(await loadBookOpeningContext(id)).toEqual({ status: "success", context }); expect(mocks.rpc).toHaveBeenCalledWith("franchise_book_opening_context_v1", { p_franchise_id: id });
  });
  it("does not present a partial selector or query error as no eligible mandate", async () => {
    mocks.rpc.mockResolvedValue({ data: { complete: false, choices: [], reviewRequired: false }, error: null }); expect(await loadBookOpeningContext()).toEqual({ status: "error", reason: "UNAVAILABLE" });
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "54000" } }); expect(await loadBookOpeningContext()).toEqual({ status: "error", reason: "SCOPE_REQUIRED" });
  });
  it("preserves expired sessions and network incidents without a write", async () => {
    mocks.access.mockResolvedValue({ status: "error", reason: "UNAUTHENTICATED" }); expect(await openFranchiseBookForMandate(idle, form())).toEqual({ status: "error", reason: "UNAUTHENTICATED" });
    mocks.access.mockRejectedValue(new Error("network")); expect(await openFranchiseBookForMandate(idle, form())).toEqual({ status: "error", reason: "UNAVAILABLE" }); expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

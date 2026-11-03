import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), access: vi.fn(), assurance: vi.fn() }));
vi.mock("@/modules/shared/lib/account-security/platform-access", () => ({ loadMyPlatformAccess: mocks.access }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }));
vi.mock("@/modules/shared/lib/i18n/locale", () => ({ isLocale: (value: string) => value === "fr" || value === "ar" }));
vi.mock("@/modules/franchise/data/governance/model", async () => await import("@/modules/franchise/data/governance/model"));
import { acceptInvitation, createEntryFee, recordPayout, decideGovernance, closeProfitPeriod, type FranchiseActionState } from "./actions";
const idle: FranchiseActionState = { status: "idle" }, id = "11111111-1111-4111-8111-111111111111", key = "22222222-2222-4222-8222-222222222222";
function form() { const value = new FormData(); value.set("locale", "fr"); value.set("idempotencyKey", key); return value; }
beforeEach(() => { mocks.assurance.mockReset().mockResolvedValue({ data: { currentLevel: "aal2" }, error: null }); mocks.access.mockReset().mockResolvedValue({ status: "ok", roles: new Set(["SUPER_ADMIN"]), requirementSatisfied: true, client: { auth: { mfa: { getAuthenticatorAssuranceLevel: mocks.assurance } }, rpc: mocks.rpc } }); mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "u" } } }); mocks.rpc.mockReset().mockResolvedValue({ data: { outcome: "RECORDED" }, error: null }); });
describe("franchise governance actions", () => {
  it("hashes invitation tokens before the RPC", async () => { const value = form(); value.set("invitationId", id); value.set("invitationToken", "temporary-invitation-token-123"); value.set("rowVersion", "1"); await acceptInvitation(idle, value); expect(mocks.rpc).toHaveBeenCalledWith("accept_franchise_invitation", expect.objectContaining({ p_token_hash: "e2f595650024f843fa314306e78da1b887c1565080f8ccfe3adde5347f6bc3d7" })); expect(mocks.rpc.mock.calls[0]?.[1]).not.toHaveProperty("p_token"); });
  it("sends exact minor-unit strings for the IT exemption", async () => { const value = form(); Object.entries({ bookId: id, mode: "EXEMPT", principalMinor: "0", depositMinor: "0", withholdingBps: "", installmentCount: "", startsOn: "2026-09-10", dueOn: "2026-09-10" }).forEach(([name, content]) => value.set(name, content)); await createEntryFee(idle, value); expect(mocks.rpc).toHaveBeenCalledWith("create_franchise_entry_fee_schedule", expect.objectContaining({ p_principal_minor: "0", p_deposit_minor: "0", p_withholding_bps: null })); });
  it("never converts a payout amount to Number", async () => { const value = form(); Object.entries({ bookId: id, beneficiaryCode: "HATIM_AHMITECH", amountMinor: "9007199254740993", journalId: "33333333-3333-4333-8333-333333333333", reference: "VIR-2026-09", proofHash: "a".repeat(64) }).forEach(([name, content]) => value.set(name, content)); await recordPayout(idle, value); expect(mocks.rpc).toHaveBeenCalledWith("record_franchise_distribution_payout", expect.objectContaining({ p_amount_minor: "9007199254740993" })); });
});


function payoutForm() {
  const f = form(); Object.entries({ bookId: id, beneficiaryCode: "HATIM_AHMITECH", amountMinor: "10000", journalId: key, reference: "TEST_REFERENCE", proofHash: "a".repeat(64) }).forEach(([k,v])=>f.set(k,v)); return f;
}
function access(roles: string[], requirementSatisfied: boolean) {
  return { status: "ok", roles: new Set(roles), requirementSatisfied, client: { auth: { mfa: { getAuthenticatorAssuranceLevel: mocks.assurance } }, rpc: mocks.rpc } };
}
describe("governance prerequisites remain distinct", () => {
  it("rejects a non-finance role before MFA and before any financial mutation", async () => {
    mocks.access.mockResolvedValue(access(["MATRICIA_ADMIN"], false));
    await expect(recordPayout(idle, payoutForm())).resolves.toEqual({ status: "error", reason: "FORBIDDEN" });
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.assurance).not.toHaveBeenCalled();
  });
  it("asks an assigned finance actor to satisfy MFA before any mutation", async () => {
    mocks.access.mockResolvedValue(access(["FINANCE_MANAGER"], false));
    await expect(recordPayout(idle, payoutForm())).resolves.toEqual({ status: "error", reason: "MFA_REQUIRED" }); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("retains financial SQL's explicit AAL2 condition even when an account policy is satisfied at AAL1", async () => {
    mocks.access.mockResolvedValue(access(["FINANCE_MANAGER"], true)); mocks.assurance.mockResolvedValue({ data: { currentLevel: "aal1" }, error: null });
    await expect(recordPayout(idle, payoutForm())).resolves.toEqual({ status: "error", reason: "MFA_REQUIRED" }); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("keeps an actual independent-decision refusal as forbidden after successful prerequisites", async () => {
    const f = form(); Object.entries({ approvalRequestId: id, decision: "APPROVE", reason: "Décision de recette indépendante", rowVersion: "1" }).forEach(([k,v])=>f.set(k,v));
    mocks.access.mockResolvedValue(access(["MATRICIA_ADMIN"], true)); mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "FRANCHISE_APPROVAL_DENIED" } });
    await expect(decideGovernance(idle,f)).resolves.toEqual({ status: "error", reason: "FORBIDDEN" }); expect(mocks.assurance).not.toHaveBeenCalled();
  });
  it("distinguishes unavailable account security from an expired session", async () => {
    mocks.access.mockResolvedValue({ status: "error", reason: "QUERY_FAILED" });
    await expect(recordPayout(idle,payoutForm())).resolves.toEqual({ status: "error", reason: "FAILED" });
    mocks.access.mockResolvedValue({ status: "error", reason: "UNAUTHENTICATED" });
    await expect(recordPayout(idle,payoutForm())).resolves.toEqual({ status: "error", reason: "UNAUTHENTICATED" }); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("preserves legacy invitation mode requirements and keeps Auth503 distinct from401", async () => {
    const f = form(); f.set("invitationId",id); f.set("invitationToken","temporary-invitation-token-123"); f.set("rowVersion","1");
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } });
    await expect(acceptInvitation(idle,f)).resolves.toEqual({ status: "error", reason: "FAILED" });
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
    await expect(acceptInvitation(idle,f)).resolves.toEqual({ status: "error", reason: "UNAUTHENTICATED" }); expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.access).not.toHaveBeenCalled();
  });
  it("does not submit a close while assurance transport is unavailable", async () => {
    const f = form(); Object.entries({ bookId:id, periodStart:"2026-10-01",periodEnd:"2026-10-31", ruleVersionId:id, cutoffAt:"2026-10-31T23:00",reason:"Clôture de recette financière" }).forEach(([k,v])=>f.set(k,v));
    mocks.assurance.mockResolvedValue({ data: null,error:{status:503} });
    await expect(closeProfitPeriod(idle,f)).resolves.toEqual({ status:"error",reason:"FAILED" }); expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

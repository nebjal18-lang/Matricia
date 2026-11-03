import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
const maybeSingle = vi.hoisted(() => vi.fn());
const deliverNotification = vi.hoisted(() => vi.fn());
const decideGovernance = vi.hoisted(() => vi.fn());
vi.mock("@/modules/shared/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({ rpc, from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) }),
}));
vi.mock("@/modules/shared/lib/notification-delivery/adapter", () => ({ deliverNotification }));
vi.mock("@/modules/franchise/screens/gouvernance/actions", () => ({ decideGovernance }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { decideFranchiseApplicationMandate, proposeFranchiseFromApplication, resendFranchiseInvitationCode } from "./actions";

const idle = { status: "idle" as const };
const applicationId = "00000000-0000-4000-8000-0000000000a1";
const invitationId = "00000000-0000-4000-8000-0000000000b1";
const idempotencyKey = "00000000-0000-4000-8000-0000000000c1";
function form(input: Record<string, string>) { const data = new FormData(); Object.entries(input).forEach(([key, value]) => data.set(key, value)); return data; }
const proposal = { locale: "fr", applicationId, rowVersion: "4", entryFee: "25000,50", entryFeeMode: "INSTALLMENT", entryFeeTermMonths: "3", mandateTermMonths: "36", specialConditions: "", reason: "Dossier complet", idempotencyKey };

beforeEach(() => {
  rpc.mockReset();
  deliverNotification.mockReset();
  decideGovernance.mockReset();
  maybeSingle.mockReset();
  maybeSingle.mockResolvedValue({ data: { reply_email: "candidat@example.invalid", locale: "fr", territory_code: "CASABLANCA_SETTAT" }, error: null });
  deliverNotification.mockResolvedValue({ outcome: "SENT" });
});

describe("franchise application mandate proposal", () => {
  it("proposes the mandate with exact minor units and mails the private code whose hash was stored", async () => {
    rpc.mockResolvedValue({ data: { invitation_id: invitationId, replayed: false }, error: null });
    await expect(proposeFranchiseFromApplication(idle, form(proposal))).resolves.toEqual({ status: "success", mailed: true });
    const [name, args] = rpc.mock.calls[0];
    expect(name).toBe("propose_franchise_from_application");
    expect(args).toMatchObject({ p_application_id: applicationId, p_entry_fee_minor: "2500050", p_entry_fee_mode: "INSTALLMENT", p_entry_fee_term_months: 3, p_mandate_term_months: 36, p_expected_row_version: 4, p_idempotency_key: idempotencyKey });
    expect(args).toMatchObject({ p_territory_name_fr: "Casablanca-Settat", p_territory_name_ar: "الدار البيضاء-سطات" });
    const mail = deliverNotification.mock.calls[0][0];
    expect(mail.recipientEmail).toBe("candidat@example.invalid");
    expect(mail.ctaPath).toBe(`/fr/franchise/invitations/${invitationId}`);
    const code = /Code privé d’activation : (\S+)/u.exec(mail.body)?.[1] ?? "";
    expect(createHash("sha256").update(code, "utf8").digest("hex")).toBe(args.p_invitation_token_hash);
  });

  it("forces a zero fee when the mode is exempt", async () => {
    rpc.mockResolvedValue({ data: { invitation_id: invitationId, replayed: false }, error: null });
    await proposeFranchiseFromApplication(idle, form({ ...proposal, entryFee: "999", entryFeeMode: "EXEMPT", entryFeeTermMonths: "0" }));
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_entry_fee_minor: "0", p_entry_fee_mode: "EXEMPT" });
  });

  it("does not mail a new code on an idempotent replay", async () => {
    rpc.mockResolvedValue({ data: { invitation_id: invitationId, replayed: true }, error: null });
    await expect(proposeFranchiseFromApplication(idle, form(proposal))).resolves.toEqual({ status: "success" });
    expect(deliverNotification).not.toHaveBeenCalled();
  });

  it("rejects an invalid amount before calling the database", async () => {
    await expect(proposeFranchiseFromApplication(idle, form({ ...proposal, entryFee: "12.3.4" }))).resolves.toEqual({ status: "error", reason: "VALIDATION" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps a stale dossier to a conflict", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "40001", message: "STALE_FRANCHISE_APPLICATION" } });
    await expect(proposeFranchiseFromApplication(idle, form(proposal))).resolves.toEqual({ status: "error", reason: "CONFLICT" });
    expect(deliverNotification).not.toHaveBeenCalled();
  });
});

describe("franchise invitation code rotation", () => {
  it("rotates the code and mails it", async () => {
    rpc.mockResolvedValue({ data: { invitation_id: invitationId, replayed: false }, error: null });
    await expect(resendFranchiseInvitationCode(idle, form({ locale: "fr", applicationId, reason: "Code perdu", idempotencyKey }))).resolves.toEqual({ status: "success", mailed: true });
    expect(rpc).toHaveBeenCalledWith("rotate_franchise_application_invitation_code", expect.objectContaining({ p_application_id: applicationId, p_idempotency_key: idempotencyKey }));
  });

  it("reports an undelivered e-mail", async () => {
    rpc.mockResolvedValue({ data: { invitation_id: invitationId, replayed: false }, error: null });
    deliverNotification.mockResolvedValue({ outcome: "FAILED" });
    await expect(resendFranchiseInvitationCode(idle, form({ locale: "fr", applicationId, reason: "Code perdu", idempotencyKey }))).resolves.toEqual({ status: "success", mailed: false });
  });
});

describe("franchise mandate approval", () => {
  const decision = { locale: "fr", applicationId, invitationId, approvalRequestId: "00000000-0000-4000-8000-0000000000d1", decision: "APPROVE", reason: "Conforme", rowVersion: "1", idempotencyKey };

  it("notifies the candidate after approval", async () => {
    decideGovernance.mockResolvedValue({ status: "success" });
    await expect(decideFranchiseApplicationMandate(idle, form(decision))).resolves.toEqual({ status: "success", mailed: true });
    expect(deliverNotification.mock.calls[0][0].body).toContain("est approuvé");
  });

  it("maps the four-eyes refusal to a denial without mailing", async () => {
    decideGovernance.mockResolvedValue({ status: "error", reason: "FORBIDDEN" });
    await expect(decideFranchiseApplicationMandate(idle, form(decision))).resolves.toEqual({ status: "error", reason: "DENIED" });
    expect(deliverNotification).not.toHaveBeenCalled();
  });

  it("does not mail after a rejection", async () => {
    decideGovernance.mockResolvedValue({ status: "success" });
    await expect(decideFranchiseApplicationMandate(idle, form({ ...decision, decision: "REJECT" }))).resolves.toEqual({ status: "success" });
    expect(deliverNotification).not.toHaveBeenCalled();
  });
});

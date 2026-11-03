vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), maybeSingle: vi.fn(), upload: vi.fn(), remove: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
    storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) },
  }),
}));
vi.mock("@/modules/admin/data/providers/model", async () => await import("@/modules/admin/data/providers/model"));
vi.mock("@/modules/provider/data/billing/model", async () => await import("@/modules/provider/data/billing/model"));
import { issueAdminCreditNote, reconcileAdminPayment, recordAdminPayment, resumeAdminBillingIntent, type AdminProviderActionState } from "./actions";

const idle: AdminProviderActionState = { status: "idle" };
const id = "11111111-1111-4111-8111-111111111111";
function base() { const form = new FormData(); form.set("idempotencyKey", id); return form; }
beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id } } });
  mocks.rpc.mockReset().mockImplementation(async (name: string) => name === "begin_provider_payment_proof_upload"
    ? { data: { outcome: "PROVIDER_PAYMENT_PROOF_UPLOAD_RESERVED", upload_id: id, storage_bucket: "provider-qualification", storage_object_path: `payments/${id}/${id}/${id}.pdf` }, error: null }
    : name === "save_my_provider_billing_intent" ? {data:{intent_id:id},error:null} : name === "finalize_my_provider_billing_intent" ? {data:{outcome:"PROVIDER_FINANCIAL_DECLARATION_SUBMITTED"},error:null} : { data: { outcome: "RECORDED" }, error: null });
  mocks.maybeSingle.mockReset().mockResolvedValue({ data: { currency: "MAD",provider_organization_id:id }, error: null });
  mocks.upload.mockReset().mockResolvedValue({ data: { path: "stored" }, error: null });
  mocks.remove.mockReset().mockResolvedValue({ data: [], error: null });
});

describe("admin provider finance actions", () => {
  it("convertit exactement les dirhams et calcule l’empreinte du justificatif", async () => {
    const form = base();
    Object.entries({ organizationId: id,invoiceId:id, paymentReference: "VIR-2026-09", paidOn: "2026-09-15", paymentMethod: "BANK_TRANSFER", currency: "MAD", amount: "1 250,50", cashAccountId: id, receivableAccountId: id }).forEach(([key, value]) => form.set(key, value));
    form.set("proofFile", new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])], "preuve.pdf", { type: "application/pdf" }));
    expect(await recordAdminPayment(idle, form)).toEqual({ status: "success", outcome: "PROVIDER_FINANCIAL_DECLARATION_SUBMITTED" });
    expect(mocks.rpc).toHaveBeenCalledWith("begin_provider_payment_proof_upload", expect.objectContaining({ p_declared_sha256: expect.stringMatching(/^[0-9a-f]{64}$/u), p_declared_size_bytes: 6 }));
    expect(mocks.upload).toHaveBeenCalledWith(expect.stringContaining("payments/"), expect.any(Buffer), expect.objectContaining({ contentType: "application/pdf", upsert: false }));
    expect(mocks.rpc).toHaveBeenCalledWith("save_my_provider_billing_intent", expect.objectContaining({p_kind:"PAYMENT",p_payload:expect.objectContaining({amountMinor:"125050",proofHash:expect.stringMatching(/^[0-9a-f]{64}$/u)})}));
    expect(mocks.rpc).toHaveBeenCalledWith("finalize_my_provider_billing_intent",{p_intent_id:id});
  });

  it("attend le scan et reprend sans nouveau téléversement", async () => {
    const form = base();
    Object.entries({ organizationId: id,invoiceId:id, paymentReference: "VIR-SCAN", paidOn: "2026-09-15", paymentMethod: "BANK_TRANSFER", currency: "MAD", amount: "10,00", cashAccountId: id, receivableAccountId: id }).forEach(([key, value]) => form.set(key, value));
    form.set("proofFile", new File([new Uint8Array([0x25,0x50,0x44,0x46,0x2d,0x31])], "preuve.pdf", { type: "application/pdf" }));
    const original = mocks.rpc.getMockImplementation()!;
    let clean = false;
    mocks.rpc.mockImplementation(async (name, args) => name === "finalize_my_provider_billing_intent" ? {data:{outcome:clean?"PROVIDER_FINANCIAL_DECLARATION_SUBMITTED":"PROVIDER_BILLING_SCAN_PENDING"},error:null} : original(name,args));
    const waiting = await recordAdminPayment(idle, form);
    expect(waiting.status).toBe("pending_scan");
    expect(mocks.rpc.mock.calls.some(([name]) => name === "record_provider_payment")).toBe(false);
    clean = true;
    expect(await recordAdminPayment(waiting, new FormData())).toEqual({status:"success", outcome:"PROVIDER_FINANCIAL_DECLARATION_SUBMITTED"});
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls.filter(([name]) => name === "save_my_provider_billing_intent")).toHaveLength(1);
    expect(mocks.rpc.mock.calls.filter(([name]) => name === "finalize_my_provider_billing_intent")).toHaveLength(2);
  });

  it("reprend une intention durable après perte de l’état de formulaire",async()=>{
    const form=new FormData();form.set("intentId",id);
    expect(await resumeAdminBillingIntent({status:"idle"},form)).toEqual({status:"success"});
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("finalize_my_provider_billing_intent",{p_intent_id:id});
  });

  it("refuse un faux PDF au lieu de fabriquer une preuve", async () => {
    const form = base();
    Object.entries({ organizationId: id,invoiceId:id, paymentReference: "VIR-2026-09", paidOn: "2026-09-15", paymentMethod: "BANK_TRANSFER", currency: "MAD", amount: "10,00", cashAccountId: id, receivableAccountId: id }).forEach(([key, value]) => form.set(key, value));
    form.set("proofFile", new File(["not-a-pdf"], "preuve.pdf", { type: "application/pdf" }));
    expect(await recordAdminPayment(idle, form)).toEqual({ status: "error", reason: "VALIDATION" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("conserve l’objet privé pour une reprise idempotente si la mutation financière échoue", async () => {
    const form = base();
    Object.entries({ organizationId: id,invoiceId:id, paymentReference: "VIR-FAIL", paidOn: "2026-09-15", paymentMethod: "BANK_TRANSFER", currency: "MAD", amount: "10,00", cashAccountId: id, receivableAccountId: id }).forEach(([key, value]) => form.set(key, value));
    form.set("proofFile", new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])], "preuve.pdf", { type: "application/pdf" }));
    mocks.rpc.mockImplementation(async (name: string) => name === "begin_provider_payment_proof_upload"
      ? { data: { outcome: "PROVIDER_PAYMENT_PROOF_UPLOAD_RESERVED", storage_bucket: "provider-qualification", storage_object_path: `payments/${id}/${id}/${id}.pdf` }, error: null }
      : { data: null, error: { code: "23514" } });
    expect(await recordAdminPayment(idle, form)).toEqual({ status: "error", reason: "CONFLICT" });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("dérive la devise du règlement avant le rapprochement", async () => {
    const form = base(); form.set("paymentId", id); form.set("invoiceId", id); form.set("amount", "99,95");
    expect(await reconcileAdminPayment(idle, form)).toEqual({ status: "success", outcome: "RECORDED" });
    expect(mocks.rpc).toHaveBeenCalledWith("reconcile_provider_payment", expect.objectContaining({ p_allocations: [{ invoice_id: id, amount_minor: "9995" }] }));
  });

  it("émet un avoir sans réécrire la facture", async () => {
    const form = base();
    form.set("invoiceId", id); form.set("creditNumber", "AV-2026-01"); form.set("issuedOn", "2026-09-21");
    form.set("subtotal", "1 000,00"); form.set("reason", "Avoir partiel documenté");
    expect(await issueAdminCreditNote(idle, form)).toEqual({ status: "success", outcome: "RECORDED" });
    expect(mocks.rpc).toHaveBeenCalledWith("issue_provider_credit_note", expect.objectContaining({ p_invoice_id: id, p_subtotal_minor: "100000", p_tax_minor: "0" }));
  });
});

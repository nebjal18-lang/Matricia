import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  listFactors: vi.fn(),
  getAuthenticatorAssuranceLevel: vi.fn(),
  challengeAndVerify: vi.fn(),
  enroll: vi.fn(),
  unenroll: vi.fn(),
  reauthenticate: vi.fn(),
  updateUser: vi.fn(),
  rpc: vi.fn(),
  adminRpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/modules/shared/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: {
      getUser: mocks.getUser,
      mfa: {
        listFactors: mocks.listFactors,
        getAuthenticatorAssuranceLevel: mocks.getAuthenticatorAssuranceLevel,
        challengeAndVerify: mocks.challengeAndVerify,
        enroll: mocks.enroll,
        unenroll: mocks.unenroll,
      },
      reauthenticate: mocks.reauthenticate,
      updateUser: mocks.updateUser,
    },
    rpc: mocks.rpc,
  }),
}));
vi.mock("@/modules/shared/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => ({ rpc: mocks.adminRpc }) }));
vi.mock("@/modules/shared/lib/i18n/locale", () => ({ isLocale: (value: string) => value === "fr" || value === "ar" }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("node:crypto", () => ({ randomUUID: () => "33333333-3333-4333-8333-333333333333" }));

import { getAccountSecurity, setOptionalPassword, unenrollTotp, verifyTotpEnrollment } from "./actions";

const userId = "11111111-1111-4111-8111-111111111111";
const factorId = "22222222-2222-4222-8222-222222222222";
const idle = { status: "idle" } as const;
const factor = { id: factorId, factor_type: "totp", friendly_name: "Matricia", status: "verified", created_at: "2026-09-11T10:00:00Z" };
const policy = { mfa_required: true, password_allowed: true, current_aal: "aal2", requirement_satisfied: true, matched_role_codes: ["MATRICIA_ADMIN"] };

function passwordForm() {
  const form = new FormData();
  form.set("password", "Robuste-2026!");
  form.set("confirmation", "Robuste-2026!");
  form.set("nonce", "123456");
  return form;
}

function factorForm() {
  const form = new FormData();
  form.set("factorId", factorId);
  form.set("code", "123456");
  form.set("confirmed", "yes");
  form.set("locale", "fr");
  return form;
}

describe("account security server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    mocks.listFactors.mockResolvedValue({ data: { all: [factor], totp: [factor] }, error: null });
    mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal2" }, error: null });
    mocks.rpc.mockResolvedValue({ data: [policy], error: null });
    mocks.adminRpc.mockResolvedValue({ data: null, error: null });
    mocks.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
    mocks.updateUser.mockResolvedValue({ data: {}, error: null });
    mocks.unenroll.mockResolvedValue({ data: {}, error: null });
  });

  it("retourne seulement les facteurs TOTP et la politique du rôle", async () => {
    const result = await getAccountSecurity();
    expect(result).toMatchObject({ status: "success", mfaRequired: true, passwordAllowed: true, requirementSatisfied: true });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("interdit le mot de passe lorsque la politique du rôle le refuse", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ ...policy, password_allowed: false }], error: null });
    await expect(setOptionalPassword(idle, passwordForm())).resolves.toEqual({ status: "error", reason: "PASSWORD_FORBIDDEN" });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("conserve le dernier facteur vérifié lorsqu’un rôle impose le MFA", async () => {
    await expect(unenrollTotp(idle, factorForm())).resolves.toEqual({ status: "error", reason: "MFA_REQUIRED" });
    expect(mocks.unenroll).not.toHaveBeenCalled();
  });

  it("enregistre une intention durable avant la vérification Auth", async () => {
    await expect(verifyTotpEnrollment(idle, factorForm())).resolves.toEqual({ status: "success" });
    expect(mocks.adminRpc).toHaveBeenNthCalledWith(1, "begin_account_security_change", expect.objectContaining({
      p_requested_action: "identity.mfa.verification.requested",
      p_success_action: "identity.mfa.enrolled",
    }));
    expect(mocks.challengeAndVerify).toHaveBeenCalledWith({ factorId, code: "123456" });
    expect(mocks.adminRpc).toHaveBeenNthCalledWith(2, "complete_account_security_change", {
      p_operation_id: "33333333-3333-4333-8333-333333333333",
    });
  });
  it.each(["fr","ar"])("returns a local dossier only after the %s MFA challenge is verified and audited",async locale=>{
    const form=factorForm();const next=`/${locale}/client/demandes/id?organizationId=org&tab=offres`;form.set("locale",locale);form.set("next",next);
    await expect(verifyTotpEnrollment(idle,form)).resolves.toEqual({status:"success",nextPath:next});
  });
  it("never returns to a dossier when assurance remains AAL1",async()=>{mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({data:{currentLevel:"aal1"},error:null});const form=factorForm();form.set("next","/fr/client/demandes/id");await expect(verifyTotpEnrollment(idle,form)).resolves.toEqual({status:"error",reason:"UNAVAILABLE"});});
  it("never forwards an external target after MFA",async()=>{const form=factorForm();form.set("next","https://evil.invalid/");await expect(verifyTotpEnrollment(idle,form)).resolves.toEqual({status:"success"});});
  it("does not return a dossier before the audit has completed",async()=>{mocks.adminRpc.mockResolvedValueOnce({data:null,error:null}).mockResolvedValue({error:{code:"503"}});const form=factorForm();form.set("next","/fr/client/demandes/id");await expect(verifyTotpEnrollment(idle,form)).resolves.toEqual({status:"error",reason:"AUDIT_PENDING"});});

});

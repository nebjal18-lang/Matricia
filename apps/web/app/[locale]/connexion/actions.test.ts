import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  signInWithOtp: vi.fn(),
  setCookie: vi.fn(),
  deleteCookie: vi.fn(),
  getCookie: vi.fn(),
  userRpc: vi.fn(),
  getUser: vi.fn(),
  assurance: vi.fn(),
  ensureConsent: vi.fn(),
  navigation: vi.fn(),
  verifyOtp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/modules/shared/lib/auth/workspace-navigation-server", () => ({ readWorkspaceNavigation: mocks.navigation }));
vi.mock("@/modules/shared/lib/auth/consent/current-documents",()=>({ensureCurrentConsentDocuments:mocks.ensureConsent}));
vi.mock("@/modules/shared/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({ rpc: mocks.rpc, auth: { signInWithOtp: mocks.signInWithOtp } }),
}));
vi.mock("@/modules/shared/lib/auth/otp", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/shared/lib/auth/otp")>();
  return {
    ...actual,
    normalizeEmail: (value: string) => {
      const normalized = value.trim().toLowerCase();
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
    },
  };
});
vi.mock("@/modules/shared/lib/i18n/locale", () => ({
  isLocale: (value: string) => value === "fr" || value === "ar",
}));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: () => ({ rpc: mocks.userRpc, auth: { getUser: mocks.getUser, verifyOtp: mocks.verifyOtp, signInWithPassword: mocks.signInWithPassword, signOut: mocks.signOut, mfa: { getAuthenticatorAssuranceLevel: mocks.assurance } } }) }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mocks.setCookie, delete: mocks.deleteCookie, get: mocks.getCookie }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }),
}));

import { requestOtp, confirmRegistrationConsent, postLoginDestination, completeEmailLogin, completePasswordLogin } from "./actions";
import { legalConsent } from "@/modules/shared/lib/auth/legal-consent";

describe("requestOtp", () => {
  beforeEach(() => {
    mocks.ensureConsent.mockReset().mockResolvedValue({});
    mocks.rpc.mockReset();
    mocks.signInWithOtp.mockReset();
    mocks.setCookie.mockReset();
    mocks.deleteCookie.mockReset();
    mocks.getCookie.mockReset();
    mocks.userRpc.mockReset();
    mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "actor" } } });
    mocks.assurance.mockReset().mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null });
  });

  it("rejette une adresse invalide sans interroger Supabase", async () => {
    await expect(requestOtp("incorrect", "fr")).resolves.toEqual({ accepted: false, reason: "INVALID_EMAIL" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("signale la limite sans envoyer de code", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ allowed: false, retry_after_seconds: 60 }], error: null });
    await expect(requestOtp("personne@example.ma", "fr")).resolves.toEqual({ accepted: false, reason: "RATE_LIMITED" });
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });

  it("signale la limite du service de courriel", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null });
    mocks.signInWithOtp.mockResolvedValue({ data: {}, error: { code: "over_email_send_rate_limit", status: 429 } });
    await expect(requestOtp("personne@example.ma", "fr")).resolves.toEqual({ accepted: false, reason: "RATE_LIMITED" });
  });

  it("ne révèle pas un courriel inconnu quand GoTrue renvoie otp_disabled", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null });
    mocks.signInWithOtp.mockResolvedValue({ data: {}, error: { code: "otp_disabled", status: 422, message: "Signups not allowed for otp" } });
    await expect(requestOtp("inconnu@example.ma", "fr")).resolves.toEqual({ accepted: true });
  });

  it("ne masque pas otp_disabled pendant l’inscription", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [{ allowed: true }], error: null }).mockResolvedValueOnce({ data: "a2010000-0000-4000-8000-000000000001", error: null });
    mocks.signInWithOtp.mockResolvedValue({ data: {}, error: { code: "otp_disabled", status: 422, message: "Signups not allowed for otp" } });
    await expect(requestOtp("nouveau@example.ma", "fr", undefined, "registration", legalConsent)).resolves.toEqual({ accepted: false, reason: "UNAVAILABLE" });
  });

  it("interdit la création implicite et envoie un OTP sans lien magique", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null });
    mocks.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    await expect(requestOtp(" Personne@Example.ma ", "ar")).resolves.toEqual({ accepted: true });
    expect(mocks.rpc).toHaveBeenCalledWith("reserve_otp_request", {
      p_identifier: "personne@example.ma",
      p_client_ip: "203.0.113.7",
    });
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: "personne@example.ma",
      options: {
        shouldCreateUser: false,
      },
    });
  });

  it("refuse une inscription sans consentement ou avec une version ancienne", async () => {
    await expect(requestOtp("nouveau@example.ma", "fr", undefined, "registration")).resolves.toEqual({ accepted: false, reason: "CONSENT_REQUIRED" });
    await expect(requestOtp("nouveau@example.ma", "fr", undefined, "registration", { ...legalConsent, termsVersion: "old" })).resolves.toEqual({ accepted: false, reason: "CONSENT_REQUIRED" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("bloque l’inscription si la preuve ne peut pas être réservée", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [{ allowed: true }], error: null }).mockResolvedValueOnce({ data: null, error: { code: "503" } });
    await expect(requestOtp("nouveau@example.ma", "fr", undefined, "registration", legalConsent)).resolves.toEqual({ accepted: false, reason: "UNAVAILABLE" });
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });

  it("n’envoie aucun OTP d’inscription si le texte a changé sous la même version",async()=>{
    mocks.rpc.mockResolvedValueOnce({data:[{allowed:true}],error:null});
    mocks.ensureConsent.mockRejectedValueOnce(new Error("LEGAL_TEXT_VERSION_COLLISION"));
    expect(await requestOtp("nouveau@example.ma","fr",undefined,"registration",legalConsent)).toEqual({accepted:false,reason:"UNAVAILABLE"});
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalledWith("reserve_registration_consent",expect.anything());
  });

  it("conserve le reçu quand sa confirmation échoue", async () => {
    mocks.getCookie.mockReturnValue({ value: "receipt" });
    mocks.userRpc.mockResolvedValue({ error: { code: "42501" } });
    await expect(confirmRegistrationConsent()).resolves.toBe(false);
    expect(mocks.deleteCookie).not.toHaveBeenCalled();
  });

  it("supprime le reçu uniquement après preuve persistée", async () => {
    mocks.getCookie.mockReturnValue({ value: "receipt" });
    mocks.userRpc.mockResolvedValue({ error: null });
    await expect(confirmRegistrationConsent()).resolves.toBe(true);
    expect(mocks.userRpc).toHaveBeenCalledWith("confirm_registration_consent", { p_receipt_id: "receipt" });
    expect(mocks.deleteCookie).toHaveBeenCalledWith("matricia.registration-consent");
  });

  it("autorise explicitement la création pour le parcours d’inscription", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null }).mockResolvedValueOnce({ data: "a2010000-0000-4000-8000-000000000001", error: null });
    mocks.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    await expect(requestOtp("nouveau@example.ma", "fr", "/fr/organisation?role=fournisseur", "registration", legalConsent)).resolves.toEqual({ accepted: true });
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: "nouveau@example.ma",
      options: {
        shouldCreateUser: true,
        data: { locale: "fr" },
      },
    });
    expect(mocks.setCookie).toHaveBeenCalledWith("matricia.registration-consent", "a2010000-0000-4000-8000-000000000001", expect.objectContaining({ httpOnly: true, maxAge: 1800 }));
  });

  it("ne pose le cookie de consentement qu’après envoi OTP réussi", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [{ allowed: true }], error: null }).mockResolvedValueOnce({ data: "a2010000-0000-4000-8000-000000000001", error: null });
    mocks.signInWithOtp.mockResolvedValue({ data: {}, error: { code: "unexpected_failure", status: 500 } });
    await expect(requestOtp("nouveau@example.ma", "fr", undefined, "registration", legalConsent)).resolves.toEqual({ accepted: false, reason: "UNAVAILABLE" });
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });
});

describe("post login assurance routing", () => {
  beforeEach(() => {
    mocks.getUser.mockResolvedValue({data:{user:{id:"actor"}}});
    mocks.navigation.mockImplementation(async (locale: string) => ({ status: "ok", requirementSatisfied: true, navigation: { signedIn: true, landing: "client", options: [{ kind: "client", href: `/${locale}/tableau-de-bord` }, { kind: "administration", href: `/${locale}/administration/command-center` }] } }));
  });
  it("keeps a verified AAL2 dossier and query", async () => { mocks.assurance.mockResolvedValue({data:{currentLevel:"aal2",nextLevel:"aal2"},error:null});mocks.userRpc.mockResolvedValue({data:[{mfa_required:true,current_aal:"aal2",requirement_satisfied:true}],error:null});const next="/ar/client/demandes/id?organizationId=org&tab=offres";await expect(postLoginDestination("ar",next)).resolves.toBe(next); });
  it("preserves a deep return during the MFA challenge", async () => { mocks.assurance.mockResolvedValue({data:{currentLevel:"aal1",nextLevel:"aal2"},error:null});mocks.userRpc.mockResolvedValue({data:[{mfa_required:true,current_aal:"aal1",requirement_satisfied:false}],error:null});const next="/fr/client/demandes/id?organizationId=org";const result=new URL(await postLoginDestination("fr",next),"https://test.invalid");expect(result.pathname).toBe("/fr/securite/compte");expect(result.searchParams.get("next")).toBe(next); });
  it("requires enrollment when the role policy requires MFA", async () => {
    mocks.navigation.mockResolvedValue({ status: "ok", requirementSatisfied: false, navigation: { signedIn: true, landing: "administration", options: [{ kind: "administration", href: "/fr/administration/command-center" }] } });
    mocks.assurance.mockResolvedValue({data:{currentLevel:"aal1",nextLevel:"aal1"},error:null});
    expect(await postLoginDestination("fr","/fr/administration")).toContain("/fr/securite/compte?");
    expect(mocks.userRpc).not.toHaveBeenCalled();
  });
  it("never resumes an Administration target for a client-only account", async () => {
    mocks.navigation.mockResolvedValue({ status: "ok", requirementSatisfied: true, navigation: { signedIn: true, landing: "client", options: [{ kind: "client", href: "/fr/tableau-de-bord" }] } });
    mocks.assurance.mockResolvedValue({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null });
    mocks.userRpc.mockResolvedValue({ data: [{ mfa_required: false, current_aal: "aal2", requirement_satisfied: true }], error: null });
    expect(await postLoginDestination("fr", "/fr/administration/entreprises/nouvelle")).toBe("/fr/tableau-de-bord?navigation=role-fallback");
  });
  it("retains the Admin creation target at AAL2", async () => {
    mocks.assurance.mockResolvedValue({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null });
    mocks.userRpc.mockResolvedValue({ data: [{ mfa_required: true, current_aal: "aal2", requirement_satisfied: true }], error: null });
    expect(await postLoginDestination("ar", "/ar/administration/entreprises/nouvelle?organizationId=org")).toBe("/ar/administration/entreprises/nouvelle?organizationId=org");
  });
  it("routes a navigation query failure to recovery instead of a fake MFA challenge", async () => {
    mocks.navigation.mockResolvedValue({ status: "error", reason: "QUERY_FAILED" });
    mocks.assurance.mockResolvedValue({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null });
    mocks.userRpc.mockResolvedValue({ data: [{ mfa_required: false, current_aal: "aal2", requirement_satisfied: true }], error: null });
    expect(await postLoginDestination("fr", "/fr/administration/entreprises/nouvelle")).toBe("/fr/indisponible?next=%2Ffr%2Fadministration%2Fentreprises%2Fnouvelle");
  });
  it("rejects an external target", async () => { mocks.assurance.mockResolvedValue({data:{currentLevel:"aal2",nextLevel:"aal2"},error:null});mocks.userRpc.mockResolvedValue({data:[{mfa_required:false,current_aal:"aal2",requirement_satisfied:true}],error:null});await expect(postLoginDestination("fr","https://evil.invalid")).resolves.toBe("/fr/tableau-de-bord"); });
});

describe("completeEmailLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "actor" } } });
    mocks.assurance.mockResolvedValue({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null });
    mocks.navigation.mockResolvedValue({ status: "ok", requirementSatisfied: true, navigation: { signedIn: true, landing: "client", options: [{ kind: "client", href: "/fr/tableau-de-bord" }] } });
    mocks.verifyOtp.mockResolvedValue({ error: null });
    mocks.signOut.mockResolvedValue({ error: null });
  });

  it("verifies OTP on the server then returns the post-login destination", async () => {
    await expect(completeEmailLogin("user@example.test", "123456", "fr", "/fr/client/demandes")).resolves.toEqual({
      ok: true,
      destination: "/fr/client/demandes",
    });
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ email: "user@example.test", token: "123456", type: "email" });
  });

  it("maps an expired OTP without calling navigation", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: { code: "otp_expired" } });
    await expect(completeEmailLogin("user@example.test", "123456", "fr")).resolves.toEqual({ ok: false, reason: "EXPIRED" });
    expect(mocks.navigation).not.toHaveBeenCalled();
  });

  it("signs out and reports consent failure for registration", async () => {
    mocks.getCookie.mockReturnValue(undefined);
    await expect(completeEmailLogin("user@example.test", "123456", "fr", undefined, "registration")).resolves.toEqual({ ok: false, reason: "CONSENT" });
    expect(mocks.signOut).toHaveBeenCalled();
  });
});

describe("completePasswordLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "actor" } } });
    mocks.assurance.mockResolvedValue({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null });
    mocks.navigation.mockResolvedValue({ status: "ok", requirementSatisfied: true, navigation: { signedIn: true, landing: "client", options: [{ kind: "client", href: "/fr/tableau-de-bord" }] } });
    mocks.signInWithPassword.mockResolvedValue({ error: null });
  });

  it("authenticates on the server then returns the destination", async () => {
    await expect(completePasswordLogin("user@example.test", "password-long-enough", "ar", "/ar/client/demandes")).resolves.toEqual({
      ok: true,
      destination: "/ar/client/demandes",
    });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: "user@example.test", password: "password-long-enough" });
  });
});


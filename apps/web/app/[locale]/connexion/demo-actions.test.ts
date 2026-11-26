import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ enabled: vi.fn(), listUsers: vi.fn(), signOut: vi.fn(), authorize: vi.fn(), generate: vi.fn(), verify: vi.fn(), destination: vi.fn(), listFactors: vi.fn(), enroll: vi.fn(), challenge: vi.fn(), level: vi.fn(), deleteFactor: vi.fn(), redirect: vi.fn((path: string): never => { throw new Error(`REDIRECT:${path}`); }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("./demo-policy", () => ({ isPublicDemoAccessEnabled: mocks.enabled, demoPersonaEmail: () => "demo@example.invalid" }));
vi.mock("./actions", () => ({ postLoginDestination: mocks.destination }));
vi.mock("./demo-authorization", () => ({ ensureDemoPersonaAuthorization: mocks.authorize }));
vi.mock("./demo-franchise-ensure", () => ({
  ensureDemoFranchisePersona: vi.fn(async () => ({
    organizationId: "22222222-2222-4222-8222-222222222222",
    franchiseId: "33333333-3333-4333-8333-333333333333",
  })),
}));
vi.mock("@/modules/shared/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => ({ auth: { admin: { listUsers: mocks.listUsers, generateLink: mocks.generate, mfa: { deleteFactor: mocks.deleteFactor } } } }) }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ auth: { signOut: mocks.signOut, verifyOtp: mocks.verify, mfa: { listFactors: mocks.listFactors, enroll: mocks.enroll, challengeAndVerify: mocks.challenge, getAuthenticatorAssuranceLevel: mocks.level } } }) }));
import { connectDemoPersona } from "./demo-actions";
import { demoPersonaHome } from "./demo-personas";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.enabled.mockReturnValue(true);
  mocks.authorize.mockResolvedValue(true);
  mocks.signOut.mockResolvedValue({ error: null });
  setPersona("admin");
  mocks.listFactors.mockResolvedValue({ data: { totp: [] }, error: null });
  mocks.enroll.mockResolvedValue({ data: { id: "factor-1", totp: { secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ" } }, error: null });
  mocks.challenge.mockResolvedValue({ error: null });
  mocks.level.mockResolvedValue({ data: { currentLevel: "aal2" }, error: null });
  mocks.destination.mockImplementation(async (_locale: string, next: string) => next);
});
function setPersona(persona: string) {
  const user = { id: "11111111-1111-4111-8111-111111111111", email: "demo@example.invalid", app_metadata: { matricia_demo: true, demo_persona: persona } };
  mocks.listUsers.mockResolvedValue({ data: { users: [user] }, error: null });
  mocks.generate.mockResolvedValue({ data: { user, properties: { hashed_token: "test-one-time-token" } }, error: null });
  mocks.verify.mockResolvedValue({ data: { user }, error: null });
}
function form(locale: string, persona: string, next = "") {
  const data = new FormData();
  data.set("locale", locale);
  data.set("persona", persona);
  if (next) data.set("next", next);
  return data;
}
describe("demo uses a real verified OTP and the same safe post-login route", () => {
  it("ouvre le command center admin", async () => {
    await expect(connectDemoPersona(form("fr", "admin", "/fr/tableau-de-bord"))).rejects.toThrow("REDIRECT:/fr/administration/command-center");
    expect(mocks.destination).toHaveBeenCalledWith("fr", "/fr/administration/command-center", "administration");
  });

  it("ouvre le tableau de bord client", async () => {
    setPersona("client");
    await expect(connectDemoPersona(form("fr", "client", "/fr/administration/command-center"))).rejects.toThrow("REDIRECT:/fr/tableau-de-bord?workspace=client");
    expect(mocks.destination).toHaveBeenCalledWith("fr", "/fr/tableau-de-bord?workspace=client", "client");
  });

  it("ouvre l’accueil franchise", async () => {
    setPersona("franchise");
    await expect(connectDemoPersona(form("ar", "franchise"))).rejects.toThrow(
      "REDIRECT:/ar/franchise/accueil?organizationId=22222222-2222-4222-8222-222222222222",
    );
    expect(mocks.destination).toHaveBeenCalledWith(
      "ar",
      "/ar/franchise/accueil?organizationId=22222222-2222-4222-8222-222222222222",
      "franchise",
    );
  });

  it("ouvre le tableau prestataire", async () => {
    setPersona("provider");
    await expect(connectDemoPersona(form("fr", "provider"))).rejects.toThrow("REDIRECT:/fr/tableau-de-bord?workspace=provider");
    expect(mocks.destination).toHaveBeenCalledWith("fr", "/fr/tableau-de-bord?workspace=provider", "provider");
  });

  it("rejects external return destinations and keeps a role-safe default", async () => {
    expect(demoPersonaHome("admin", "fr")).toBe("/fr/administration/command-center");
    await expect(connectDemoPersona(form("fr", "admin", "https://evil.invalid"))).rejects.toThrow("REDIRECT:/fr/administration/command-center");
  });

  it("never resolves a protected destination if OTP verification fails", async () => {
    mocks.verify.mockResolvedValue({ error: { message: "private failure" } });
    await expect(connectDemoPersona(form("ar", "admin", "/ar/administration/entreprises/nouvelle"))).rejects.toThrow("REDIRECT:/ar/connexion?demo=unavailable&next=");
    expect(mocks.destination).not.toHaveBeenCalled();
  });

  it("does not generate a privileged demo link when public demo is disabled", async () => {
    mocks.enabled.mockReturnValue(false);
    await expect(connectDemoPersona(form("fr", "admin"))).rejects.toThrow("demo=disabled");
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("keeps the administration closed when the demo session stays at AAL1", async () => {
    mocks.level.mockResolvedValue({ data: { currentLevel: "aal1" }, error: null });
    await expect(connectDemoPersona(form("fr", "admin"))).rejects.toThrow("demo=unavailable");
    expect(mocks.destination).not.toHaveBeenCalled();
  });
});

describe("SEC-02 fail closed ordering and cleanup", () => {
  it.each([{}, { matricia_demo: true, demo_persona: "client" }, { matricia_demo: false, demo_persona: "admin" }])("rejects invalid metadata before any auth effect: %j", async (app_metadata) => {
    mocks.listUsers.mockResolvedValue({ data: { users: [{ id: "real-user", email: "demo@example.invalid", app_metadata }] }, error: null });
    await expect(connectDemoPersona(form("fr", "admin"))).rejects.toThrow("demo=role-missing");
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.authorize).not.toHaveBeenCalled();
    expect(mocks.deleteFactor).not.toHaveBeenCalled();
    expect(mocks.enroll).not.toHaveBeenCalled();
  });
  it("rejects denied role provisioning before generating a link", async () => {
    mocks.authorize.mockResolvedValue(false);
    await expect(connectDemoPersona(form("fr", "admin"))).rejects.toThrow("demo=role-missing");
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it.each(["otp", "identity", "mfa", "destination", "exception"])("cleans the session after %s failure", async (failure) => {
    if (failure === "otp") mocks.verify.mockResolvedValue({ data: {}, error: { message: "denied" } });
    if (failure === "identity") mocks.verify.mockResolvedValue({ data: { user: { id: "different" } }, error: null });
    if (failure === "mfa") mocks.listFactors.mockResolvedValue({ error: { message: "denied" } });
    if (failure === "mfa") mocks.level.mockResolvedValue({ data: { currentLevel: "aal1" }, error: null });
    if (failure === "destination") mocks.destination.mockResolvedValue("/fr/tableau-de-bord?navigation=role-fallback");
    if (failure === "exception") mocks.destination.mockRejectedValue(new Error("transport"));
    await expect(connectDemoPersona(form("fr", "admin"))).rejects.toThrow("REDIRECT:/fr/connexion?demo=");
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    if (failure === "identity" || failure === "otp") expect(mocks.level).not.toHaveBeenCalled();
  });
  it("preserves the successful session", async () => {
    await expect(connectDemoPersona(form("ar", "admin"))).rejects.toThrow("REDIRECT:/ar/administration/command-center");
    expect(mocks.signOut).not.toHaveBeenCalled();
    const authorizedAt = mocks.authorize.mock.invocationCallOrder[0];
    const generatedAt = mocks.generate.mock.invocationCallOrder[0];
    if (authorizedAt === undefined || generatedAt === undefined) throw new Error("Missing authorization/link calls");
    expect(authorizedAt).toBeLessThan(generatedAt);
  });
});

describe.each(["client", "provider", "franchise"])("%s explicit destination refusals", (persona) => {
  it.each(["connexion?demo=role-missing", "connexion?next=%2Ffr%2Ftableau-de-bord", "indisponible", "securite/compte", "connexion?demo=disabled", "connexion?demo=unavailable"])("cleans the session for %s in both locales", async (refused) => {
    for (const locale of ["fr", "ar"]) {
      setPersona(persona);
      mocks.signOut.mockClear();
      mocks.destination.mockResolvedValue('/' + locale + '/' + refused);
      await expect(connectDemoPersona(form(locale, persona))).rejects.toThrow('REDIRECT:/' + locale + '/connexion?demo=role-missing');
      expect(mocks.signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
    }
  });
});

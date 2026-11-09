import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ enabled: vi.fn(), generate: vi.fn(), verify: vi.fn(), destination: vi.fn(), listFactors: vi.fn(), enroll: vi.fn(), challenge: vi.fn(), level: vi.fn(), deleteFactor: vi.fn(), redirect: vi.fn((path: string): never => { throw new Error(`REDIRECT:${path}`); }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("./demo-policy", () => ({ isPublicDemoAccessEnabled: mocks.enabled, demoPersonaEmail: () => "demo@example.invalid" }));
vi.mock("./actions", () => ({ postLoginDestination: mocks.destination }));
vi.mock("@/modules/shared/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => ({ auth: { admin: { generateLink: mocks.generate, mfa: { deleteFactor: mocks.deleteFactor } } } }) }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ auth: { verifyOtp: mocks.verify, mfa: { listFactors: mocks.listFactors, enroll: mocks.enroll, challengeAndVerify: mocks.challenge, getAuthenticatorAssuranceLevel: mocks.level } } }) }));
import { connectDemoPersona } from "./demo-actions";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.enabled.mockReturnValue(true);
  mocks.generate.mockResolvedValue({ data: { properties: { hashed_token: "test-one-time-token" } }, error: null });
  mocks.verify.mockResolvedValue({ data: { user: { id: "11111111-1111-4111-8111-111111111111" } }, error: null });
  mocks.listFactors.mockResolvedValue({ data: { totp: [] }, error: null });
  mocks.enroll.mockResolvedValue({ data: { id: "factor-1", totp: { secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ" } }, error: null });
  mocks.challenge.mockResolvedValue({ error: null });
  mocks.level.mockResolvedValue({ data: { currentLevel: "aal2" }, error: null });
  mocks.destination.mockImplementation(async (_locale: string, next: string) => next);
});
function form(locale: string, next: string) { const data = new FormData(); data.set("locale", locale); data.set("persona", "admin"); data.set("next", next); return data; }
describe("demo uses a real verified OTP and the same safe post-login route", () => {
  it.each(["fr", "ar"])("preserves the Admin creation intent after verification in %s", async locale => {
    const next = `/${locale}/administration/entreprises/nouvelle?organizationId=org`;
    await expect(connectDemoPersona(form(locale, next))).rejects.toThrow(`REDIRECT:${next}`);
    expect(mocks.verify).toHaveBeenCalledWith({ token_hash: "test-one-time-token", type: "magiclink" });
    expect(mocks.destination).toHaveBeenCalledWith(locale, next);
  });
  it("rejects external return destinations and keeps a role-safe default", async () => {
    await expect(connectDemoPersona(form("fr", "https://evil.invalid"))).rejects.toThrow("REDIRECT:/fr/administration/command-center");
    expect(mocks.destination).toHaveBeenCalledWith("fr", "/fr/administration/command-center");
  });
  it("never resolves a protected destination if OTP verification fails", async () => {
    mocks.verify.mockResolvedValue({ error: { message: "private failure" } });
    await expect(connectDemoPersona(form("ar", "/ar/administration/entreprises/nouvelle"))).rejects.toThrow("REDIRECT:/ar/connexion?demo=unavailable&next=");
    expect(mocks.destination).not.toHaveBeenCalled();
  });
  it("does not generate a privileged demo link when public demo is disabled", async () => {
    mocks.enabled.mockReturnValue(false);
    await expect(connectDemoPersona(form("fr", "/fr/administration/entreprises/nouvelle"))).rejects.toThrow("demo=disabled");
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("keeps the administration closed when the demo session stays at AAL1", async () => {
    mocks.level.mockResolvedValue({ data: { currentLevel: "aal1" }, error: null });
    await expect(connectDemoPersona(form("fr", "/fr/administration/command-center"))).rejects.toThrow("demo=unavailable");
    expect(mocks.destination).not.toHaveBeenCalled();
  });
});

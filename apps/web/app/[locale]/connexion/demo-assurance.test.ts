import { beforeEach, describe, expect, it, vi } from "vitest";
import { elevateDemoSession } from "./demo-assurance";

const mocks = vi.hoisted(() => ({
  listFactors: vi.fn(),
  enroll: vi.fn(),
  challenge: vi.fn(),
  level: vi.fn(),
  deleteFactor: vi.fn(),
  generateLink: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/modules/shared/lib/auth/totp", () => ({ totp: () => "123456" }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.level.mockResolvedValue({ data: { currentLevel: "aal1" }, error: null });
  mocks.listFactors.mockResolvedValue({ data: { totp: [] }, error: null });
  mocks.enroll.mockResolvedValue({ data: { id: "factor-1", totp: { secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ" } }, error: null });
  mocks.challenge.mockResolvedValue({ error: null });
  mocks.deleteFactor.mockResolvedValue({ error: null });
  mocks.generateLink.mockResolvedValue({ data: { properties: { hashed_token: "hash" } }, error: null });
  mocks.verifyOtp.mockResolvedValue({ error: null });
});

function clients() {
  return {
    supabase: {
      auth: {
        verifyOtp: mocks.verifyOtp,
        mfa: {
          listFactors: mocks.listFactors,
          enroll: mocks.enroll,
          challengeAndVerify: mocks.challenge,
          getAuthenticatorAssuranceLevel: mocks.level,
        },
      },
    },
    admin: {
      auth: {
        admin: {
          generateLink: mocks.generateLink,
          mfa: { deleteFactor: mocks.deleteFactor },
        },
      },
    },
  };
}

describe("elevateDemoSession", () => {
  it("skips destructive re-enrollment when the session is already AAL2", async () => {
    mocks.level.mockResolvedValue({ data: { currentLevel: "aal2" }, error: null });
    await expect(elevateDemoSession({ email: "demo@example.invalid", userId: "user-1", ...clients() })).resolves.toBe(true);
    expect(mocks.listFactors).not.toHaveBeenCalled();
    expect(mocks.deleteFactor).not.toHaveBeenCalled();
    expect(mocks.enroll).not.toHaveBeenCalled();
  });

  it("enrolls and verifies when AAL2 is missing", async () => {
    mocks.level
      .mockResolvedValueOnce({ data: { currentLevel: "aal1" }, error: null })
      .mockResolvedValueOnce({ data: { currentLevel: "aal2" }, error: null });
    await expect(elevateDemoSession({ email: "demo@example.invalid", userId: "user-1", ...clients() })).resolves.toBe(true);
    expect(mocks.enroll).toHaveBeenCalled();
    expect(mocks.challenge).toHaveBeenCalled();
  });
});

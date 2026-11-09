import { totp } from "@/modules/shared/lib/auth/totp";

type AuthError = { message: string } | null;
type Factor = { id: string; status: string };

type DemoSessionClient = {
  auth: {
    verifyOtp: (credentials: { token_hash: string; type: "magiclink" }) => Promise<{ error: AuthError }>;
    mfa: {
      listFactors: () => Promise<{ data: { totp: Factor[] } | null; error: AuthError }>;
      enroll: (input: { factorType: "totp"; friendlyName: string }) => Promise<{ data: { id: string; totp: { secret: string } } | null; error: AuthError }>;
      challengeAndVerify: (input: { factorId: string; code: string }) => Promise<{ error: AuthError }>;
      getAuthenticatorAssuranceLevel: () => Promise<{ data: { currentLevel: string | null } | null; error: AuthError }>;
    };
  };
};

type DemoAdminClient = {
  auth: {
    admin: {
      generateLink: (input: { type: "magiclink"; email: string }) => Promise<{ data: { properties?: { hashed_token?: string } | null } | null; error: AuthError }>;
      mfa: {
        deleteFactor: (input: { id: string; userId: string }) => Promise<{ error: AuthError }>;
      };
    };
  };
};

/** Enrolls a fresh authenticator and verifies it in the same request, so the demo session is really AAL2. */
export async function elevateDemoSession(input: {
  email: string;
  userId: string;
  supabase: DemoSessionClient;
  admin: DemoAdminClient;
}): Promise<boolean> {
  const listed = await input.supabase.auth.mfa.listFactors();
  if (listed.error) return false;
  const factors = listed.data?.totp ?? [];
  const verified = factors.some((factor) => factor.status === "verified");
  for (const factor of factors) {
    const removed = await input.admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: input.userId });
    if (removed.error) return false;
  }
  if (verified) {
    const link = await input.admin.auth.admin.generateLink({ type: "magiclink", email: input.email });
    const tokenHash = link.data?.properties?.hashed_token;
    if (link.error || !tokenHash) return false;
    const session = await input.supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    if (session.error) return false;
  }
  const enrolled = await input.supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Matricia demo" });
  const factorId = enrolled.data?.id;
  const secret = enrolled.data?.totp.secret;
  if (enrolled.error || !factorId || !secret) return false;
  for (const offset of [0, -30_000, 30_000]) {
    const verification = await input.supabase.auth.mfa.challengeAndVerify({ factorId, code: totp(secret, Date.now() + offset) });
    if (verification.error) continue;
    const level = await input.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return !level.error && level.data?.currentLevel === "aal2";
  }
  return false;
}

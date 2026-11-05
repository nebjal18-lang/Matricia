type PublicSupabaseInput = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_ANON_KEY?: string;
};

function firstConfigured(...values: Array<string | undefined>): string | undefined {
  return values.map(value => value?.trim()).find(value => Boolean(value));
}

export function resolvePublicSupabaseEnvironment(input: PublicSupabaseInput) {
  const url = firstConfigured(input.NEXT_PUBLIC_SUPABASE_URL, input.SUPABASE_URL);
  const key = firstConfigured(
    input.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    input.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
    input.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    input.SUPABASE_ANON_KEY,
  );
  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)",
    !key && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY)",
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`PUBLIC_SUPABASE_CONFIGURATION_MISSING: ${missing.join("; ")}. Configure these public variables for the Vercel deployment environment and redeploy.`);
  }
  try {
    const parsed = new URL(url!);
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) {
      throw new Error("invalid public endpoint");
    }
  } catch {
    throw new Error("PUBLIC_SUPABASE_URL_INVALID");
  }
  if (key!.startsWith("sb_secret_")) throw new Error("PUBLIC_SUPABASE_PRIVILEGED_KEY_FORBIDDEN");
  const segments = key!.split(".");
  if (segments.length === 3) {
    try {
      const payload: unknown = JSON.parse(atob(segments[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (!payload || typeof payload !== "object" || !("role" in payload) || payload.role !== "anon") {
        throw new Error("not an anonymous key");
      }
    } catch {
      throw new Error("PUBLIC_SUPABASE_PRIVILEGED_OR_INVALID_JWT_FORBIDDEN");
    }
  }
  return {
    NEXT_PUBLIC_SUPABASE_URL: url!,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key!,
  };
}

import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

const security = z.object({
  requirement_satisfied: z.boolean(),
  matched_role_codes: z.array(z.string()),
}).passthrough();

export type PlatformAccess =
  | {
      status: "ok";
      client: Awaited<ReturnType<typeof getSupabaseServerClient>>;
      userId: string;
      email: string | null;
      roles: Set<string>;
      requirementSatisfied: boolean;
    }
  | { status: "error"; reason: "UNAUTHENTICATED" | "QUERY_FAILED" | "INVALID_RESPONSE" };

export async function loadMyPlatformAccess(): Promise<PlatformAccess> {
  try {
    const client = await getSupabaseServerClient();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError) {
      const sessionMissing = classifyAuthReadFailure(authError) === "UNAUTHENTICATED";
      return { status: "error", reason: sessionMissing ? "UNAUTHENTICATED" : "QUERY_FAILED" };
    }
    if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
    const securityResult = await client.rpc("get_my_account_security_requirement");
    if (securityResult.error) return { status: "error", reason: "QUERY_FAILED" };
    const requirements = z.array(security).safeParse(securityResult.data);
    if (!requirements.success || requirements.data.length !== 1) return { status: "error", reason: "INVALID_RESPONSE" };
    const row = requirements.data[0]!;
    return {
      status: "ok",
      client,
      userId: auth.user.id,
      email: auth.user.email ?? null,
      roles: new Set(row.matched_role_codes),
      requirementSatisfied: row.requirement_satisfied,
    };
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", reason: "QUERY_FAILED" };
  }
}

export function hasPlatformRole(roles: Set<string>, allowed: readonly string[]) {
  return allowed.some((role) => roles.has(role));
}

export function mfaRequiredMessage(locale: "fr" | "ar") {
  return locale === "ar"
    ? "فعّلوا التحقق القوي (العامل الثاني) لفتح هذا الجدول."
    : "Activez l’authentification renforcée (second facteur) pour ouvrir cet écran.";
}

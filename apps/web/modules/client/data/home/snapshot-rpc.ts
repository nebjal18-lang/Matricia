import { z } from "zod";
import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { getServerAuthUser, getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

const featured = z.object({
  id: z.string().uuid(),
  description: z.string(),
  status: z.string(),
  created_at: z.string(),
  quote_count: z.number().int().nonnegative(),
  rfq_id: z.string().uuid().nullable(),
}).nullable();

const payload = z.object({
  organization_name: z.string().nullable(),
  open_requests: z.number().int().nonnegative(),
  quotes_to_review: z.number().int().nonnegative(),
  active_missions: z.number().int().nonnegative(),
  pending_decisions: z.number().int().nonnegative(),
  upcoming_due: z.number().int().nonnegative(),
  featured,
  next_milestone: z.object({
    title: z.string(),
    due_at: z.string().nullable(),
  }).nullable(),
});

export type ClientHomeRpcSnapshot =
  | { status: "success"; value: z.infer<typeof payload> }
  | { status: "error"; reason: "UNAUTHENTICATED" | "FORBIDDEN" | "UNAVAILABLE" | "INVALID_RESPONSE" | "MISSING_RPC" };

/** One Auth-cached round-trip to the home aggregate RPC. */
export async function loadClientHomeSnapshotRpc(
  organizationId: string,
  locale: "fr" | "ar",
): Promise<ClientHomeRpcSnapshot> {
  const [client, authResult] = await Promise.all([getSupabaseServerClient(), getServerAuthUser()]);
  const authFailure = classifyAuthReadFailure(authResult.error);
  if (authFailure === "UNAUTHENTICATED") return { status: "error", reason: "UNAUTHENTICATED" };
  if (authFailure === "UNAVAILABLE") return { status: "error", reason: "UNAVAILABLE" };
  if (!authResult.data.user) return { status: "error", reason: "UNAUTHENTICATED" };

  const result = await client.rpc("get_client_home_snapshot_v1", {
    p_organization_id: organizationId,
    p_locale: locale,
  });
  if (result.error) {
    if (result.error.code === "PGRST202" || result.error.code === "42883") return { status: "error", reason: "MISSING_RPC" };
    if (result.error.code === "42501") return { status: "error", reason: "FORBIDDEN" };
    return { status: "error", reason: "UNAVAILABLE" };
  }
  const parsed = payload.safeParse(result.data);
  if (!parsed.success) return { status: "error", reason: "INVALID_RESPONSE" };
  return { status: "success", value: parsed.data };
}

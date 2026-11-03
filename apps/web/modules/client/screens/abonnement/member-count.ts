import type { RolesQueryResult } from "@/app/[locale]/organisation/roles/actions";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

export async function subscriptionMemberCount(result: RolesQueryResult, organizationId: string): Promise<number | null> {
  if (result.status !== "success") return null;
  const organization = result.organizations.find((item) => item.id === organizationId);
  // Other Client roles can read themselves, not the complete team.
  if (!organization?.currentRoles.some((role) => role === "CLIENT_OWNER" || role === "CLIENT_ADMIN")) return null;
  try {
    const client = await getSupabaseServerClient();
    const response = await client.from("organization_memberships")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId).eq("status", "ACTIVE");
    return response.error || !Number.isSafeInteger(response.count) || response.count === null || response.count < 0 ? null : response.count;
  } catch { return null; }
}

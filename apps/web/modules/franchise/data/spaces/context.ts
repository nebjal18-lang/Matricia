import { z } from "zod";
import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { collectCatalogPages } from "@/modules/franchise/data/library/paged-query";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

export const franchiseOrganizationRoles = ["FRANCHISE_OWNER", "FRANCHISE_MANAGER", "FRANCHISE_EXPERT", "FRANCHISE_PROVIDER_MANAGER", "FRANCHISE_ACCOUNTING", "FRANCHISE_VIEWER"] as const;
const membershipSchema = z.object({
  organization_id: z.string().uuid(),
  organizations: z.object({ display_name: z.string(), status: z.string() }),
  organization_member_roles: z.array(z.object({ role_code: z.string(), revoked_at: z.string().nullable() })),
});

export async function resolveFranchiseSpace(input: { locale: Locale; organizationId?: string; franchiseId?: string }) {
  const client = await getSupabaseServerClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  const authFailure = classifyAuthReadFailure(authError);
  if (authFailure === "UNAUTHENTICATED" || (!authFailure && !auth.user)) return { status: "unauthenticated" as const };
  if (authFailure === "UNAVAILABLE") return {
    status: "success" as const, locale: input.locale, userEmail: null,
    selectedOrganizationId: null, selectedQuery: "", organizationName: null,
    organizations: [] as Array<{ id: string; name: string }>, errorReason: "QUERY_FAILED" as const,
  };
  if (!auth.user) return { status: "unauthenticated" as const };
  const response = await collectCatalogPages((from, to) => client.from("organization_memberships")
    .select("organization_id,organizations!inner(display_name,status),organization_member_roles(role_code,revoked_at)")
    .eq("user_id", auth.user.id).eq("status", "ACTIVE").order("organization_id").range(from, to));
  const parsed = z.array(membershipSchema).safeParse(response.data);
  const errorReason = response.error ? "QUERY_FAILED" as const : !parsed.success ? "INVALID_RESPONSE" as const : null;
  const memberships = !errorReason && parsed.success ? parsed.data.filter((member) =>
    ["ACTIVE", "PENDING"].includes(member.organizations.status) && member.organization_member_roles.some((role) =>
      role.revoked_at === null && franchiseOrganizationRoles.some((allowed) => allowed === role.role_code))) : [];
  const organizations = [...new Map(memberships.map((member) => [member.organization_id, { id: member.organization_id, name: member.organizations.display_name }])).values()];
  const denied = Boolean(input.organizationId && !organizations.some((organization) => organization.id === input.organizationId));
  // A sole verified organization is unambiguous. Several require an explicit
  // choice; a foreign/revoked query never silently falls back to another tenant.
  const selected = denied || errorReason ? null : input.organizationId
    ? organizations.find((organization) => organization.id === input.organizationId) ?? null
    : organizations.length === 1 ? organizations[0]! : null;
  const selectedOrganizationId = selected?.id ?? null;
  const params = new URLSearchParams();
  if (selectedOrganizationId) params.set("organizationId", selectedOrganizationId);
  if (selectedOrganizationId && input.franchiseId) params.set("franchiseId", input.franchiseId);
  return {
    status: "success" as const,
    locale: input.locale,
    userEmail: auth.user.email ?? null,
    selectedOrganizationId,
    selectedQuery: params.size ? `?${params}` : "",
    organizationName: selected?.name ?? null,
    organizations,
    errorReason: errorReason ?? (denied ? "FORBIDDEN" as const : null),
  };
}

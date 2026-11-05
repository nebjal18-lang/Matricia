import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { notFound, redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

export async function resolveClientSpace(input: { locale: Locale; organizationId?: string }) {
  const client = await getSupabaseServerClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  const failure = classifyAuthReadFailure(authError);
  if (failure === "UNAVAILABLE") throw new Error("CLIENT_CONTEXT_UNAVAILABLE");
  if (failure === "UNAUTHENTICATED") return { status: "unauthenticated" as const };
  if (!auth.user) return { status: "unauthenticated" as const };
  const memberships = await client.from("organization_memberships").select("id,organization_id,organizations!inner(display_name)").eq("user_id", auth.user.id).eq("status", "ACTIVE");
  if (memberships.error) throw new Error("CLIENT_CONTEXT_UNAVAILABLE");
  const ids = (memberships.data ?? []).map((row) => row.id);
  const roles = ids.length ? await client.from("organization_member_roles").select("membership_id").in("membership_id", ids).is("revoked_at", null).like("role_code", "CLIENT_%") : { data: [], error: null };
  if (roles.error) throw new Error("CLIENT_CONTEXT_UNAVAILABLE");
  const authorized = new Set((roles.data ?? []).map((row) => row.membership_id));
  const organizations = [...new Map((memberships.data ?? [])
    .filter((row) => authorized.has(row.id))
    .map((row) => {
      const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
      const name = organization && typeof organization === "object" && "display_name" in organization && typeof organization.display_name === "string"
        ? organization.display_name
        : null;
      return name ? [row.organization_id, { id: row.organization_id, name }] as const : null;
    })
    .filter((entry): entry is readonly [string, { id: string; name: string }] => entry !== null)).values()];
  const organizationIds = organizations.map((organization) => organization.id);
  if (input.organizationId && !organizationIds.includes(input.organizationId)) notFound();
  if (!organizationIds.length) redirect(`/${input.locale}/organisation`);
  const selectedOrganizationId = input.organizationId ?? organizationIds[0]!;
  const selectedQuery = selectedOrganizationId ? `?organizationId=${encodeURIComponent(selectedOrganizationId)}` : "";
  const organizationName = organizations.find((organization) => organization.id === selectedOrganizationId)?.name ?? null;
  if (!organizationName) throw new Error("CLIENT_CONTEXT_UNAVAILABLE");

  return {
    status: "success" as const,
    locale: input.locale,
    userEmail: auth.user.email ?? null,
    selectedOrganizationId,
    selectedQuery,
    organizationName,
    organizations,
  };
}

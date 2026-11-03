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
  const memberships = await client.from("organization_memberships").select("id,organization_id").eq("user_id", auth.user.id).eq("status", "ACTIVE");
  if (memberships.error) throw new Error("CLIENT_CONTEXT_UNAVAILABLE");
  const ids = (memberships.data ?? []).map((row) => row.id);
  const roles = ids.length ? await client.from("organization_member_roles").select("membership_id").in("membership_id", ids).is("revoked_at", null).like("role_code", "CLIENT_%") : { data: [], error: null };
  if (roles.error) throw new Error("CLIENT_CONTEXT_UNAVAILABLE");
  const authorized = new Set((roles.data ?? []).map((row) => row.membership_id));
  const organizationIds = [...new Set((memberships.data ?? []).filter((row) => authorized.has(row.id)).map((row) => row.organization_id))];
  if (input.organizationId && !organizationIds.includes(input.organizationId)) notFound();
  if (!organizationIds.length) redirect(`/${input.locale}/organisation`);
  const selectedOrganizationId = input.organizationId ?? organizationIds[0]!;
  const selectedQuery = selectedOrganizationId ? `?organizationId=${encodeURIComponent(selectedOrganizationId)}` : "";
  const organization = await client.from("organizations").select("display_name").eq("id", selectedOrganizationId).limit(1);
  if (organization.error || organization.data?.length !== 1 || typeof organization.data[0]?.display_name !== "string") throw new Error("CLIENT_CONTEXT_UNAVAILABLE");
  const organizationName = organization.data[0].display_name;

  return {
    status: "success" as const,
    locale: input.locale,
    userEmail: auth.user.email ?? null,
    selectedOrganizationId,
    selectedQuery,
    organizationName,
  };
}

import { notFound } from "next/navigation";
import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

/** Account security is available before an organization or a workspace role exists. */
export async function resolveConnectedSpace(input: { locale: Locale; organizationId?: string; allowDirectoryFailure?: boolean }) {
  const client = await getSupabaseServerClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) {
    if (classifyAuthReadFailure(authError) === "UNAUTHENTICATED") return { status: "unauthenticated" as const };
    throw new Error("WORKSPACE_CONTEXT_UNAVAILABLE");
  }
  if (!auth.user) return { status: "unauthenticated" as const };
  const result = await client.from("organization_memberships").select("organization_id").eq("user_id", auth.user.id).eq("status", "ACTIVE").order("organization_id");
  if (result.error && !input.allowDirectoryFailure) throw new Error("WORKSPACE_CONTEXT_UNAVAILABLE");
  if (result.error) return { status: "success" as const, selectedOrganizationId: null, selectedQuery: "", organizationName: null, userEmail: auth.user.email ?? null, directoryUnavailable: true };
  const organizationIds = [...new Set((result.data ?? []).map(row => row.organization_id))];
  if (input.organizationId && !organizationIds.includes(input.organizationId)) notFound();
  const selectedOrganizationId = input.organizationId ?? organizationIds[0] ?? null;
  const organization = selectedOrganizationId ? await client.from("organizations").select("display_name").eq("id",selectedOrganizationId).maybeSingle() : null;
  if (organization?.error && !input.allowDirectoryFailure) throw new Error("WORKSPACE_CONTEXT_UNAVAILABLE");
  if (organization?.error) return { status: "success" as const, selectedOrganizationId, selectedQuery: selectedOrganizationId ? `?organizationId=${encodeURIComponent(selectedOrganizationId)}` : "", organizationName: null, userEmail: auth.user.email ?? null, directoryUnavailable: true };
  return { status: "success" as const, selectedOrganizationId, selectedQuery: selectedOrganizationId ? `?organizationId=${encodeURIComponent(selectedOrganizationId)}` : "", organizationName: organization?.data?.display_name ?? null, userEmail: auth.user.email ?? null, directoryUnavailable: false };
}

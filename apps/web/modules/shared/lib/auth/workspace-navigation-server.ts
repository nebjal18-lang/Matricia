import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { workspaceLandingPath, type WorkspaceLanding } from "@/modules/shared/lib/connected-space/workspace-landing";
import { availableWorkspaces, type WorkspaceNavigation } from "./workspace-navigation";

const requirement = z.array(z.object({ requirement_satisfied: z.boolean(), matched_role_codes: z.array(z.string()) })).length(1);
export type WorkspaceNavigationResult =
  | { status: "ok"; navigation: WorkspaceNavigation; userEmail: string | null; requirementSatisfied: boolean }
  | { status: "error"; signedIn?: true; reason: "UNAUTHENTICATED" | "FORBIDDEN" | "QUERY_FAILED" | "INVALID_RESPONSE" };

/** Only verified user-scoped reads decide the available navigation. Every destination keeps its own guards. */
export async function readWorkspaceNavigation(locale: Locale, organizationId?: string | null, preferred?: string): Promise<WorkspaceNavigationResult> {
  try {
    const client = await getSupabaseServerClient();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError) return { status: "error", reason: authError.status === 401 || authError.status === 403 || authError.name === "AuthSessionMissingError" ? "UNAUTHENTICATED" : "QUERY_FAILED" };
    if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
    const [security, memberships] = await Promise.all([
      client.rpc("get_my_account_security_requirement"),
      client.from("organization_memberships").select("id,organization_id").eq("user_id", auth.user.id).eq("status", "ACTIVE").order("organization_id").limit(100),
    ]);
    if (security.error || memberships.error) return { status: "error", signedIn: true, reason: "QUERY_FAILED" };
    const parsed = requirement.safeParse(security.data);
    if (!parsed.success) return { status: "error", signedIn: true, reason: "INVALID_RESPONSE" };
    const members = memberships.data ?? [];
    const ids = members.map(row => row.id);
    const roles = ids.length ? await client.from("organization_member_roles").select("membership_id,role_code").in("membership_id", ids).is("revoked_at", null).limit(2000) : { data: [], error: null };
    if (roles.error) return { status: "error", signedIn: true, reason: "QUERY_FAILED" };
    const memberRoles = roles.data ?? [];
    const platform = parsed.data[0]!;
    const allowed = availableWorkspaces(memberRoles.map(row => row.role_code), platform.matched_role_codes);
    const selectedMember = organizationId ? members.find(row => row.organization_id === organizationId) : undefined;
    if (organizationId && !selectedMember && !allowed.includes("administration")) return { status: "error", signedIn: true, reason: "FORBIDDEN" };
    const preferredKind = allowed.find(kind => kind === preferred);
    const organizationKinds = selectedMember ? availableWorkspaces(memberRoles.filter(row => row.membership_id === selectedMember.id).map(row => row.role_code), []) : [];
    if (organizationId && preferredKind && preferredKind !== "administration" && !organizationKinds.includes(preferredKind)) return { status: "error", signedIn: true, reason: "FORBIDDEN" };
    const options = allowed.map(kind => {
      const member = members.find(row => (!organizationId || row.organization_id === organizationId) && availableWorkspaces(memberRoles.filter(role => role.membership_id === row.id).map(role => role.role_code), []).includes(kind))
        ?? members.find(row => availableWorkspaces(memberRoles.filter(role => role.membership_id === row.id).map(role => role.role_code), []).includes(kind));
      const query = new URLSearchParams({ workspace: kind });
      const selectedId = kind === "administration" ? organizationId : member?.organization_id;
      if (selectedId) query.set("organizationId", selectedId);
      return { kind, href: workspaceLandingPath(locale, kind, `?${query}`) };
    });
    const landing: WorkspaceLanding = preferredKind ?? organizationKinds[0] ?? allowed[0] ?? "client";
    return { status: "ok", userEmail: auth.user.email ?? null, requirementSatisfied: platform.requirement_satisfied, navigation: { signedIn: true, landing, options } };
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", reason: "QUERY_FAILED" };
  }
}

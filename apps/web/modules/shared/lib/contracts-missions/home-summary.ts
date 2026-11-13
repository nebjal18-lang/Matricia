import { z } from "zod";
import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { getServerAuthUser, getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { resolveClientOrganizationContext } from "@/modules/shared/client-organization-context";

const id = z.string().uuid();
const member = z.object({
  organization_id: id,
  organizations: z.object({ display_name: z.string().min(1) }),
  organization_member_roles: z.array(z.object({ role_code: z.string(), revoked_at: z.string().nullable() })),
});
const missionRow = z.object({
  id,
  status: z.string(),
  mission_milestones: z.array(z.object({
    title_fr: z.string(),
    title_ar: z.string(),
    status: z.string(),
    due_at: z.string().nullable(),
  })).nullable().optional(),
  deliverables: z.array(z.object({ status: z.string() })).nullable().optional(),
});
const contractRow = z.object({
  id,
  status: z.string(),
  contract_signatures: z.array(z.object({ id })).nullable().optional(),
});

export type ClientHomeMissionSummary =
  | {
      status: "success";
      organizationName: string;
      missions: Array<{ status: string; milestones: Array<{ title: string; status: string; dueAt: string | null }>; deliverables: Array<{ status: string }> }>;
      contracts: Array<{ status: string; signatureCount: number }>;
    }
  | { status: "error"; reason: "UNAUTHENTICATED" | "FORBIDDEN_ORGANIZATION" | "NO_CLIENT_ORGANIZATION" | "ORGANIZATION_SELECTION_REQUIRED" | "QUERY_FAILED" | "INVALID_RESPONSE" };

/** Dashboard-home slice: membership + one nested missions query + one contracts query. */
export async function loadClientHomeMissionSummary(locale: "fr" | "ar", requestedOrganizationId?: string): Promise<ClientHomeMissionSummary> {
  const client = await getSupabaseServerClient();
  const authResult = await getServerAuthUser();
  const authFailure = classifyAuthReadFailure(authResult.error);
  if (authFailure) return { status: "error", reason: authFailure === "UNAVAILABLE" ? "QUERY_FAILED" : "UNAUTHENTICATED" };
  if (!authResult.data.user) return { status: "error", reason: "UNAUTHENTICATED" };

  const membershipResult = await client
    .from("organization_memberships")
    .select("organization_id,organizations!inner(display_name),organization_member_roles!inner(role_code,revoked_at)")
    .eq("user_id", authResult.data.user.id)
    .eq("status", "ACTIVE")
    .is("organization_member_roles.revoked_at", null)
    .in("organization_member_roles.role_code", ["CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_BUYER"])
    .order("organization_id")
    .limit(100);
  if (membershipResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const memberships = z.array(member).safeParse(membershipResult.data);
  if (!memberships.success) return { status: "error", reason: "INVALID_RESPONSE" };
  const context = resolveClientOrganizationContext(memberships.data, requestedOrganizationId);
  if (context.status === "error") return context;
  const membership = context.membership;
  const organizationId = membership.organization_id;

  const [missionsResult, contractsResult] = await Promise.all([
    client
      .from("missions")
      .select("id,status,mission_milestones(title_fr,title_ar,status,due_at),deliverables(status)")
      .eq("client_organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(80),
    client
      .from("contracts")
      .select("id,status,contract_signatures(id)")
      .eq("client_organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(80),
  ]);
  if (missionsResult.error || contractsResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const missions = z.array(missionRow).safeParse(missionsResult.data);
  const contracts = z.array(contractRow).safeParse(contractsResult.data);
  if (!missions.success || !contracts.success) return { status: "error", reason: "INVALID_RESPONSE" };

  return {
    status: "success",
    organizationName: membership.organizations.display_name,
    missions: missions.data.map((mission) => ({
      status: mission.status,
      milestones: (mission.mission_milestones ?? []).map((milestone) => ({
        title: locale === "ar" ? milestone.title_ar : milestone.title_fr,
        status: milestone.status,
        dueAt: milestone.due_at,
      })),
      deliverables: (mission.deliverables ?? []).map((item) => ({ status: item.status })),
    })),
    contracts: contracts.data.map((contract) => ({
      status: contract.status,
      signatureCount: (contract.contract_signatures ?? []).length,
    })),
  };
}

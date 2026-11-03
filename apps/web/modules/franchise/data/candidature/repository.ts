import { z } from "zod";
import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

export const franchiseApplicationStatuses = [
  "REGISTERED", "COMPANY_REVIEW", "DOCUMENT_REVIEW", "CLOSED", "CONTRACT_PENDING", "ENTRY_FEE_SETUP",
  "LIBRARY_ASSIGNED", "ACTIVE", "FINANCIAL_RESTRICTED", "SUSPENDED", "TERMINATED",
] as const;
export type FranchiseApplicationStatus = (typeof franchiseApplicationStatuses)[number];

const applicationSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(franchiseApplicationStatuses),
  territory_code: z.string(),
  domain_label: z.string(),
  organization_id: z.string().uuid().nullable(),
  franchise_id: z.string().uuid().nullable(),
  row_version: z.number().int().positive(),
  created_at: z.string(),
});
const membershipSchema = z.object({
  organization_id: z.string().uuid(),
  organizations: z.object({ display_name: z.string(), status: z.string() }),
  organization_member_roles: z.array(z.object({ role_code: z.string(), revoked_at: z.string().nullable() })),
});
const invitationSchema = z.object({ id: z.string().uuid(), franchise_id: z.string().uuid(), status: z.string() });

export type MyFranchiseApplication = {
  id: string;
  reference: string;
  status: FranchiseApplicationStatus;
  territoryCode: string;
  domainLabel: string;
  organizationId: string | null;
  organizationName: string | null;
  invitationId: string | null;
  rowVersion: number;
  createdAt: string;
};
export type MyFranchiseApplications =
  | { status: "anonymous" }
  | { status: "error" }
  | { status: "success"; applications: MyFranchiseApplication[]; ownedOrganizations: Array<{ id: string; name: string }> };

export async function loadMyFranchiseApplications(): Promise<MyFranchiseApplications> {
  const client = await getSupabaseServerClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (classifyAuthReadFailure(authError) === "UNAVAILABLE") return { status: "error" };
  const email = auth.user?.email?.toLowerCase();
  if (!auth.user || !email) return { status: "anonymous" };
  const [applicationsResult, membershipsResult] = await Promise.all([
    client.from("franchise_applications")
      .select("id,status,territory_code,domain_label,organization_id,franchise_id,row_version,created_at")
      .eq("reply_email", email).order("created_at", { ascending: false }).order("id").limit(20),
    client.from("organization_memberships")
      .select("organization_id,organizations!inner(display_name,status),organization_member_roles(role_code,revoked_at)")
      .eq("user_id", auth.user.id).eq("status", "ACTIVE").order("organization_id").limit(50),
  ]);
  const applications = z.array(applicationSchema).safeParse(applicationsResult.data);
  const memberships = z.array(membershipSchema).safeParse(membershipsResult.data);
  if (applicationsResult.error || membershipsResult.error || !applications.success || !memberships.success) return { status: "error" };
  const ownedOrganizations = memberships.data
    .filter((member) => member.organizations.status !== "ARCHIVED" && member.organization_member_roles.some((role) => role.role_code === "FRANCHISE_OWNER" && role.revoked_at === null))
    .map((member) => ({ id: member.organization_id, name: member.organizations.display_name }));
  const franchiseIds = applications.data.flatMap((row) => row.franchise_id ? [row.franchise_id] : []);
  const invitationsResult = franchiseIds.length
    ? await client.from("franchise_invitations").select("id,franchise_id,status").in("franchise_id", franchiseIds).order("created_at", { ascending: false })
    : { data: [], error: null };
  const invitations = z.array(invitationSchema).safeParse(invitationsResult.data);
  if (invitationsResult.error || !invitations.success) return { status: "error" };
  const names = new Map(ownedOrganizations.map((organization) => [organization.id, organization.name]));
  return {
    status: "success",
    ownedOrganizations,
    applications: applications.data.map((row) => ({
      id: row.id,
      reference: row.id.slice(0, 8).toUpperCase(),
      status: row.status,
      territoryCode: row.territory_code,
      domainLabel: row.domain_label,
      organizationId: row.organization_id,
      organizationName: row.organization_id ? names.get(row.organization_id) ?? null : null,
      invitationId: invitations.data.find((invitation) => invitation.franchise_id === row.franchise_id)?.id ?? null,
      rowVersion: row.row_version,
      createdAt: row.created_at,
    })),
  };
}

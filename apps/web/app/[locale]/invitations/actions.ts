"use server";

import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isLocale, type Locale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

const invitationRoles = [
  "CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_BUYER", "CLIENT_ACCOUNTING", "CLIENT_MEMBER", "CLIENT_VIEWER",
  "PROVIDER_OWNER", "PROVIDER_MANAGER", "PROVIDER_SALES", "PROVIDER_TECHNICIAN", "PROVIDER_ACCOUNTING", "PROVIDER_VIEWER",
  "FRANCHISE_OWNER", "FRANCHISE_MANAGER", "FRANCHISE_EXPERT", "FRANCHISE_PROVIDER_MANAGER", "FRANCHISE_ACCOUNTING", "FRANCHISE_VIEWER",
] as const;

const inviterRoles = new Set([
  "CLIENT_OWNER", "CLIENT_ADMIN", "PROVIDER_OWNER", "PROVIDER_MANAGER", "FRANCHISE_OWNER", "FRANCHISE_MANAGER",
]);
const invitationRoleSchema = z.enum(invitationRoles);
const uuidSchema = z.string().uuid();
const emailSchema = z.string().trim().toLowerCase().email().max(320);
const inviteSchema = z.object({
  organizationId: uuidSchema,
  invitedEmail: emailSchema,
  roleCodes: z.array(invitationRoleSchema).min(1).max(invitationRoles.length),
  expiryDays: z.enum(["1", "7", "14", "30"]),
  idempotencyKey: z.string().min(8).max(200),
});
const decisionSchema = z.object({
  invitationId: uuidSchema,
  locale: z.string().refine(isLocale),
  confirmed: z.literal("yes"),
});
const membershipRowSchema = z.object({ id: uuidSchema, organization_id: uuidSchema });
const memberRoleRowSchema = z.object({ membership_id: uuidSchema, role_code: z.string(), revoked_at: z.string().nullable() });
const organizationRowSchema = z.object({ id: uuidSchema, display_name: z.string().min(1).max(200) });
const invitationRowSchema = z.object({
  id: uuidSchema,
  organization_id: uuidSchema,
  invited_user_id: uuidSchema.nullable(),
  invited_email: emailSchema,
  invited_by: uuidSchema,
  status: z.enum(["PENDING", "ACCEPTED", "DECLINED", "REVOKED", "EXPIRED"]),
  expires_at: z.string(),
  created_at: z.string(),
});
const invitationRoleRowSchema = z.object({ invitation_id: uuidSchema, role_code: invitationRoleSchema });

export type InvitationRole = (typeof invitationRoles)[number];
export type InvitationStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED" | "EXPIRED";
export type InvitationOrganization = { id: string; displayName: string };
export type SafeInvitation = {
  id: string;
  organizationName: string | null;
  roles: InvitationRole[];
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
  direction: "RECEIVED" | "MANAGED";
};
export type InvitationsQueryResult =
  | { status: "success"; organizations: InvitationOrganization[]; invitations: SafeInvitation[] }
  | { status: "error"; reason: "UNAUTHENTICATED" | "UNAVAILABLE" };
export type InvitationActionState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "UNAVAILABLE" };

function routeLocale(value: FormDataEntryValue | null): Locale {
  return typeof value === "string" && isLocale(value) ? value : "fr";
}

function effectiveStatus(status: InvitationStatus, expiresAt: string): InvitationStatus {
  return status === "PENDING" && Date.parse(expiresAt) <= Date.now() ? "EXPIRED" : status;
}

export async function listInvitations(): Promise<InvitationsQueryResult> {
  const supabase = await getSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  const authFailure = classifyAuthReadFailure(userError);
  if (authFailure) return { status: "error", reason: authFailure };
  if (!user) return { status: "error", reason: "UNAUTHENTICATED" };

  const { data: rawMemberships, error: membershipsError } = await supabase
    .from("organization_memberships")
    .select("id,organization_id")
    .eq("user_id", user.id)
    .eq("status", "ACTIVE");
  if (membershipsError) return { status: "error", reason: "UNAVAILABLE" };
  const memberships = z.array(membershipRowSchema).safeParse(rawMemberships);
  if (!memberships.success) return { status: "error", reason: "UNAVAILABLE" };

  const membershipIds = memberships.data.map((membership) => membership.id);
  const organizationIds = [...new Set(memberships.data.map((membership) => membership.organization_id))];
  const [rolesResult, organizationsResult, invitationsResult] = await Promise.all([
    membershipIds.length > 0
      ? supabase.from("organization_member_roles").select("membership_id,role_code,revoked_at").in("membership_id", membershipIds)
      : Promise.resolve({ data: [], error: null }),
    organizationIds.length > 0
      ? supabase.from("organizations").select("id,display_name").in("id", organizationIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("organization_invitations")
      .select("id,organization_id,invited_user_id,invited_email,invited_by,status,expires_at,created_at")
      .order("created_at", { ascending: false }),
  ]);
  if (rolesResult.error || organizationsResult.error || invitationsResult.error) {
    return { status: "error", reason: "UNAVAILABLE" };
  }
  const memberRoles = z.array(memberRoleRowSchema).safeParse(rolesResult.data);
  const organizations = z.array(organizationRowSchema).safeParse(organizationsResult.data);
  const invitations = z.array(invitationRowSchema).safeParse(invitationsResult.data);
  if (!memberRoles.success || !organizations.success || !invitations.success) {
    return { status: "error", reason: "UNAVAILABLE" };
  }

  const eligibleMembershipIds = new Set(
    memberRoles.data
      .filter((role) => role.revoked_at === null && inviterRoles.has(role.role_code))
      .map((role) => role.membership_id),
  );
  const eligibleOrganizationIds = new Set(
    memberships.data
      .filter((membership) => eligibleMembershipIds.has(membership.id))
      .map((membership) => membership.organization_id),
  );
  const organizationNames = new Map(organizations.data.map((organization) => [organization.id, organization.display_name]));
  const visibleOrganizations = organizations.data
    .filter((organization) => eligibleOrganizationIds.has(organization.id))
    .map((organization) => ({ id: organization.id, displayName: organization.display_name }));

  const invitationIds = invitations.data.map((invitation) => invitation.id);
  const { data: rawInvitationRoles, error: invitationRolesError } = invitationIds.length > 0
    ? await supabase.from("organization_invitation_roles").select("invitation_id,role_code").in("invitation_id", invitationIds)
    : { data: [], error: null };
  if (invitationRolesError) return { status: "error", reason: "UNAVAILABLE" };
  const parsedInvitationRoles = z.array(invitationRoleRowSchema).safeParse(rawInvitationRoles);
  if (!parsedInvitationRoles.success) return { status: "error", reason: "UNAVAILABLE" };
  const rolesByInvitation = new Map<string, InvitationRole[]>();
  for (const role of parsedInvitationRoles.data) {
    const assigned = rolesByInvitation.get(role.invitation_id) ?? [];
    assigned.push(role.role_code);
    rolesByInvitation.set(role.invitation_id, assigned);
  }

  return {
    status: "success",
    organizations: visibleOrganizations,
    invitations: invitations.data.map((invitation) => ({
      id: invitation.id,
      organizationName: organizationNames.get(invitation.organization_id) ?? null,
      roles: rolesByInvitation.get(invitation.id) ?? [],
      status: effectiveStatus(invitation.status, invitation.expires_at),
      createdAt: invitation.created_at,
      expiresAt: invitation.expires_at,
      direction: invitation.invited_user_id === user.id || invitation.invited_email === user.email?.toLowerCase()
        ? "RECEIVED"
        : "MANAGED",
    })),
  };
}

export async function createInvitation(
  _previousState: InvitationActionState,
  formData: FormData,
): Promise<InvitationActionState> {
  const parsed = inviteSchema.safeParse({
    organizationId: formData.get("organizationId"),
    invitedEmail: formData.get("invitedEmail"),
    roleCodes: formData.getAll("roleCodes"),
    expiryDays: formData.get("expiryDays"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  const locale = routeLocale(formData.get("locale"));
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };

  const supabase = await getSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  const authFailure = classifyAuthReadFailure(userError);
  if (authFailure) return { status: "error", reason: authFailure };
  if (!user) return { status: "error", reason: "UNAUTHENTICATED" };
  if (parsed.data.invitedEmail === user.email?.toLowerCase()) return { status: "error", reason: "VALIDATION" };

  const expiresAt = new Date(Date.now() + Number(parsed.data.expiryDays) * 86_400_000).toISOString();
  const { error } = await supabase.rpc("invite_organization_member_by_email", {
    p_organization_id: parsed.data.organizationId,
    p_invited_email: parsed.data.invitedEmail,
    p_role_codes: [...new Set(parsed.data.roleCodes)],
    p_expires_at: expiresAt,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: randomUUID(),
  });
  if (error) return { status: "error", reason: "UNAVAILABLE" };
  // Email delivery is owned by OrganizationEmailInvitationRequestedV1 → outbox consumer.
  revalidatePath(`/${locale}/invitations`);
  return { status: "success" };
}

async function decideInvitation(
  formData: FormData,
  rpc: "accept_organization_invitation" | "decline_organization_invitation",
): Promise<InvitationActionState> {
  const parsed = decisionSchema.safeParse({
    invitationId: formData.get("invitationId"),
    locale: formData.get("locale"),
    confirmed: formData.get("confirmed"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const supabase = await getSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  const authFailure = classifyAuthReadFailure(userError);
  if (authFailure) return { status: "error", reason: authFailure };
  if (!user) return { status: "error", reason: "UNAUTHENTICATED" };
  const { error } = await supabase.rpc(rpc, {
    p_invitation_id: parsed.data.invitationId,
    p_correlation_id: randomUUID(),
  });
  if (error) return { status: "error", reason: "UNAVAILABLE" };
  revalidatePath(`/${parsed.data.locale}/invitations`);
  return { status: "success" };
}

export async function acceptInvitation(
  _previousState: InvitationActionState,
  formData: FormData,
): Promise<InvitationActionState> {
  return decideInvitation(formData, "accept_organization_invitation");
}

export async function declineInvitation(
  _previousState: InvitationActionState,
  formData: FormData,
): Promise<InvitationActionState> {
  return decideInvitation(formData, "decline_organization_invitation");
}

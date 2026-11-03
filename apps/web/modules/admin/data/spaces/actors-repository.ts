import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { listInvitations, type InvitationOrganization, type SafeInvitation } from "@/app/[locale]/invitations/actions";
import { loadAdminClients } from "@/modules/admin/data/clients/repository";
import { loadAdminOrganizationFiche, loadAdminSupervisionDashboard } from "@/modules/admin/data/supervision/repository";
import type { AdminOrganizationFiche, AdminSupervisionDashboard } from "@/modules/admin/data/supervision/types";
import { canApplyAdminDemo, demoActorUsers as overlayActorUsers, demoClientCases, demoClientOrganizations, demoDiagnostics, demoSupervisionOrganizations } from "./demo-overlay";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

import { actorPageSchema, mapActorUserRow, type ActorUserRow } from "./actor-user-model";
export type { ActorUserRow } from "./actor-user-model";

export type ActorDirectory = {
  organizations: AdminSupervisionDashboard["organizations"];
  users: ActorUserRow[];
  invites: SafeInvitation[];
  inviteOrganizations: InvitationOrganization[];
  forbidden: boolean;
  reason?: "UNAUTHENTICATED" | "FORBIDDEN" | "UNAVAILABLE" | "INVALID_RESPONSE";
};

export type ActorUserResult =
  | {
    status: "success";
    rows: ActorUserRow[];
    fiche: AdminOrganizationFiche | null;
    organizations: AdminSupervisionDashboard["organizations"];
  }
  | { status: "error"; reason: NonNullable<ActorDirectory["reason"]> | "NOT_FOUND" };

export async function loadAdminActorDirectory(consistent = false): Promise<ActorDirectory> {
  const [supervision, invitations] = await Promise.all([loadAdminSupervisionDashboard(80,consistent), listInvitations()]);
  let organizations = supervision.status === "success" ? supervision.value.organizations : [];
  const inviteOrganizations = invitations.status === "success" ? invitations.organizations : [];
  const invites = invitations.status === "success" ? invitations.invitations.filter((item) => item.status === "PENDING" && item.direction === "MANAGED") : [];
  const actorResult = await loadActorRows(undefined,consistent);
  const users = actorResult.users;
  let forbidden = supervision.status === "error" && supervision.reason === "FORBIDDEN";
  if (canApplyAdminDemo()) {
    if (organizations.length === 0) organizations = demoSupervisionOrganizations;
    if (users.length === 0) users.push(...overlayActorUsers());
    forbidden = false;
  }
  return {
    organizations,
    users,
    invites,
    inviteOrganizations,
    forbidden,
    reason: actorResult.reason,
  };
}

export async function loadAdminActorUser(userId: string, organizationId?: string): Promise<ActorUserResult> {
  const [directory, actorResult] = await Promise.all([loadAdminActorDirectory(), loadActorRows(userId)]);
  const reason = actorResult.reason ?? directory.reason ?? (directory.forbidden ? "FORBIDDEN" : undefined);
  if (reason) return { status: "error", reason };
  const rows = organizationId === undefined
    ? actorResult.users
    : actorResult.users.filter((row) => row.organizationId === organizationId);
  const first = rows[0];
  const fiche = first?.organizationId ? await loadAdminOrganizationFiche(first.organizationId) : null;
  if (fiche?.status === "error") return fiche;
  return {
    status: "success",
    rows,
    fiche: fiche?.status === "success" ? fiche.value : null,
    organizations: directory.organizations,
  };
}

export function memberLabel(locale: Locale, organizationName: string) {
  return locale === "ar" ? `عضو · ${organizationName}` : `Membre · ${organizationName}`;
}

export function demoActorUsers(): ActorUserRow[] {
  if (!canApplyAdminDemo()) return [];
  return overlayActorUsers();
}

export async function loadAdminClientDirectory(locale: Locale) {
  try {
    const [supervision, clients] = await Promise.all([loadAdminSupervisionDashboard(100), loadAdminClients(locale)]);
    let organizations = supervision.status === "success"
      ? supervision.value.organizations.filter((org) => (org.role_codes ?? []).includes("CLIENT"))
      : [];
    let cases = clients.status === "success" ? clients.dashboard.cases : [];
    let diagnostics = supervision.status === "success" ? supervision.value.diagnostics : [];
    const reason = clients.status === "error" ? clients.reason : supervision.status === "error" ? supervision.reason : null;
    if (!reason && canApplyAdminDemo()) {
      if (organizations.length === 0) organizations = demoClientOrganizations(locale);
      if (cases.length === 0) cases = demoClientCases();
      if (diagnostics.length === 0) diagnostics = demoDiagnostics();
    }
    return {
      organizations,
      cases,
      diagnostics,
      dashboard: clients.status === "success" ? clients.dashboard : null,
      reason,
      keys: clients.status === "success"
        ? Object.fromEntries(clients.dashboard.cases.flatMap((item) => [
          [`case:${item.id}`, crypto.randomUUID()],
          ...item.documents.map((document) => [`document:${document.id}`, crypto.randomUUID()] as const),
          ...item.questions.map((question) => [`response:${question.id}`, crypto.randomUUID()] as const),
        ]))
        : {} as Record<string, string>,
    };
  } catch {
    return { organizations: [], cases: [], diagnostics: [], dashboard: null, reason: "UNAVAILABLE" as const, keys: {} as Record<string, string> };
  }
}

async function loadActorRows(userId?: string,consistent = false): Promise<{ users: ActorUserRow[]; reason?: ActorDirectory["reason"] }> {
  const client = await getSupabaseServerClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  const authFailure = classifyAuthReadFailure(authError);
  if (authFailure) return { users: [], reason: authFailure };
  if (!auth.user) return { users: [], reason: "UNAUTHENTICATED" };
  const users: ActorUserRow[] = [];
  let offset = 0;
  do {
    const response = consistent ? await client.rpc("get_admin_actor_directory_snapshot_v1") : await client.rpc("list_admin_actor_directory_v1", { p_limit: 500, p_offset: offset, p_user_id: userId ?? null });
    if (response.error) return { users: [], reason: response.error.code === "42501" ? "FORBIDDEN" : "UNAVAILABLE" };
    const parsed = actorPageSchema.safeParse(response.data);
    if (!parsed.success) return { users: [], reason: "INVALID_RESPONSE" };
    users.push(...parsed.data.rows.map(mapActorUserRow));
    offset += parsed.data.rows.length;
    if (offset >= parsed.data.total) break;
    if (!parsed.data.rows.length) return { users: [], reason: "INVALID_RESPONSE" };
  } while (true);
  return { users };
}

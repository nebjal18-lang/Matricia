import { z } from "zod";

export type ActorUserRow = {
  userId: string;
  membershipId: string | null;
  organizationId: string | null;
  organizationName: string | null;
  roles: string[];
  status: string;
  updatedAt: string | null;
  displayName?: string | null;
  email?: string | null;
  platformRoles?: string[];
  accountStatus?: string;
  lastSignInAt?: string | null;
  mfaStatus?: "ENABLED" | "DISABLED" | "UNKNOWN";
  sessionCount?: number;
};

const actorRow = z.object({
  user_id: z.string().uuid(), membership_id: z.string().uuid().nullable(),
  organization_id: z.string().uuid().nullable(), organization_name: z.string().nullable(),
  roles: z.array(z.string()), status: z.string(), updated_at: z.string().nullable(),
  display_name: z.string().nullable().optional(), email: z.string().nullable().optional(),
  platform_roles: z.array(z.string()).optional(), account_status: z.string().optional(),
  last_sign_in_at: z.string().nullable().optional(),
  mfa_status: z.enum(["ENABLED", "DISABLED", "UNKNOWN"]), session_count: z.number().int().nonnegative(),
}).superRefine((row, context) => {
  const unassigned = row.membership_id === null;
  if (unassigned !== (row.organization_id === null) || unassigned !== (row.organization_name === null)
    || (unassigned && row.roles.length > 0)) {
    context.addIssue({ code: "custom", message: "Account and organization membership must have distinct, coherent scopes" });
  }
});

export const actorPageSchema = z.object({ rows: z.array(actorRow), total: z.coerce.number().int().nonnegative() });
export function mapActorUserRow(row: z.infer<typeof actorRow>): ActorUserRow {
  return { userId: row.user_id, membershipId: row.membership_id, organizationId: row.organization_id,
    organizationName: row.organization_name, roles: row.roles, status: row.status, updatedAt: row.updated_at,
    displayName: row.display_name, email: row.email, platformRoles: row.platform_roles ?? [],
    accountStatus: row.account_status, lastSignInAt: row.last_sign_in_at,
    mfaStatus: row.mfa_status, sessionCount: row.session_count };
}

export type ActorUserFilters = { org?: string; role?: string; status?: string };
export function matchesActorUser(row: ActorUserRow, filters?: ActorUserFilters, search?: string): boolean {
  if (filters?.org && filters.org !== "all" && !(filters.org === "unassigned" ? row.organizationId === null
    : row.organizationId === filters.org || row.organizationName === filters.org)) return false;
  if (filters?.role && filters.role !== "all" && ![...row.roles, ...(row.platformRoles ?? [])].includes(filters.role)) return false;
  if (filters?.status && filters.status !== "all" && row.status !== filters.status) return false;
  return !search || [row.userId, row.displayName, row.email, row.organizationName,
    ...row.roles, ...(row.platformRoles ?? [])].filter(Boolean).join(" ").toLocaleLowerCase().includes(search.toLocaleLowerCase());
}

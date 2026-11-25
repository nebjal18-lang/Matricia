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
  phone?: string | null;
  preferredLocale?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  platformRoles?: string[];
  libraryScopes?: string[];
  franchiseScopes?: string[];
  accountStatus?: string;
  lastSignInAt?: string | null;
  mfaStatus?: "ENABLED" | "DISABLED" | "UNKNOWN";
  sessionCount?: number;
};

export type ActorMembershipSummary = {
  membershipId: string | null;
  organizationId: string | null;
  organizationName: string | null;
  roles: string[];
  libraryScopes: string[];
  franchiseScopes: string[];
  status: string;
};

export type ActorAccountSummary = {
  userId: string;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  preferredLocale?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  platformRoles: string[];
  libraryScopes: string[];
  franchiseScopes: string[];
  accountStatus?: string;
  lastSignInAt?: string | null;
  mfaStatus?: "ENABLED" | "DISABLED" | "UNKNOWN";
  sessionCount?: number;
  memberships: ActorMembershipSummary[];
};

const actorRow = z.object({
  user_id: z.string().uuid(), membership_id: z.string().uuid().nullable(),
  organization_id: z.string().uuid().nullable(), organization_name: z.string().nullable(),
  roles: z.array(z.string()), status: z.string(), updated_at: z.string().nullable(),
  display_name: z.string().nullable().optional(), email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(), preferred_locale: z.string().nullable().optional(),
  given_name: z.string().nullable().optional(), family_name: z.string().nullable().optional(),
  platform_roles: z.array(z.string()).optional(),
  library_scopes: z.array(z.string()).optional(),
  franchise_scopes: z.array(z.string()).optional(),
  account_status: z.string().optional(),
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
  return {
    userId: row.user_id, membershipId: row.membership_id, organizationId: row.organization_id,
    organizationName: row.organization_name, roles: row.roles, status: row.status, updatedAt: row.updated_at,
    displayName: row.display_name, email: row.email, phone: row.phone ?? null,
    preferredLocale: row.preferred_locale ?? null, givenName: row.given_name ?? null, familyName: row.family_name ?? null,
    platformRoles: row.platform_roles ?? [],
    libraryScopes: row.library_scopes ?? [],
    franchiseScopes: row.franchise_scopes ?? [],
    accountStatus: row.account_status, lastSignInAt: row.last_sign_in_at,
    mfaStatus: row.mfa_status, sessionCount: row.session_count,
  };
}

export type ActorUserFilters = { org?: string; role?: string; status?: string };
export function matchesActorUser(row: ActorUserRow, filters?: ActorUserFilters, search?: string): boolean {
  if (filters?.org && filters.org !== "all" && !(filters.org === "unassigned" ? row.organizationId === null
    : row.organizationId === filters.org || row.organizationName === filters.org)) return false;
  if (filters?.role && filters.role !== "all" && ![...row.roles, ...(row.platformRoles ?? [])].includes(filters.role)) return false;
  const status = row.accountStatus ?? row.status;
  if (filters?.status && filters.status !== "all" && status !== filters.status && row.status !== filters.status) return false;
  return !search || [row.userId, row.displayName, row.email, row.phone, row.preferredLocale, row.givenName, row.familyName, row.organizationName,
    ...row.roles, ...(row.platformRoles ?? [])].filter(Boolean).join(" ").toLocaleLowerCase().includes(search.toLocaleLowerCase());
}

/** One account card per Auth user — memberships stay nested, never duplicated as fake people. */
export function groupActorAccounts(rows: readonly ActorUserRow[]): ActorAccountSummary[] {
  const byUser = new Map<string, ActorAccountSummary>();
  for (const row of rows) {
    let account = byUser.get(row.userId);
    if (!account) {
      account = {
        userId: row.userId,
        displayName: row.displayName,
        email: row.email,
        phone: row.phone,
        preferredLocale: row.preferredLocale,
        givenName: row.givenName,
        familyName: row.familyName,
        platformRoles: [...(row.platformRoles ?? [])],
        libraryScopes: [...(row.libraryScopes ?? [])],
        franchiseScopes: [...(row.franchiseScopes ?? [])],
        accountStatus: row.accountStatus,
        lastSignInAt: row.lastSignInAt,
        mfaStatus: row.mfaStatus,
        sessionCount: row.sessionCount,
        memberships: [],
      };
      byUser.set(row.userId, account);
    } else {
      if (!account.displayName && row.displayName) account.displayName = row.displayName;
      if (!account.email && row.email) account.email = row.email;
      if (!account.phone && row.phone) account.phone = row.phone;
      if (!account.preferredLocale && row.preferredLocale) account.preferredLocale = row.preferredLocale;
      if (!account.givenName && row.givenName) account.givenName = row.givenName;
      if (!account.familyName && row.familyName) account.familyName = row.familyName;
      if (!account.lastSignInAt && row.lastSignInAt) account.lastSignInAt = row.lastSignInAt;
      if (account.mfaStatus !== "ENABLED" && row.mfaStatus) account.mfaStatus = row.mfaStatus;
      if ((row.sessionCount ?? 0) > (account.sessionCount ?? 0)) account.sessionCount = row.sessionCount;
      if (row.accountStatus) account.accountStatus = row.accountStatus;
      for (const role of row.platformRoles ?? []) {
        if (!account.platformRoles.includes(role)) account.platformRoles.push(role);
      }
      for (const scope of row.libraryScopes ?? []) {
        if (!account.libraryScopes.includes(scope)) account.libraryScopes.push(scope);
      }
      for (const scope of row.franchiseScopes ?? []) {
        if (!account.franchiseScopes.includes(scope)) account.franchiseScopes.push(scope);
      }
    }
    if (row.membershipId !== null || row.organizationId !== null) {
      const already = account.memberships.some((item) => item.membershipId === row.membershipId && item.organizationId === row.organizationId);
      if (!already) {
        account.memberships.push({
          membershipId: row.membershipId,
          organizationId: row.organizationId,
          organizationName: row.organizationName,
          roles: [...row.roles],
          libraryScopes: [...(row.libraryScopes ?? [])],
          franchiseScopes: [...(row.franchiseScopes ?? [])],
          status: row.status,
        });
      }
    }
  }
  return [...byUser.values()].sort((a, b) => {
    const left = `${a.familyName ?? ""} ${a.givenName ?? ""} ${a.displayName ?? ""} ${a.email ?? ""}`.trim();
    const right = `${b.familyName ?? ""} ${b.givenName ?? ""} ${b.displayName ?? ""} ${b.email ?? ""}`.trim();
    return left.localeCompare(right, "fr");
  });
}

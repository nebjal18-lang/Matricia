import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { loadMyPlatformAccess, hasPlatformRole } from "@/modules/shared/lib/account-security/platform-access";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { PLATFORM_ADMIN_ROLES } from "@/modules/shared/lib/connected-space/workspace-landing";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { WorkspaceFailure, type WorkspaceFailureReason } from "@/modules/shared/ui/workspace-failure";
import { AdminAppShell, type AdminNavKey } from "./admin-app-shell";

/** Database denial is never evidence that MFA is missing: assurance is checked independently first. */
export function adminReadFailure(error: { code?: string } | null | undefined): WorkspaceFailureReason {
  if (!error) return "INVALID_RESPONSE";
  if (error.code === "42501") return "FORBIDDEN";
  if (error.code === "PGRST301" || error.code === "PGRST303") return "UNAUTHENTICATED";
  if (["PGRST202", "PGRST205", "42883", "42P01"].includes(error.code ?? "")) return "CONFIGURATION";
  return "QUERY_FAILED";
}

export async function sensitivePageContext(input: { locale: Locale; path: string; active: AdminNavKey; title: string; lead?: string; kicker?: string; roles?: readonly string[] }) {
  const { locale } = input;
  const selfPath = `/${locale}/administration/${input.path}`;
  const access = await loadMyPlatformAccess();
  if (access.status === "error" && access.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: selfPath }));
  const isAdmin = access.status === "ok" && hasPlatformRole(access.roles, PLATFORM_ADMIN_ROLES);
  const shell = { locale, selectedQuery: "", selectedOrganizationId: null, userEmail: access.status === "ok" ? access.email : null, active: input.active, alternateHref: `/${locale === "fr" ? "ar" : "fr"}/administration/${input.path}`, title: input.title, lead: input.lead, kicker: input.kicker };
  const wrap = (children: ReactNode) => isAdmin ? <AdminAppShell {...shell}>{children}</AdminAppShell> : <main dir={locale === "ar" ? "rtl" : "ltr"} className="mx-auto max-w-3xl p-6">{children}</main>;
  if (access.status === "error") return { status: "blocked" as const, view: wrap(<WorkspaceFailure locale={locale} reason={access.reason} returnPath={selfPath} />) };
  if (!isAdmin || !hasPlatformRole(access.roles, input.roles ?? PLATFORM_ADMIN_ROLES)) return { status: "blocked" as const, view: wrap(<WorkspaceFailure locale={locale} reason="FORBIDDEN" returnPath={selfPath} />) };
  if (!access.requirementSatisfied) return { status: "blocked" as const, view: wrap(<WorkspaceFailure locale={locale} reason="MFA_REQUIRED" returnPath={selfPath} />) };
  return { status: "authorized" as const, access, wrap, selfPath };
}

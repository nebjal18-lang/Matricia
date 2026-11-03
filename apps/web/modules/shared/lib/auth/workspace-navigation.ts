import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { safeReturnPath } from "./return-path";
import { PLATFORM_ADMIN_ROLES, type WorkspaceLanding } from "@/modules/shared/lib/connected-space/workspace-landing";

export type WorkspaceNavigation = {
  signedIn: boolean;
  landing: WorkspaceLanding | null;
  options: Array<{ kind: WorkspaceLanding; href: string }>;
};

export function availableWorkspaces(membershipRoles: Iterable<string>, platformRoles: Iterable<string>): WorkspaceLanding[] {
  const roles = new Set(membershipRoles);
  const platform = new Set(platformRoles);
  const result: WorkspaceLanding[] = [];
  if (["CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_BUYER", "CLIENT_ACCOUNTING", "CLIENT_MEMBER", "CLIENT_VIEWER"].some(role => roles.has(role))) result.push("client");
  if (["PROVIDER_OWNER", "PROVIDER_MANAGER", "PROVIDER_SALES", "PROVIDER_TECHNICIAN", "PROVIDER_VIEWER", "PROVIDER_ACCOUNTING"].some(role => roles.has(role))) result.push("provider");
  if (["FRANCHISE_OWNER", "FRANCHISE_MANAGER", "FRANCHISE_EXPERT", "FRANCHISE_PROVIDER_MANAGER", "FRANCHISE_ACCOUNTING", "FRANCHISE_VIEWER"].some(role => roles.has(role))) result.push("franchise");
  if (PLATFORM_ADMIN_ROLES.some(role => platform.has(role))) result.push("administration");
  return result;
}

/** This is a navigation hint only: destination pages and RPCs keep their own authorization. */
export function authorizedReturnPath(value: unknown, locale: Locale, allowed: readonly WorkspaceLanding[]): string | undefined {
  const path = safeReturnPath(value, locale);
  if (!path) return undefined;
  const pathname = new URL(path, "https://matricia.invalid").pathname;
  const prefix = pathname.split("/")[2];
  if (prefix === "administration" && !allowed.includes("administration")) return undefined;
  if (prefix === "client" && !allowed.includes("client")) return undefined;
  if (prefix === "sous-traitant" && !allowed.includes("provider")) return undefined;
  if (prefix === "franchise" && pathname !== `/${locale}/franchise` && !allowed.includes("franchise")) return undefined;
  if (prefix === "connexion" || prefix === "inscription" || prefix === "auth") return undefined;
  return path;
}

export function translateLocalPath(value: string, locale: Locale, alternate: Locale, depth = 0): string {
  const safe = safeReturnPath(value, locale);
  if (!safe) return `/${alternate}/tableau-de-bord`;
  const url = new URL(safe, "https://matricia.invalid");
  url.pathname = url.pathname.replace(`/${locale}/`, `/${alternate}/`);
  const nested = url.searchParams.get("next");
  if (nested) {
    const next = safeReturnPath(nested, locale);
    if (next && depth < 5) url.searchParams.set("next", translateLocalPath(next, locale, alternate, depth + 1));
    else url.searchParams.delete("next");
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Explicit workspace hint for the shared dashboard only; authorization stays on the server. */
export function withDashboardWorkspaceHint(value: string, locale: Locale, workspace: "provider" | "client"): string {
  const safe = safeReturnPath(value, locale) ?? `/${locale}/tableau-de-bord`;
  const url = new URL(safe, "https://matricia.invalid");
  if (url.pathname !== `/${locale}/tableau-de-bord`) return safe;
  url.searchParams.set("workspace", workspace);
  return `${url.pathname}${url.search}${url.hash}`;
}

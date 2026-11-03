import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { safeReturnPath } from "./return-path";

export function workspaceSecurityHref(locale: Locale, returnTo: string, organizationId?: string | null, workspace: "client" | "administration" = "client"): string {
  const fallback = `/${locale}/${workspace === "administration" ? "administration/command-center" : "tableau-de-bord"}`;
  const target = new URL(safeReturnPath(returnTo, locale) ?? fallback, "https://matricia.invalid");
  if (organizationId) target.searchParams.set("organizationId", organizationId);
  const query = new URLSearchParams({ workspace, next: `${target.pathname}${target.search}${target.hash}` });
  if (organizationId && workspace === "client") query.set("organizationId", organizationId);
  return `/${locale}/securite/compte?${query}`;
}

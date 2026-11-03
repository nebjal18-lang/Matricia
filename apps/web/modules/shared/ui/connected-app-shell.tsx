import "@/modules/client/ui/client-experience.css";
import "@/modules/provider/ui/provider-experience.css";
import "@/modules/franchise/ui/franchise-experience.css";
import "@/modules/admin/ui/admin-experience.css";
import "@/modules/shared/shell/admin-experience.css";
import { redirect, unstable_rethrow } from "next/navigation";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { resolveConnectedSpace } from "@/modules/shared/lib/account-security/connected-space";
import { ClientAppShell, type ClientNavKey } from "@/modules/client/ui/client-app-shell";
import { FranchiseAppShell, type FranchiseNavKey } from "@/modules/franchise/ui/franchise-app-shell";
import { ProviderAppShell, type ProviderNavKey } from "@/modules/provider/ui/provider-app-shell";
import { readWorkspaceNavigation } from "@/modules/shared/lib/auth/workspace-navigation-server";
import { translateLocalPath } from "@/modules/shared/lib/auth/workspace-navigation";
import { safeReturnPath } from "@/modules/shared/lib/auth/return-path";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { AdminAppShell } from "@/modules/admin/ui/admin-app-shell";
import { WorkspaceFailure } from "./workspace-failure";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

export async function ConnectedAppShell({
  locale,
  organizationId,
  currentPath,
  nextPath,
  workspace,
  allowContextFailure = false,
  title,
  lead,
  kicker,
  actions,
  clientActive,
  providerActive,
  franchiseActive,
  children,
}: {
  locale: Locale;
  organizationId?: string;
  currentPath?: string;
  nextPath?: string;
  workspace?: string;
  allowContextFailure?: boolean;
  title: string;
  lead?: string;
  kicker?: string;
  actions?: ReactNode;
  clientActive?: ClientNavKey;
  providerActive: ProviderNavKey;
  franchiseActive: FranchiseNavKey;
  children: ReactNode;
}): Promise<ReactNode> {
  const returnPath = safeReturnPath(currentPath, locale) ?? `/${locale}/tableau-de-bord`;
  const next = safeReturnPath(nextPath, locale);
  const preferred = workspace ?? (next?.startsWith(`/${locale}/administration/`) ? "administration" : next?.startsWith(`/${locale}/franchise/`) ? "franchise" : next?.startsWith(`/${locale}/sous-traitant/`) ? "provider" : (await cookies()).get("matricia.workspace")?.value);
  const navigation = await readWorkspaceNavigation(locale, organizationId, preferred);
  if (navigation.status === "error" && navigation.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: returnPath }));
  if (navigation.status === "error") return <main dir={locale === "ar" ? "rtl" : "ltr"} className="mx-auto max-w-3xl p-6"><WorkspaceFailure locale={locale} reason={navigation.reason} returnPath={returnPath}/>{allowContextFailure && navigation.reason !== "FORBIDDEN" ? children : null}</main>;
  const kind = navigation.navigation.landing;
  const option = navigation.navigation.options.find(item => item.kind === kind);
  const authorizedOrganizationId = option ? new URL(option.href, "https://matricia.invalid").searchParams.get("organizationId") ?? undefined : organizationId;
  // A role preference may select another membership; resolve that exact membership, never the first unrelated organization.
  let space;
  try {
    space = await resolveConnectedSpace({ locale, organizationId: kind === "administration" ? undefined : authorizedOrganizationId, allowDirectoryFailure: allowContextFailure });
  } catch (error) {
    unstable_rethrow(error);
    if (!allowContextFailure || !(error instanceof Error) || error.message !== "WORKSPACE_CONTEXT_UNAVAILABLE") throw error;
    space = { status: "success" as const, selectedOrganizationId: null, selectedQuery: "", organizationName: null, userEmail: navigation.userEmail ?? null, directoryUnavailable: true };
  }
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: returnPath }));
  const alternateHref = translateLocalPath(returnPath, locale, locale === "fr" ? "ar" : "fr");
  const shared = {
    locale,
    selectedQuery: space.selectedQuery,
    selectedOrganizationId: space.selectedOrganizationId,
    userEmail: space.userEmail,
    title,
    lead,
    kicker: kicker ?? space.organizationName ?? undefined,
    actions,
    alternateHref,
    languagePath: returnPath,
    children: <>{space.directoryUnavailable ? <WorkspaceFailure locale={locale} reason="QUERY_FAILED" returnPath={returnPath} /> : null}{children}</>,
  };
  if (kind === "administration") return <AdminAppShell {...shared} active="home" />;
  if (kind === "provider") {
    return <ProviderAppShell {...shared} active={providerActive} />;
  }
  if (kind === "franchise") {
    return <FranchiseAppShell {...shared} active={franchiseActive} />;
  }
  return <ClientAppShell {...shared} organizationName={space.organizationName} active={clientActive} />;
}

import { cookies } from "next/headers";
import { readWorkspaceNavigation } from "@/modules/shared/lib/auth/workspace-navigation-server";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { loadNotificationCenter } from "@/modules/shared/lib/notifications/repository";
import { ConnectedAppShell } from "@/modules/shared/ui/connected-app-shell";
import { getNotificationMessages } from "./messages";
import { NotificationsPanel } from "./notifications-panel";

export default async function NotificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string; workspace?: string; q?: string; unread?: string; before?: string; beforeId?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const m = getNotificationMessages(locale);
  const preferredWorkspace = query.workspace ?? (await cookies()).get("matricia.workspace")?.value;
  const navigation = await readWorkspaceNavigation(locale, query.organizationId, preferredWorkspace);
  const landing = navigation.status === "ok" ? navigation.navigation.landing : undefined;
  const option = navigation.status === "ok" ? navigation.navigation.options.find(item => item.kind === landing) : undefined;
  const selectedOrganizationId = query.organizationId ?? (option ? new URL(option.href, "https://matricia.invalid").searchParams.get("organizationId") ?? undefined : undefined);
  const contextQuery = new URLSearchParams();
  if (selectedOrganizationId) contextQuery.set("organizationId", selectedOrganizationId);
  if (landing ?? query.workspace) contextQuery.set("workspace", (landing ?? query.workspace)!);
  for (const key of ["q", "unread", "before", "beforeId"] as const) if (query[key]) contextQuery.set(key, query[key]!);
  const selfPath = `/${locale}/notifications${contextQuery.size ? `?${contextQuery}` : ""}`;
  const result = navigation.status === "error" ? navigation : await loadNotificationCenter(locale, selectedOrganizationId, { q: query.q, unread: query.unread === "1", before: query.before, beforeId: query.beforeId });
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: selfPath }));
  return (
    <ConnectedAppShell
      locale={locale}
      organizationId={selectedOrganizationId}
      currentPath={selfPath}
      workspace={landing ?? query.workspace}
      title={m.title}
      lead={m.description}
      clientActive="messages"
      providerActive="messages"
      franchiseActive="messages"
    >
      {result.status === "error" ? (
        <WorkspaceFailure locale={locale} reason={result.reason} returnPath={selfPath} />
      ) : (
        <NotificationsPanel dashboard={result.dashboard} locale={locale} workspace={landing ?? query.workspace} m={m} />
      )}
    </ConnectedAppShell>
  );
}

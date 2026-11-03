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
  searchParams: Promise<{ organizationId?: string; workspace?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const m = getNotificationMessages(locale);
  const contextQuery = new URLSearchParams();
  if (query.organizationId) contextQuery.set("organizationId", query.organizationId);
  if (query.workspace) contextQuery.set("workspace", query.workspace);
  const selfPath = `/${locale}/notifications${contextQuery.size ? `?${contextQuery}` : ""}`;
  const result = await loadNotificationCenter(locale, query.organizationId);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: selfPath }));
  return (
    <ConnectedAppShell
      locale={locale}
      organizationId={query.organizationId}
      currentPath={selfPath}
      workspace={query.workspace}
      title={m.title}
      lead={m.description}
      clientActive="messages"
      providerActive="messages"
      franchiseActive="messages"
    >
      {result.status === "error" ? (
        <WorkspaceFailure locale={locale} reason={result.reason} returnPath={selfPath} />
      ) : (
        <NotificationsPanel dashboard={result.dashboard} locale={locale} m={m} />
      )}
    </ConnectedAppShell>
  );
}

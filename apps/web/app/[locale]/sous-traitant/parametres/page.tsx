import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { loadProviderDashboard } from "@/modules/provider/data/qualification/repository";
import { resolveProviderSpace } from "@/modules/provider/data/spaces/context";
import { ProviderSettingsBoard } from "@/modules/provider/screens/spaces/settings-board";
import { ProviderAppShell } from "@/modules/provider/ui/provider-app-shell";
import { loadNotificationCenter } from "@/modules/shared/lib/notifications/repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";

export default async function ProviderSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveProviderSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/parametres` }));
  const organizationId = space.selectedOrganizationId ?? query.organizationId;
  const [dash, notif] = await Promise.all([loadProviderDashboard(organizationId), loadNotificationCenter(locale, organizationId)]);
  if (dash.status === "error" && dash.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/parametres` }));
  const title = locale === "ar" ? "التفضيلات" : "Préférences";
  const lead = locale === "ar"
    ? "عدّلوا طرق التدخل ووتيرة التنبيهات المرتبطة بمؤسستكم النشطة."
    : "Ajustez vos modalités d’intervention et le rythme de vos alertes pour l’organisation active.";
  const workspaceReason = (reason: string) => (
    reason === "UNAUTHENTICATED" || reason === "FORBIDDEN" || reason === "NO_ORGANIZATION" || reason === "MFA_REQUIRED" || reason === "CONFIGURATION" || reason === "UNAVAILABLE" || reason === "INVALID_RESPONSE"
      ? reason
      : "QUERY_FAILED"
  ) as "UNAUTHENTICATED" | "FORBIDDEN" | "NO_ORGANIZATION" | "MFA_REQUIRED" | "CONFIGURATION" | "UNAVAILABLE" | "INVALID_RESPONSE" | "QUERY_FAILED";
  return (
    <ProviderAppShell
      locale={locale}
      organizations={space.organizations} selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail}
      active="settings"
      title={title}
      lead={lead}
      kicker={locale === "ar" ? "فضاء المقاول من الباطن" : "Espace prestataire"}
    >
      {dash.status === "error" && dash.reason !== "UNAUTHENTICATED" ? (
        <WorkspaceFailure locale={locale} reason={workspaceReason(dash.reason)} returnPath={`/${locale}/sous-traitant/parametres${space.selectedQuery}`} />
      ) : null}
      <ProviderSettingsBoard
        locale={locale}
        query={space.selectedQuery}
        dashboard={dash.status === "success" ? dash.dashboard : null}
        notifications={notif.status === "success" ? notif.dashboard : null}
      />
      {notif.status === "error" ? <WorkspaceFailure locale={locale} reason={workspaceReason(notif.reason)} returnPath={`/${locale}/sous-traitant/parametres${space.selectedQuery}`} /> : null}
    </ProviderAppShell>
  );
}

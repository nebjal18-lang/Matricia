import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { loadProviderDashboard } from "@/modules/provider/data/qualification/repository";
import { resolveProviderSpace } from "@/modules/provider/data/spaces/context";
import { providerContextReadState } from "@/modules/provider/data/spaces/organization-context";
import { ProviderSettingsBoard } from "@/modules/provider/screens/spaces/settings-board";
import { ProviderAppShell } from "@/modules/provider/ui/provider-app-shell";
import { ProviderReadState } from "@/modules/provider/ui/provider-read-state";
import { loadNotificationCenter } from "@/modules/shared/lib/notifications/repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

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
  const title = locale === "ar" ? "التفضيلات" : "Préférences";
  const lead = locale === "ar"
    ? "عدّلوا طرق التدخل ووتيرة التنبيهات المرتبطة بمؤسستكم النشطة."
    : "Ajustez vos modalités d’intervention et le rythme de vos alertes pour l’organisation active.";
  const contextState = providerContextReadState(space, query.organizationId);
  if (contextState) {
    return (
      <ProviderAppShell locale={locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="settings" title={title} lead={lead} kicker={locale === "ar" ? "فضاء المقاول من الباطن" : "Espace prestataire"}>
        <ProviderReadState locale={locale} state={contextState} retryHref={`/${locale}/sous-traitant/parametres${space.selectedQuery}`} reason={space.readError ?? undefined} />
      </ProviderAppShell>
    );
  }
  const organizationId = space.selectedOrganizationId ?? undefined;
  const [dash, notif] = await Promise.all([loadProviderDashboard(organizationId), loadNotificationCenter(locale, organizationId)]);
  if (dash.status === "error" && dash.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/parametres` }));
  const capacityLoaded = dash.status === "success";
  const notificationsLoaded = notif.status === "success";
  if (!capacityLoaded && !notificationsLoaded) {
    return (
      <ProviderAppShell locale={locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="settings" title={title} lead={lead} kicker={locale === "ar" ? "فضاء المقاول من الباطن" : "Espace prestataire"}>
        <ProviderReadState
          locale={locale}
          state="unavailable"
          retryHref={`/${locale}/sous-traitant/parametres${space.selectedQuery}`}
          unavailableMessage={locale === "ar" ? "تعذر تحميل التفضيلات. أعيدوا المحاولة." : "Impossible de charger les préférences. Réessayez."}
          reason={dash.status === "error" ? dash.reason : notif.status === "error" ? notif.reason : undefined}
        />
      </ProviderAppShell>
    );
  }
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
      <ProviderSettingsBoard
        locale={locale}
        query={space.selectedQuery}
        dashboard={capacityLoaded ? dash.dashboard : null}
        notifications={notificationsLoaded ? notif.dashboard : null}
        capacityUnavailable={!capacityLoaded}
        notificationsUnavailable={!notificationsLoaded}
      />
    </ProviderAppShell>
  );
}

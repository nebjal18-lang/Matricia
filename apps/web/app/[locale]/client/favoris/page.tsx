import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { resolveClientSpace } from "@/modules/client/data/spaces/context";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { FavoritesPanel } from "@/modules/client/screens/favoris/favorites-panel";
import { getFavoriteMessages } from "@/modules/client/screens/favoris/messages";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { loadClientFavorites, loadFavoriteProviderOptions } from "@/modules/provider/data/reputation/repository";

export default async function FavoritesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveClientSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/client/favoris` }));
  const messages = getFavoriteMessages(locale);
  const result = await loadClientFavorites(space.selectedOrganizationId);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/client/favoris` }));
  const optionsResult = result.status === "success" && result.dashboard.canManage
    ? await loadFavoriteProviderOptions(space.selectedOrganizationId)
    : null;
  const providerOptions = optionsResult?.status === "success" ? optionsResult.options : [];
  return (
    <ClientAppShell
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail} organizationName={space.organizationName}
      active="favorites"
      title={messages.title}
      lead={messages.description}
      kicker={spaceCopy(locale).kicker}
    >
      <main className="client-page">
        {result.status === "error" ? (
          <Alert variant={result.reason === "NO_ORGANIZATION" || result.reason === "ORGANIZATION_SELECTION_REQUIRED" ? "default" : "destructive"}>
            <AlertTitle>{result.reason === "NO_ORGANIZATION" || result.reason === "ORGANIZATION_SELECTION_REQUIRED" ? messages.noOrg : messages.loadError}</AlertTitle>
            <AlertDescription>{result.reason}</AlertDescription>
          </Alert>
        ) : (
          <FavoritesPanel dashboard={result.dashboard} providerOptions={providerOptions} locale={locale} m={messages} />
        )}
      </main>
    </ClientAppShell>
  );
}

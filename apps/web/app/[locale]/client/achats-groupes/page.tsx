import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { resolveClientSpace } from "@/modules/client/data/spaces/context";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { getVolumeMessages } from "@/modules/client/screens/achats-groupes/messages";
import { VolumePanel } from "@/modules/client/screens/achats-groupes/volume-panel";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { loadVolumeProcurement } from "@/modules/shared/lib/volume-procurement/repository";

export default async function VolumePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveClientSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/client/achats-groupes` }));
  const messages = getVolumeMessages(locale);
  const result = await loadVolumeProcurement(space.selectedOrganizationId);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/client/achats-groupes` }));
  return (
    <ClientAppShell
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail} organizationName={space.organizationName}
      active="finance"
      title={messages.title}
      lead={messages.description}
      kicker={spaceCopy(locale).kicker}
    >
      <main className="client-page">
        {result.status === "error" ? (
          <Alert variant={result.reason === "NO_CLIENT_ORGANIZATION" || result.reason === "ORGANIZATION_SELECTION_REQUIRED" ? "default" : "destructive"}>
            <AlertTitle>{result.reason === "NO_CLIENT_ORGANIZATION" || result.reason === "ORGANIZATION_SELECTION_REQUIRED" ? messages.noOrg : messages.loadError}</AlertTitle>
            <AlertDescription>{result.reason}</AlertDescription>
          </Alert>
        ) : (
          <VolumePanel dashboard={result.dashboard} locale={locale} m={messages} keys={[crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]} />
        )}
      </main>
    </ClientAppShell>
  );
}

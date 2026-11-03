import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { resolveProviderSpace } from "@/modules/provider/data/spaces/context";
import { providerCopy } from "@/modules/provider/data/spaces/copy";
import { loadProviderReputation } from "@/modules/provider/data/reputation/repository";
import { ReputationBoard } from "@/modules/provider/screens/spaces/boards";
import { getReputationMessages } from "@/modules/provider/screens/reputation/messages";
import { ReputationView } from "@/modules/provider/screens/reputation/reputation-view";
import { ProviderAppShell } from "@/modules/provider/ui/provider-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function ProviderReputationPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveProviderSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/reputation` }));
  const m = getReputationMessages(locale);
  const c = providerCopy(locale);
  const result = await loadProviderReputation(query.organizationId);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/reputation` }));
  return (
    <ProviderAppShell locale={locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="reputation" title={c.repTitle} lead={c.repLead} kicker={c.kicker}>
      <ReputationBoard locale={locale} query={space.selectedQuery} dashboard={result.status === "success" ? result.dashboard : null} />
      <details className="client-ops">
        <summary>{c.opsRep}</summary>
        {result.status === "error" ? (
          <Alert variant={result.reason === "NO_ORGANIZATION" ? "default" : "destructive"}><AlertTitle>{result.reason === "NO_ORGANIZATION" ? m.noOrg : m.loadError}</AlertTitle><AlertDescription>{result.reason}</AlertDescription></Alert>
        ) : (
          <ReputationView dashboard={result.dashboard} locale={locale} m={m} />
        )}
      </details>
    </ProviderAppShell>
  );
}

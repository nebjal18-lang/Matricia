import { ProviderListPagination } from "@/modules/provider/ui/list-pagination";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { resolveProviderSpace } from "@/modules/provider/data/spaces/context";
import { providerCopy } from "@/modules/provider/data/spaces/copy";
import { loadProviderAmendments } from "@/modules/provider/data/missions/amendments";
import { loadProviderMissions } from "@/modules/provider/data/missions/repository";
import { filterListRows, missionRowsFromDashboard, providerSearchQuery } from "@/modules/provider/data/spaces/list-rows";
import { ProviderMissionsBoard } from "@/modules/provider/screens/spaces/boards";
import { ProviderAmendmentPanel } from "@/modules/provider/screens/missions/amendment-panel";
import { getProviderMissionMessages } from "@/modules/provider/screens/missions/messages";
import { MissionsPanel } from "@/modules/provider/screens/missions/missions-panel";
import { ProviderActions, ProviderAppShell } from "@/modules/provider/ui/provider-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function ProviderMissionsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string; q?: string; page?:string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveProviderSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/missions` }));
  const messages = getProviderMissionMessages(locale);
  const c = providerCopy(locale);
  const [result, amendments] = await Promise.all([loadProviderMissions(locale, query.organizationId,undefined,/^\d{1,6}$/.test(query.page??"")?Number(query.page):1), loadProviderAmendments(query.organizationId)]);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/missions` }));
  const boardQuery = providerSearchQuery(space.selectedQuery, { q: query.q });
  return (
    <ProviderAppShell locale={locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="missions" title={c.misTitle} lead={c.misLead} kicker={c.kicker} actions={<ProviderActions href="#missions-operation" label={c.openMission} />}>
      {result.status==="success"?<ProviderListPagination locale={locale} path={`/${locale}/sous-traitant/missions`} query={boardQuery} page={result.dashboard.listPage??1} hasMore={Boolean(result.dashboard.hasMoreMissions)}/>:null}
      <ProviderMissionsBoard locale={locale} query={boardQuery} rows={result.status === "success" ? filterListRows(missionRowsFromDashboard(result.dashboard, locale, space.selectedQuery), query.q ?? "") : []} />
      <details id="missions-operation" className="client-ops">
        <summary>{c.opsMissions}</summary>
        {result.status === "error" ? (
          <Alert variant={result.reason === "NO_PROVIDER_ORGANIZATION" ? "default" : "destructive"}><AlertTitle>{result.reason === "NO_PROVIDER_ORGANIZATION" ? messages.noProvider : messages.loadError}</AlertTitle><AlertDescription>{result.reason}</AlertDescription></Alert>
        ) : (
          <>
            <MissionsPanel dashboard={result.dashboard} locale={locale} messages={messages} />
            {amendments.status === "success" ? <ProviderAmendmentPanel d={amendments.value} locale={locale} /> : null}
          </>
        )}
      </details>
    </ProviderAppShell>
  );
}

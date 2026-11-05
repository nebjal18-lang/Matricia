import { ProviderListPagination } from "@/modules/provider/ui/list-pagination";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { resolveProviderSpace } from "@/modules/provider/data/spaces/context";
import { providerContextReadState } from "@/modules/provider/data/spaces/organization-context";
import { providerCopy } from "@/modules/provider/data/spaces/copy";
import { loadProviderAmendments } from "@/modules/provider/data/missions/amendments";
import { loadProviderMissions } from "@/modules/provider/data/missions/repository";
import { filterListRows, missionRowsFromDashboard, providerSearchQuery } from "@/modules/provider/data/spaces/list-rows";
import { ProviderMissionsBoard } from "@/modules/provider/screens/spaces/boards";
import { ProviderAmendmentPanel } from "@/modules/provider/screens/missions/amendment-panel";
import { getProviderMissionMessages } from "@/modules/provider/screens/missions/messages";
import { MissionsPanel } from "@/modules/provider/screens/missions/missions-panel";
import { ProviderActions, ProviderAppShell } from "@/modules/provider/ui/provider-app-shell";
import { ProviderReadState } from "@/modules/provider/ui/provider-read-state";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function ProviderMissionsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string; q?: string; page?:string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveProviderSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/missions` }));
  const messages = getProviderMissionMessages(locale);
  const c = providerCopy(locale);
  const contextState = providerContextReadState(space, query.organizationId);
  const organizationId = space.selectedOrganizationId ?? query.organizationId;
  const [result, amendments] = contextState
    ? [null, null] as const
    : await Promise.all([
      loadProviderMissions(locale, organizationId, undefined, /^\d{1,6}$/.test(query.page ?? "") ? Number(query.page) : 1, query.q ?? ""),
      loadProviderAmendments(organizationId),
    ]).then(([missions, amendmentList]) => [missions, amendmentList] as const);
  if (result?.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/missions` }));
  const boardQuery = providerSearchQuery(space.selectedQuery, { q: query.q });
  const failureReason = contextState ?? (result?.status === "error" ? result.reason : null);
  const failureState = failureReason === "CONTEXT_REQUIRED" || failureReason === "choose-organization"
    ? "choose-organization" as const
    : failureReason === "NO_PROVIDER_ORGANIZATION" || failureReason === "no-organization"
      ? "no-organization" as const
      : failureReason === "FORBIDDEN" || failureReason === "forbidden"
        ? "forbidden" as const
        : failureReason
          ? "unavailable" as const
          : null;
  return (
    <ProviderAppShell locale={locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="missions" title={c.misTitle} lead={c.misLead} languagePath={`/${locale}/sous-traitant/missions?${new URLSearchParams({...Object.fromEntries(Object.entries(query).filter((entry):entry is [string,string]=>typeof entry[1]==="string"))})}`} kicker={c.kicker} actions={<ProviderActions href="#missions-operation" label={c.openMission} />}>
      {failureState ? <main className="client-page"><ProviderReadState locale={locale} state={failureState} retryHref={`/${locale}/sous-traitant/missions${space.selectedQuery}`} reason={typeof failureReason === "string" ? failureReason : undefined} /></main> : null}
      {result?.status==="success"?<ProviderListPagination locale={locale} path={`/${locale}/sous-traitant/missions`} query={boardQuery} page={result.dashboard.listPage??1} hasMore={Boolean(result.dashboard.hasMoreMissions)}/>:null}
      {result?.status==="success"?<ProviderMissionsBoard locale={locale} query={boardQuery} rows={filterListRows(missionRowsFromDashboard(result.dashboard, locale, space.selectedQuery), query.q ?? "")} />:null}
      {!failureState ? <details id="missions-operation" className="client-ops">
        <summary>{c.opsMissions}</summary>
        {result?.status === "error" ? (
          <Alert variant={result.reason === "NO_PROVIDER_ORGANIZATION" ? "default" : "destructive"}><AlertTitle>{result.reason === "NO_PROVIDER_ORGANIZATION" ? messages.noProvider : messages.loadError}</AlertTitle><AlertDescription>{result.reason==="NO_PROVIDER_ORGANIZATION"?messages.noProvider:locale==="ar"?"لم يتم تأكيد عدم وجود مهام. تحقق من المؤسسة والصلاحيات ثم أعد المحاولة.":"L’absence de missions n’est pas confirmée. Vérifiez l’organisation et vos droits, puis réessayez."}<a className="ms-2 underline" href={`/${locale}/sous-traitant/missions${space.selectedQuery}`}>{locale==="ar"?"إعادة المحاولة":"Réessayer"}</a></AlertDescription></Alert>
        ) : result?.status === "success" ? (
          <>
            <MissionsPanel dashboard={result.dashboard} locale={locale} messages={messages} />
            {amendments?.status === "success" ? <ProviderAmendmentPanel d={amendments.value} locale={locale} /> : <p role="alert">{locale==="ar"?"تعذر تحميل الملاحق؛ لم يتم تأكيد غيابها.":"Le chargement des avenants est indisponible ; leur absence n’est pas confirmée."}</p>}
          </>
        ) : null}
      </details> : null}
    </ProviderAppShell>
  );
}

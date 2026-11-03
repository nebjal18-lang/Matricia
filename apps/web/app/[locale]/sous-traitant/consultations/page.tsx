import {ProviderQuotePagination} from "@/modules/provider/screens/devis/pagination";
import { providerContextReadState } from "@/modules/provider/data/spaces/organization-context";
import { ProviderReadState } from "@/modules/provider/ui/provider-read-state";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { loadProviderQuotes } from "@/modules/provider/data/quotes/repository";
import { resolveProviderSpace } from "@/modules/provider/data/spaces/context";
import { providerCopy } from "@/modules/provider/data/spaces/copy";
import { consultationRowsFromInvitations, providerSearchQuery } from "@/modules/provider/data/spaces/list-rows";
import { ConsultationsBoard } from "@/modules/provider/screens/spaces/boards";
import { ProviderActions, ProviderAppShell } from "@/modules/provider/ui/provider-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function ProviderConsultationsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string; q?: string; tab?: string; page?:string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveProviderSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/consultations` }));
  const contextState = providerContextReadState(space, query.organizationId);
  const result = contextState ? { status: "error" as const, reason: "NO_ORGANIZATION" as const } : await loadProviderQuotes(space.selectedOrganizationId ?? undefined,{page:Number(query.page)||1,query:query.q,mode:"consultations",tab:query.tab});
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/consultations` }));
  const c = providerCopy(locale);
  const boardQuery = providerSearchQuery(space.selectedQuery, { q: query.q, tab: query.tab, page:query.page });
  const rows = result.status === "success"
    ? consultationRowsFromInvitations(result.dashboard.invitations, locale, space.selectedQuery)
    : [];
  return (
    <ProviderAppShell languagePath={`/${locale}/sous-traitant/consultations${boardQuery}`} locale={locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="consult" title={c.consultTitle} lead={c.consultLead} kicker={c.kicker} actions={<ProviderActions href={`/${locale}/sous-traitant/services${space.selectedQuery}`} label={c.seeCriteria} />}>
      {result.status === "success" ? <ConsultationsBoard locale={locale} query={boardQuery} rows={rows} tab={query.tab} /> : <ProviderReadState locale={locale} state={contextState ?? (result.status === "error" && result.reason === "NO_ORGANIZATION" ? "forbidden" : "unavailable")} retryHref={`/${locale}/sous-traitant/consultations${space.selectedQuery}`} unavailableMessage={locale === "ar" ? "تعذر تحميل الاستشارات." : "Impossible de charger les consultations."} reason={space.readError ?? (result.status === "error" ? result.reason : undefined)} />}
      {result.status==="success"?<ProviderQuotePagination locale={locale} path="consultations" query={boardQuery} pagination={result.dashboard.pagination}/>:null}
    </ProviderAppShell>
  );
}

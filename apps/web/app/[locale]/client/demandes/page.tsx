import Link from "next/link";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { createServerClientRfqRepository } from "@/modules/client/data/rfq/server-repository";
import { resolveClientSpace } from "@/modules/client/data/spaces/context";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { getClientRfqMessages } from "@/modules/client/screens/demandes/messages";
import { RequestsBoard, SpaceActions, SpaceFilters } from "@/modules/client/screens/spaces/boards";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function RequestsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string;q?:string;statut?:string;page?:string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveClientSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/client/demandes` }));
  const page = Math.max(1, Math.min(100000, Number.parseInt(query.page ?? '1',10)||1));
  const [repository, client] = await Promise.all([createServerClientRfqRepository({ organizationId: space.selectedOrganizationId, query: query.q, status: query.statut, page }),getSupabaseServerClient()]);
  const [result,totalResult] = await Promise.all([repository.list(),client.rpc("count_client_request_results",{p_organization_id:space.selectedOrganizationId,p_query:query.q??"",p_status:query.statut??""})]);
  const total = typeof totalResult.data === "number" && Number.isSafeInteger(totalResult.data) && totalResult.data>=0 ? String(totalResult.data) : typeof totalResult.data === "string" && /^\d+$/u.test(totalResult.data) ? totalResult.data : null;
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/client/demandes` }));
  const messages = getClientRfqMessages(locale);
  const c = spaceCopy(locale);
  const selected = space.selectedOrganizationId;
  const rows = result.status === "success"
    ? result.value.requests.slice(0,20).filter((request) => !selected || request.organizationId === selected).map((request) => ({
      id: request.id,
      title: request.description,
      status: messages.statuses[request.status],
      last: new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium", timeZone: "Africa/Casablanca" }).format(new Date(request.createdAt)),
      next: request.quoteCount > 0 ? c.compareCta : c.open,
      href: `/${locale}/client/demandes/${request.id}${space.selectedQuery}`,
      tone: (request.quoteCount > 0 ? "mint" : request.status === "DRAFT" ? "violet" : "sky") as "violet" | "sky" | "mint" | "peach",
    }))
    : [];
  const compareHref = rows[0] ? rows[0].href : `/${locale}/client/demandes${space.selectedQuery}`;
  return (
    <ClientAppShell languagePath={`/${locale}/client/demandes?${new URLSearchParams({organizationId:space.selectedOrganizationId,q:query.q??"",statut:query.statut??"",page:String(page)})}`} locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} organizationName={space.organizationName} active="requests" title={c.reqTitle} lead={c.reqLead} kicker={c.kicker} actions={<><SpaceActions href={`/${locale}/besoin${space.selectedQuery}`} label={c.newNeed} /><SpaceActions href={`/${locale}/client/demandes/recurrence${space.selectedQuery}`} label={c.cloneRequest} variant="soft" /><SpaceFilters href="#filtres" label={c.filters} /></>}>
      {result.status==='error'?<p role="alert" className="client-card">{result.reason==='FORBIDDEN'?(locale==='fr'?'Votre rôle ne permet pas de consulter ces demandes.':'دوركم لا يسمح بعرض هذه الطلبات.'):(locale==='fr'?'Les demandes sont momentanément indisponibles. Réessayez.':'الطلبات غير متاحة مؤقتاً. حاولوا مجدداً.')}</p>:<>
      {totalResult.error || total === null ? <p role="alert">{locale === "fr" ? "Le total est momentanément indisponible. Les résultats chargés restent consultables." : "العدد الإجمالي غير متاح مؤقتاً. يمكن عرض النتائج المحملة."}</p> : <p>{total} {locale === "fr" ? "demande(s) correspondant(s)" : "طلب مطابق"}</p>}
      <RequestsBoard searchQuery={query.q} statusFilter={query.statut} locale={locale} query={space.selectedQuery} compareHref={compareHref} rows={rows} organizationName={space.organizationName} />
      <nav className="flex gap-4" aria-label={locale==='fr'?'Pages des demandes':'صفحات الطلبات'}>{page>1?<Link href={`?${new URLSearchParams({organizationId:space.selectedOrganizationId,q:query.q??'',statut:query.statut??'',page:String(page-1)})}`}>{locale==='fr'?'Précédent':'السابق'}</Link>:null}{result.value.requests.length>20?<Link href={`?${new URLSearchParams({organizationId:space.selectedOrganizationId,q:query.q??'',statut:query.statut??'',page:String(page+1)})}`}>{locale==='fr'?'Suivant':'التالي'}</Link>:null}</nav></>}
    </ClientAppShell>
  );
}

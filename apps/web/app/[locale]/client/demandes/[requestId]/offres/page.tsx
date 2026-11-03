import {SelectedQuoteContract}from"@/modules/client/screens/missions/selected-quote-contract";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { ComparisonPanel } from "@/modules/client/screens/demandes/comparison-panel";
import { getClientRfqMessages } from "@/modules/client/screens/demandes/messages";
import { createServerClientRfqRepository } from "@/modules/client/data/rfq/server-repository";
import { uuidSchema } from "@/modules/client/data/rfq/model";
import { loadComparisonOfferFacts } from "@/modules/client/data/rfq/comparison-facts";
import { resolveClientSpace } from "@/modules/client/data/spaces/context";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { RequestsBoard } from "@/modules/client/screens/spaces/boards";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function CompareOffersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; requestId: string }>;
  searchParams: Promise<{ rfq?: string; organizationId?: string;identityQuote?:string;identityPage?:string }>;
}) {
  const [{ locale, requestId }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale) || !uuidSchema.safeParse(requestId).success) notFound();
  const space = await resolveClientSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/client/demandes/${requestId}/offres` }));
  const messages = getClientRfqMessages(locale);
  const c = spaceCopy(locale);
  const repository = await createServerClientRfqRepository();
  const detail = await repository.detail(requestId);
  if (detail.status === "error" && detail.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/client/demandes/${requestId}/offres` }));
  if(detail.status==="error")return<ClientAppShell locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} organizationName={space.organizationName} active="requests" title={c.comparePageTitle}><p role="alert">{detail.reason==="FORBIDDEN"?(locale==="fr"?"Votre rôle ne permet pas de consulter ces offres.":"دوركم لا يسمح بعرض هذه العروض."):(locale==="fr"?"Les offres sont momentanément indisponibles. Réessayez.":"العروض غير متاحة مؤقتاً. حاولوا مجدداً.")}</p><Link href={`/${locale}/client/demandes/${requestId}/offres${space.selectedQuery}`}>{locale==="fr"?"Réessayer":"إعادة المحاولة"}</Link></ClientAppShell>;
  if (!detail.value) notFound();

  if(detail.value.organizationId!==space.selectedOrganizationId){if(query.organizationId)notFound();redirect(`/${locale}/client/demandes/${requestId}/offres?${new URLSearchParams({organizationId:detail.value.organizationId,...(query.rfq?{rfq:query.rfq}:{})})}`);}
  const rfqId = query.rfq ?? detail.value.rfqId;
  if (query.rfq && detail.value.rfqId && query.rfq !== detail.value.rfqId) notFound();
  if (!query.rfq && detail.value.rfqId) {
    const extra = space.selectedOrganizationId ? `&organizationId=${space.selectedOrganizationId}` : "";
    redirect(`/${locale}/client/demandes/${requestId}/offres?rfq=${detail.value.rfqId}${extra}`);
  }
  if (!rfqId || !uuidSchema.safeParse(rfqId).success) {
    return (
      <ClientAppShell languagePath={`/${locale}/client/demandes/${requestId}/offres?${new URLSearchParams({organizationId:space.selectedOrganizationId,...(query.rfq?{rfq:query.rfq}:{})})}`} locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} organizationName={space.organizationName} active="requests" title={c.comparePageTitle} lead={c.comparePageLead} kicker={c.kicker}>
        <RequestsBoard locale={locale} query={space.selectedQuery} compareHref={`/${locale}/client/demandes/${requestId}${space.selectedQuery}`} rows={[]} organizationName={space.organizationName} />
      </ClientAppShell>
    );
  }

  const comparison = await repository.comparison(rfqId);
  if (comparison.status === "error" && comparison.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/client/demandes/${requestId}/offres` }));
  if (comparison.status === "error") {
    return (
      <ClientAppShell languagePath={`/${locale}/client/demandes/${requestId}/offres?${new URLSearchParams({organizationId:space.selectedOrganizationId,...(query.rfq?{rfq:query.rfq}:{})})}`} locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} organizationName={space.organizationName} active="requests" title={c.comparePageTitle} lead={c.comparePageLead} kicker={c.kicker}>
        <main className="client-page"><p role="alert" className="client-card">{locale === "ar" ? "تعذر تحميل المقارنة." : "Impossible de charger la comparaison."}</p></main>
      </ClientAppShell>
    );
  }
  const facts = comparison.value
    ? await loadComparisonOfferFacts(comparison.value.rows.map((row) => row.quoteVersionId), locale)
    : new Map();
  const offerFacts = Object.fromEntries(facts);

  return (
    <ClientAppShell languagePath={`/${locale}/client/demandes/${requestId}/offres?${new URLSearchParams({organizationId:space.selectedOrganizationId,...(query.rfq?{rfq:query.rfq}:{})})}`} locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} organizationName={space.organizationName} active="requests" title={c.comparePageTitle} lead={c.comparePageLead} kicker={c.kicker}>
      <main className="client-page">
        <ComparisonPanel
          locale={locale}
          requestId={requestId}
          rfqId={rfqId}
          messages={messages}
          canManage={detail.value.canManage}
          initialComparison={comparison.value}
          nowIso={new Date().toISOString()}
          compareKey={randomUUID()}
          selectKeys={Array.from({ length: 100 }, () => randomUUID())}
          selectedQuery={space.selectedQuery}
          requestTitle={detail.value.description}
          requestHref={`/${locale}/client/demandes/${requestId}${space.selectedQuery}`}
          organizationName={space.organizationName}
          offerFacts={offerFacts}
          assistanceHref={`/${locale}/client/diagnostics/assistance${space.selectedQuery}`}
        />
        {["PROVIDER_SELECTED","CONTRACT_PENDING","CONTRACTED"].includes(detail.value.status)?<SelectedQuoteContract navigationQuery={query} locale={locale} organizationId={space.selectedOrganizationId} requestId={requestId}/>:null}
      </main>
    </ClientAppShell>
  );
}

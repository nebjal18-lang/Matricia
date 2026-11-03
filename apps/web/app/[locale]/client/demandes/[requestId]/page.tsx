import {SelectedQuoteContract}from"@/modules/client/screens/missions/selected-quote-contract";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Badge } from "@/modules/shared/ui/badge";
import { resolveClientSpace } from "@/modules/client/data/spaces/context";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { formatMinorExact } from "@/modules/client/data/rfq/model";
import { createServerClientRfqRepository } from "@/modules/client/data/rfq/server-repository";
import { getClientRfqMessages } from "@/modules/client/screens/demandes/messages";
import { WorkflowActions } from "@/modules/client/screens/demandes/workflow-actions";
import { loadQuoteInformation } from "@/modules/client/screens/demandes/quote-information";
import { QuoteInformationForm } from "@/modules/client/screens/demandes/quote-information-form";
import { MatchingHistory } from "@/modules/client/screens/demandes/request-id/matching-history";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function RequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; requestId: string }>;
  searchParams: Promise<{ organizationId?: string;identityQuote?:string;identityPage?:string }>;
}) {
  const [{ locale, requestId }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveClientSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/client/demandes/${requestId}` }));
  const result = await (await createServerClientRfqRepository()).detail(requestId);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/client/demandes/${requestId}` }));
  if (result.status === "error") return <ClientAppShell languagePath={`/${locale}/client/demandes/${requestId}${space.selectedQuery}`} locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} organizationName={space.organizationName} active="requests" title={locale === "fr" ? "Ma demande" : "طلبي"}><p role="alert" className="client-card">{locale === "fr" ? "La demande est momentanément indisponible ou vos droits ne permettent pas sa consultation. Réessayez." : "الطلب غير متاح مؤقتاً أو لا تسمح صلاحياتكم بعرضه. حاولوا مجدداً."}</p><Link href={`/${locale}/client/demandes/${requestId}${space.selectedQuery}`}>{locale === "fr" ? "Réessayer" : "إعادة المحاولة"}</Link></ClientAppShell>;
  if (!result.value) notFound();
  const q = result.value;
  if (q.organizationId !== space.selectedOrganizationId) {
    if (query.organizationId) notFound();
    redirect(`/${locale}/client/demandes/${requestId}?organizationId=${q.organizationId}`);
  }
  const proposalsResult = await (await getSupabaseServerClient()).rpc("list_my_admin_consultation_proposals_v1", { p_request_id: requestId });
  const proposals = z.object({ proposals: z.array(z.object({ id: z.string().uuid(), note: z.string(), context: z.string(), due_at: z.string().nullable(), provider_ids: z.array(z.string().uuid()), status: z.enum(["DRAFT", "PENDING_CLIENT_DECISION", "RFQ_OPENED"]) }).passthrough()) }).passthrough().safeParse(proposalsResult.data);
  const messages = getClientRfqMessages(locale);
  const editable = q.status === "DRAFT" || q.status === "INFORMATION_REQUIRED";
  const information = q.canManage && editable ? await loadQuoteInformation(q.id, locale) : null;
  const c = spaceCopy(locale);
  const compareHref = q.rfqId
    ? `/${locale}/client/demandes/${q.id}/offres?rfq=${q.rfqId}${space.selectedOrganizationId ? `&organizationId=${space.selectedOrganizationId}` : ""}`
    : `/${locale}/client/demandes/${q.id}/offres${space.selectedQuery}`;

  return (
    <ClientAppShell languagePath={`/${locale}/client/demandes/${requestId}${space.selectedQuery}`} locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} organizationName={space.organizationName} active="requests" title={messages.detailTitle} lead={q.description} kicker={c.kicker}>
      <main className="client-page">
        <article className="client-card">
          <header className="client-priority-head">
            <h2>{messages.detailTitle}</h2>
            <Badge>{messages.statuses[q.status]}</Badge>
          </header>
          <p className="whitespace-pre-wrap leading-7">{q.description}</p>
          <dl className="client-fact-grid">
            <div><small>{messages.budget}</small><span dir="ltr">{q.budgetMinor === null ? messages.unavailable : formatMinorExact(q.budgetMinor, q.currency, locale)}</span></div>
            <div><small>{messages.deadline}</small><span>{q.rfqDeadline ?? messages.unavailable}</span></div>
            <div><small>{messages.quotes}</small><span>{q.quoteCount}</span></div>
          </dl>
          {q.rfqId ? <Link href={compareHref} className="client-cta mt-4 inline-flex">{messages.comparison}</Link> : null}
        </article>
        <section className="client-card"><h2>{locale === "fr" ? "Propositions de consultation transmises par Matricia" : "مقترحات الاستشارة المرسلة من ماتريسيا"}</h2>{proposalsResult.error || !proposals.success ? <p role="status">{locale === "fr" ? "Pour consulter les propositions, vérifiez vos droits et votre authentification renforcée." : "لعرض المقترحات، تحققوا من صلاحياتكم والمصادقة المعززة."}</p> : proposals.data.proposals.filter(proposal => proposal.status !== "DRAFT").map(proposal => <article key={proposal.id} className="mt-3 border-t py-3"><p className="whitespace-pre-wrap">{proposal.note}</p><p className="whitespace-pre-wrap">{proposal.context}</p><p>{locale === "fr" ? "Candidats proposés" : "المرشحون المقترحون"} : {proposal.provider_ids.length}</p>{proposal.due_at ? <p>{locale === "fr" ? "Date proposée" : "التاريخ المقترح"} : {new Intl.DateTimeFormat(locale === "fr" ? "fr-MA" : "ar-MA", { dateStyle: "medium", timeZone: "Africa/Casablanca" }).format(new Date(proposal.due_at))}</p> : null}<p>{proposal.status === "RFQ_OPENED" ? locale === "fr" ? "Consultation ouverte" : "الاستشارة مفتوحة" : locale === "fr" ? "En attente de votre décision" : "بانتظار قراركم"}</p>{q.canManage && proposal.status === "PENDING_CLIENT_DECISION" ? <a href="#workflow" className="underline">{locale === "fr" ? "Examiner et préparer l’ouverture de ma consultation" : "مراجعة وإعداد فتح الاستشارة"}</a> : null}</article>)}</section>
        {["PROVIDER_SELECTED","CONTRACT_PENDING","CONTRACTED"].includes(q.status)?<SelectedQuoteContract navigationQuery={query} locale={locale} organizationId={space.selectedOrganizationId} requestId={requestId}/>:null}
        <MatchingHistory locale={locale} runs={q.matchingHistory} />
        {q.canManage && editable ? (
          <section className="client-card" aria-labelledby="complete-information">
            <h2 id="complete-information">{messages.completeTitle}</h2>
            {information ? (
              <QuoteInformationForm locale={locale} information={information} messages={messages} idempotencyKey={randomUUID()} />
            ) : (
              <p role="status">{messages.completeUnavailable}</p>
            )}
          </section>
        ) : null}
        {q.canManage ? (
          <section className="client-card" aria-labelledby="workflow">
            <h2 id="workflow">{messages.workflow}</h2>
            <WorkflowActions organizationId={q.organizationId} locale={locale} requestId={q.id} rowVersion={information?.rowVersion ?? q.rowVersion} status={q.status} canMarkReady={Boolean(information?.complete && information.regionCode)} matchingRunId={q.matchingRunId} messages={messages} keys={{ ready: randomUUID(), match: randomUUID(), open: randomUUID() }} />
          </section>
        ) : (
          <p role="status" className="client-card">{messages.readOnly}</p>
        )}
      </main>
    </ClientAppShell>
  );
}

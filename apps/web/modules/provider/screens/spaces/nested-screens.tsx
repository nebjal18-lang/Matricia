import { providerContextReadState, type ProviderReadState as ProviderContextState } from "@/modules/provider/data/spaces/organization-context";
import { ProviderReadState } from "@/modules/provider/ui/provider-read-state";
import { buildProviderNav } from "@/modules/provider/ui/provider-nav";
import { loadProviderInvoiceDossier } from "@/modules/provider/data/billing/dossier";
import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { loadProviderBilling } from "@/modules/provider/data/billing/repository";
import { loadProviderMissions } from "@/modules/provider/data/missions/repository";
import { loadConsultationSharedDocuments, loadProviderQuotes, loadProviderQuoteHistory } from "@/modules/provider/data/quotes/repository";
import { loadProviderDashboard } from "@/modules/provider/data/qualification/repository";
import { mergeConsultationDocuments, type ProviderQuoteDashboard } from "@/modules/provider/data/quotes/model";
import { resolveProviderSpace } from "@/modules/provider/data/spaces/context";
import { providerCopy } from "@/modules/provider/data/spaces/copy";
import { resolveProviderNestedView } from "@/modules/provider/data/spaces/nested-views";
import { workbenchCopy } from "@/modules/provider/data/spaces/workbench-copy";
import { findProviderObjectThread } from "@/modules/provider/data/messages/direct-thread";
import { loadProviderInbox } from "@/modules/provider/data/messages/inbox";
import { parseMessageCursor } from "@/app/[locale]/messagerie/history-navigation";
import { ProviderInboxBoard } from "@/modules/provider/screens/messages/inbox-board";
import { ProviderDocumentsBoard } from "@/modules/provider/screens/spaces/boards";
import { createInternalMessagingRepository } from "@/modules/shared/lib/internal-messaging/server-repository";
import { loadNotificationCenter } from "@/modules/shared/lib/notifications/repository";
import { getMessagingMessages } from "@/app/[locale]/messagerie/messages";
import { providerFallbackPath } from "@/modules/shared/lib/connected-space/nested-fallbacks";
import { loadQuotePrefills } from "@/modules/provider/screens/devis/prefill";
import { getProviderQuoteMessages } from "@/modules/provider/screens/devis/messages";
import { QuotePreviewWorkbench } from "@/modules/provider/screens/devis/quote-preview";
import { QuoteSubmitForm } from "@/modules/provider/screens/devis/quote-panel";
import { loadBillingMissionOptions } from "@/modules/provider/screens/facturation/options";
import { getBillingMessages } from "@/modules/provider/screens/facturation/messages";
import { getProviderMissionMessages } from "@/modules/provider/screens/missions/messages";
import {
  CompanySecurityWorkbench,
  ConsultationDetailWorkbench,
  InvoiceSettlementWorkbench,
  MissionDeliveryWorkbench,
  ProviderLiveBillingPanel,
  ProviderLiveMissionsPanel,
  ProviderLiveQuotePanel,
  ProviderOutOfScope,
  QuoteMultilineWorkbench,
  QuoteRevisionWorkbench,
} from "@/modules/provider/screens/spaces/workbenches";
import { ProviderAppShell } from "@/modules/provider/ui/provider-app-shell";
import { isLocale, type Locale } from "@/modules/shared/lib/i18n/locale";
import { getAccountSecurity } from "@/app/[locale]/securite/compte/actions";
import { listMySessions } from "@/app/[locale]/securite/sessions/actions";
import { loadProviderTeam } from "@/modules/provider/data/company/team";
import { getRoleMessages } from "@/app/[locale]/organisation/roles/messages";

const recordId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type Search = Promise<{ organizationId?: string; rfq?: string; q?: string; vue?: string; invitationId?: string; page?: string; before?: string; beforeId?: string }>;

async function spaceOrRedirect(locale: string, organizationId?: string) {
  if (!isLocale(locale)) notFound();
  const space = await resolveProviderSpace({ locale, organizationId });
  if (space.status === "unauthenticated") redirect(`/${locale}/connexion`);
  return space;
}

function ProviderReadFailure({locale,space,active,reason}:{locale:Locale;space:Awaited<ReturnType<typeof spaceOrRedirect>>;active:import("@/modules/provider/ui/provider-app-shell").ProviderNavKey;reason:string}) {
 const contextStates:ProviderContextState[]=["unavailable","forbidden","choose-organization","no-organization"];
 const state:ProviderContextState=contextStates.includes(reason as ProviderContextState)?reason as ProviderContextState:["FORBIDDEN","NO_ORGANIZATION","NO_PROVIDER_ORGANIZATION","NO_BILLING_ORGANIZATION"].includes(reason)?"forbidden":"unavailable";
 const retryHref=buildProviderNav(locale,space.selectedQuery).find(item=>item.key===active)?.href??`/${locale}/tableau-de-bord${space.selectedQuery}`;
 return <ProviderAppShell locale={locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active={active}>
  <main className="client-page"><ProviderReadState locale={locale} state={state} retryHref={retryHref} reason={reason}/></main>
 </ProviderAppShell>;
}

function providerContextBoundary(locale:Locale,space:Awaited<ReturnType<typeof spaceOrRedirect>>,active:import("@/modules/provider/ui/provider-app-shell").ProviderNavKey,requestedOrganizationId?:string){
 const state=providerContextReadState(space,requestedOrganizationId);
 return state?<ProviderReadFailure locale={locale} space={space} active={active} reason={state}/>:null;
}

async function loadQuoteEntry(organizationId:string|undefined,entryId:string){
 const quoted=await loadProviderQuotes(organizationId,{quoteId:entryId});
 // Existing links may identify an accepted invitation before the first quote.
 // Only a successful empty quote lookup permits that independently scoped lookup.
 return quoted.status==="success"&&quoted.dashboard.invitations.length===0?loadProviderQuotes(organizationId,{invitationId:entryId}):quoted;
}

function quoteIdentities(ids: readonly string[]) {
  return Object.fromEntries(ids.map((id) => [id, { decision: randomUUID(), revision: randomUUID(), submit: randomUUID(), correlation: randomUUID() }]));
}

function findInvitation(dashboard: ProviderQuoteDashboard, quoteId: string) {
  return dashboard.invitations.find((item) => item.id === quoteId || item.quote?.id === quoteId || item.rfqId === quoteId) ?? null;
}

export async function ProviderConsultationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; consultationId: string }>;
  searchParams: Search;
}) {
  const [{ locale, consultationId }, query] = await Promise.all([params, searchParams]);
  const space = await spaceOrRedirect(locale, query.organizationId);
  const contextBoundary=providerContextBoundary(locale as Locale,space,"consult",query.organizationId);
  if(contextBoundary)return contextBoundary;
  const w = workbenchCopy(locale as Locale);
  let result = await loadProviderQuotes(space.selectedOrganizationId ?? undefined,{invitationId:consultationId});
  if(result.status==="success"&&result.dashboard.invitations.length===0)result=await loadProviderQuotes(space.selectedOrganizationId??undefined,{rfqId:consultationId});
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(`/${locale}/connexion`);
  if (result.status === "error") return <ProviderReadFailure locale={locale as Locale} space={space} active="consult" reason={result.reason} />;
  const found = result.status === "success" ? findInvitation(result.dashboard, consultationId) : null;
  if(found&&found.id!==consultationId)redirect(`/${locale}/sous-traitant/consultations/${found.id}${space.selectedQuery}`);
  const shared = found ? await loadConsultationSharedDocuments(found.id) : [];
  if(shared===null)return <ProviderReadFailure locale={locale as Locale} space={space} active="consult" reason="QUERY_FAILED"/>;
  const invitation = found
    ? {
        ...found,
        pack: {
          objective: found.pack?.objective ?? null,
          scope: found.pack?.scope ?? [],
          deliverables: found.pack?.deliverables ?? [],
          constraints: found.pack?.constraints ?? [],
          documents: mergeConsultationDocuments(found.pack?.documents ?? [], shared),
        },
      }
    : null;
  if (!invitation) {
    return (
      <ProviderAppShell locale={locale as Locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="consult" title={w.consultDetailTitle} lead={w.outOfScopeLead}>
        <ProviderOutOfScope locale={locale as Locale} query={space.selectedQuery} />
      </ProviderAppShell>
    );
  }
  const m = getProviderQuoteMessages(locale as Locale);
  const prefills = result.status === "success" && invitation?.quote?.currentVersionId
    ? await loadQuotePrefills(result.dashboard.organizationId, [{ invitationId: invitation.id, versionId: invitation.quote.currentVersionId }], locale as Locale)
    : {};
  if(prefills===null)return <ProviderReadFailure locale={locale as Locale} space={space} active="consult" reason="QUERY_FAILED"/>;
  return (
    <ProviderAppShell locale={locale as Locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="consult" title={invitation?.description ?? w.consultDetailTitle} lead={w.consultDetailLead}>
      <ConsultationDetailWorkbench
        locale={locale as Locale}
        query={space.selectedQuery}
        consultationId={consultationId}
        invitation={invitation}
        quotePanel={result.status === "success" && invitation ? <ProviderLiveQuotePanel dashboard={{ ...result.dashboard, invitations: [invitation] }} locale={locale as Locale} m={m} identities={quoteIdentities([invitation.id])} prefills={prefills} /> : null}
      />
    </ProviderAppShell>
  );
}

export async function ProviderQuoteWorkbenchPage({
  params,
  searchParams,
  mode,
}: {
  params: Promise<{ locale: string; quoteId?: string }>;
  searchParams: Search;
  mode: "create" | "revise";
}) {
  const [{ locale, quoteId = "nouveau" }, query] = await Promise.all([params, searchParams]);
  const space = await spaceOrRedirect(locale, query.organizationId);
  const contextBoundary=providerContextBoundary(locale as Locale,space,"quotes",query.organizationId);
  if(contextBoundary)return contextBoundary;
  const w = workbenchCopy(locale as Locale);
  const result = quoteId === "nouveau" ? await loadProviderQuotes(space.selectedOrganizationId ?? undefined,{invitationId:query.invitationId}) : await loadQuoteEntry(space.selectedOrganizationId ?? undefined,quoteId);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(`/${locale}/connexion`);
  if (result.status === "error") return <ProviderReadFailure locale={locale as Locale} space={space} active="quotes" reason={result.reason} />;
  const invitation = result.status === "success" ? findInvitation(result.dashboard, quoteId === "nouveau" ? query.invitationId ?? "" : quoteId) : null;
  if ((quoteId !== "nouveau" || query.invitationId) && !invitation) {
    return (
      <ProviderAppShell locale={locale as Locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="quotes" title={w.outOfScope} lead={w.outOfScopeLead}>
        <ProviderOutOfScope locale={locale as Locale} query={space.selectedQuery} />
      </ProviderAppShell>
    );
  }
  if(!invitation && quoteId==="nouveau")return <ProviderAppShell locale={locale as Locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="quotes" title={w.quoteCreateTitle}><main className="client-page"><section className="client-card"><h2>{locale==="ar"?"اختاروا الاستشارة المرتبطة بالعرض":"Choisissez la consultation à chiffrer"}</h2><p>{locale==="ar"?"يرتبط كل عرض باستشارة مصرح بها. افتحوا جميع الاستشارات للبحث والوصول إلى بقية الصفحات.":"Chaque devis reste lié à une consultation autorisée. Ouvrez toutes les consultations pour rechercher et parcourir les autres pages."}</p>{result.dashboard.invitations.length?<form method="get" action={`/${locale}/sous-traitant/devis/nouveau`} className="grid gap-3"><input type="hidden" name="organizationId" value={space.selectedOrganizationId??""}/><label htmlFor="quote-invitation">{locale==="ar"?"الاستشارة":"Consultation"}</label><select className="min-h-11 rounded border px-3" id="quote-invitation" name="invitationId" required><option value="">{locale==="ar"?"اختاروا استشارة":"Choisir une consultation"}</option>{result.dashboard.invitations.map(item=><option key={item.id} value={item.id}>{item.description??item.id.slice(0,8)}</option>)}</select><button className="client-cta" type="submit">{locale==="ar"?"فتح ملف العرض":"Ouvrir le devis"}</button></form>:<p role="status">{locale==="ar"?"لا توجد استشارة في هذه الصفحة.":"Aucune consultation sur cette page."}</p>}<a className="client-text-link" href={`/${locale}/sous-traitant/consultations${space.selectedQuery}`}>{locale==="ar"?"جميع الاستشارات":"Toutes les consultations"}</a></section></main></ProviderAppShell>;
  const m = getProviderQuoteMessages(locale as Locale);
  const prefills = result.status === "success" && invitation?.quote?.currentVersionId
    ? await loadQuotePrefills(result.dashboard.organizationId, [{ invitationId: invitation.id, versionId: invitation.quote.currentVersionId }], locale as Locale)
    : {};
  if(prefills===null)return <ProviderReadFailure locale={locale as Locale} space={space} active="quotes" reason="QUERY_FAILED"/>;
  const panel = result.status === "success" && invitation
    ? <ProviderLiveQuotePanel dashboard={{ ...result.dashboard, invitations: [invitation] }} locale={locale as Locale} m={m} identities={quoteIdentities([invitation.id])} prefills={prefills} />
    : null;
  const revisions = result.status === "success" && invitation?.quote ? await loadProviderQuoteHistory(result.dashboard.organizationId, invitation.quote.id) : [];
  const revisionSnapshots:Record<string,import("@/modules/provider/screens/devis/prefill").QuotePrefill>={};
  if(revisions===null)return <ProviderReadFailure locale={locale as Locale} space={space} active="quotes" reason="QUERY_FAILED"/>;
  for(let offset=0;offset<revisions.length;offset+=25){const batch=await loadQuotePrefills(result.dashboard.organizationId,revisions.slice(offset,offset+25).map(item=>({invitationId:item.id,versionId:item.id})),locale as Locale);if(batch===null)return <ProviderReadFailure locale={locale as Locale} space={space} active="quotes" reason="QUERY_FAILED"/>;Object.assign(revisionSnapshots,batch);}
  const history=revisions?.map(item=>({...item,snapshot:revisionSnapshots[item.id]}))??null;
  const Workbench = mode === "revise" ? QuoteRevisionWorkbench : QuoteMultilineWorkbench;
  return (
    <ProviderAppShell locale={locale as Locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="quotes" title={mode === "revise" ? w.quoteReviseTitle : w.quoteCreateTitle} lead={mode === "revise" ? w.quoteReviseLead : w.quoteCreateLead}>
      <Workbench history={history} locale={locale as Locale} query={space.selectedQuery} quoteId={quoteId} invitation={invitation} quotePanel={panel} prefill={invitation ? prefills[invitation.id] : undefined} />
    </ProviderAppShell>
  );
}

export async function ProviderQuotePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; quoteId: string }>;
  searchParams: Search;
}) {
  const [{ locale, quoteId }, query] = await Promise.all([params, searchParams]);
  const space = await spaceOrRedirect(locale, query.organizationId);
  const contextBoundary=providerContextBoundary(locale as Locale,space,"quotes",query.organizationId);
  if(contextBoundary)return contextBoundary;
  const w = workbenchCopy(locale as Locale);
  const result = await loadQuoteEntry(space.selectedOrganizationId ?? undefined,quoteId);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(`/${locale}/connexion`);
  if (result.status === "error") return <ProviderReadFailure locale={locale as Locale} space={space} active="quotes" reason={result.reason} />;
  const invitation = result.status === "success" ? findInvitation(result.dashboard, quoteId) : null;
  if (!invitation) {
    return (
      <ProviderAppShell locale={locale as Locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="quotes" title={w.outOfScope} lead={w.outOfScopeLead}>
        <ProviderOutOfScope locale={locale as Locale} query={space.selectedQuery} />
      </ProviderAppShell>
    );
  }
  const m = getProviderQuoteMessages(locale as Locale);
  const prefills = result.status === "success" && invitation?.quote?.currentVersionId
    ? await loadQuotePrefills(result.dashboard.organizationId, [{ invitationId: invitation.id, versionId: invitation.quote.currentVersionId }], locale as Locale)
    : {};
  if(prefills===null)return <ProviderReadFailure locale={locale as Locale} space={space} active="quotes" reason="QUERY_FAILED"/>;
  const identities = invitation ? quoteIdentities([invitation.id]) : {};
  return (
    <ProviderAppShell locale={locale as Locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="quotes" title={w.quotePreviewTitle} lead={w.quotePreviewLead}>
      <QuotePreviewWorkbench
        locale={locale as Locale}
        query={space.selectedQuery}
        quoteId={quoteId}
        invitation={invitation}
        prefill={invitation ? prefills[invitation.id] : undefined}
        organizationName={result.status === "success" ? result.dashboard.organizationName : space.organizationName ?? ""}
        submitPanel={result.status === "success" && invitation && result.dashboard.canManage
          ? <QuoteSubmitForm item={invitation} locale={locale as Locale} m={m} identity={identities[invitation.id]!} identityReview={result.status==="success"?result.dashboard.identityReview:undefined} organizationId={space.selectedOrganizationId??undefined} />
          : null}
      />
    </ProviderAppShell>
  );
}

export async function ProviderMissionDeliveryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; missionId: string }>;
  searchParams: Search;
}) {
  const [{ locale, missionId }, query] = await Promise.all([params, searchParams]);
  const space = await spaceOrRedirect(locale, query.organizationId);
  const contextBoundary=providerContextBoundary(locale as Locale,space,"missions",query.organizationId);
  if(contextBoundary)return contextBoundary;
  const w = workbenchCopy(locale as Locale);
  const result = await loadProviderMissions(locale as Locale, query.organizationId, missionId);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(`/${locale}/connexion`);
  if (result.status === "error") return <ProviderReadFailure locale={locale as Locale} space={space} active="missions" reason={result.reason} />;
  const mission = result.status === "success" ? result.dashboard.missions.find((item) => item.id === missionId) ?? null : null;
  if (!mission) {
    return (
      <ProviderAppShell locale={locale as Locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="missions" title={w.outOfScope} lead={w.outOfScopeLead}>
        <ProviderOutOfScope locale={locale as Locale} query={space.selectedQuery} />
      </ProviderAppShell>
    );
  }
  const messages = getProviderMissionMessages(locale as Locale);
  return (
    <ProviderAppShell locale={locale as Locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="missions" title={w.missionDeliveryTitle} lead={w.missionDeliveryLead}>
      <MissionDeliveryWorkbench
        locale={locale as Locale}
        query={space.selectedQuery}
        missionId={missionId}
        mission={mission}
        missionsPanel={result.status === "success" && mission ? <ProviderLiveMissionsPanel dashboard={{ ...result.dashboard, missions: [mission] }} locale={locale as Locale} messages={messages} /> : null}
      />
    </ProviderAppShell>
  );
}

export async function ProviderInvoiceSettlementPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; invoiceId: string }>;
  searchParams: Search;
}) {
  const [{ locale, invoiceId }, query] = await Promise.all([params, searchParams]);
  const space = await spaceOrRedirect(locale, query.organizationId);
  const contextBoundary=providerContextBoundary(locale as Locale,space,"billing",query.organizationId);
  if(contextBoundary)return contextBoundary;
  const w = workbenchCopy(locale as Locale);
  const result = await loadProviderBilling(query.organizationId, invoiceId);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(`/${locale}/connexion`);
  if (result.status === "error") return <ProviderReadFailure locale={locale as Locale} space={space} active="billing" reason={result.reason} />;
  const invoice = result.status === "success" ? result.dashboard.invoices.find((item) => item.id === invoiceId || item.number === invoiceId) ?? null : null;
  if (!invoice) {
    return (
      <ProviderAppShell locale={locale as Locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="billing" title={w.outOfScope} lead={w.outOfScopeLead}>
        <ProviderOutOfScope locale={locale as Locale} query={space.selectedQuery} />
      </ProviderAppShell>
    );
  }
  const m = getBillingMessages(locale as Locale);
  const missions = result.status === "success" ? await loadBillingMissionOptions(result.dashboard.organizationId, locale as Locale) : [];
  const dossier = result.status === "success" ? await loadProviderInvoiceDossier(result.dashboard.organizationId,invoice.id) : null;
  return (
    <ProviderAppShell locale={locale as Locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="billing" title={w.invoiceTitle} lead={w.invoiceLead}>
      <InvoiceSettlementWorkbench
        locale={locale as Locale}
        query={space.selectedQuery}
        invoiceId={invoiceId}
        invoice={invoice}
        dossier={dossier}
        billingPanel={result.status === "success" ? <ProviderLiveBillingPanel dashboard={result.dashboard} missions={missions} locale={locale as Locale} m={m} keys={Array.from({ length: 6 }, () => randomUUID())} /> : null}
      />
    </ProviderAppShell>
  );
}

export async function ProviderMessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; threadId?: string }>;
  searchParams: Search;
}) {
  const [{ locale, threadId }, query] = await Promise.all([params, searchParams]);
  const space = await spaceOrRedirect(locale, query.organizationId);
  const contextBoundary=providerContextBoundary(locale as Locale,space,"messages",query.organizationId);
  if(contextBoundary)return contextBoundary;
  const m = getMessagingMessages(locale as Locale);
  if (threadId && !recordId.test(threadId)) notFound();
  const cursor = parseMessageCursor(query);
  if (!cursor.valid) notFound();
  const requestedThread = threadId;
  const page = Math.min(100000, Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1));
  const search = (query.q ?? "").trim().slice(0, 120);
  if(!requestedThread&&query.rfq&&recordId.test(query.rfq)&&space.selectedOrganizationId){
    const existing=await findProviderObjectThread(query.rfq,space.selectedOrganizationId);
    if(existing.status==="error")return <ProviderReadFailure locale={locale as Locale} space={space} active="messages" reason={existing.reason}/>;
    if(existing.value){const retained=new URLSearchParams({organizationId:space.selectedOrganizationId,...(search?{q:search}:{}),...(page>1?{page:String(page)}:{})});redirect(`/${locale}/sous-traitant/messages/${existing.value}?${retained}`);}
  }
  const repository = await createInternalMessagingRepository();
  const [loaded, notifications] = await Promise.all([
    loadProviderInbox(repository, { organizationId:space.selectedOrganizationId, threadId:requestedThread, search, page, cursor:cursor.cursor }),
    loadNotificationCenter(locale as Locale, space.selectedOrganizationId ?? undefined),
  ]);
  const { inbox, options, history } = loaded;
  if ([inbox, options, history].some(result => result?.status === "error" && result.reason === "UNAUTHENTICATED")) redirect(`/${locale}/connexion`);
  const threads = inbox.status === "success" ? inbox.value.inbox : [];
  const matched = query.rfq && recordId.test(query.rfq) ? threads.find((thread) => thread.object_id === query.rfq) : undefined;
  const retained = new URLSearchParams({ ...(space.selectedOrganizationId ? {organizationId:space.selectedOrganizationId} : {}), ...(search ? {q:search} : {}), ...(page > 1 ? {page:String(page)} : {}) });
  const selectedQuery = retained.size ? `?${retained}` : "";
  if (!requestedThread && matched) redirect(`/${locale}/sous-traitant/messages/${matched.id}${selectedQuery}`);
  const inboxNotifications = notifications.status === "success"
    ? notifications.dashboard.notifications.slice(0, 8).map((item) => ({ id:item.id, subject:item.subject, createdAt:item.created_at, href:item.cta_path?.startsWith("/") ? item.cta_path : null, unread:item.read_at === null })) : [];
  return (
    <ProviderAppShell locale={locale as Locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="messages" title={m.title} lead={m.description}>
      <ProviderInboxBoard
        locale={locale as Locale}
        query={selectedQuery}
        organizationId={space.selectedOrganizationId}
        search={search}
        page={page}
        total={inbox.status === "success" ? inbox.value.total : undefined}
        pageSize={inbox.status === "success" ? inbox.value.pageSize : undefined}
        threads={threads}
        inboxError={inbox.status === "error" ? inbox.reason : undefined}
        conversation={history?.status === "success" ? history.value : null}
        conversationError={history?.status === "error" ? history.reason : undefined}
        history={history?.status === "success" ? history.value : undefined}
        options={options.status === "success" ? options.value.options : []}
        optionsError={options.status === "error"}
        preferredRfqId={query.rfq && recordId.test(query.rfq) ? query.rfq : undefined}
        notifications={inboxNotifications}
        notificationsUnavailable={notifications.status !== "success"}
      />
    </ProviderAppShell>
  );
}

export async function ProviderNestedPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string[] }>;
  searchParams: Search;
}) {
  const [{ locale, slug }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale) || !slug?.length) notFound();
  const nested = resolveProviderNestedView(slug);
  if (!nested) notFound();
  if (nested.kind === "consultations" && nested.itemId) {
    return ProviderConsultationDetailPage({ params: Promise.resolve({ locale, consultationId: nested.itemId }), searchParams });
  }
  if (nested.kind === "devis" && nested.view === "apercu" && nested.itemId) {
    return ProviderQuotePreviewPage({ params: Promise.resolve({ locale, quoteId: nested.itemId }), searchParams });
  }
  if (nested.kind === "devis" && (nested.create || nested.itemId)) {
    return ProviderQuoteWorkbenchPage({
      params: Promise.resolve({ locale, quoteId: nested.itemId ?? "nouveau" }),
      searchParams,
      mode: nested.view === "revision" ? "revise" : "create",
    });
  }
  if (nested.kind === "missions" && nested.itemId) {
    return ProviderMissionDeliveryPage({ params: Promise.resolve({ locale, missionId: nested.itemId }), searchParams });
  }
  if (nested.kind === "facturation" && nested.itemId) {
    return ProviderInvoiceSettlementPage({ params: Promise.resolve({ locale, invoiceId: nested.itemId }), searchParams });
  }
  if (nested.kind === "messages") {
    return ProviderMessagesPage({ params: Promise.resolve({ locale, threadId: nested.itemId ?? undefined }), searchParams });
  }
  if (nested.kind === "company") {
    return ProviderCompanyPage({ params: Promise.resolve({ locale }), searchParams });
  }
  const space = await spaceOrRedirect(locale, query.organizationId);
  const contextBoundary=providerContextBoundary(locale,space,nested.active,query.organizationId);
  if(contextBoundary)return contextBoundary;
  if (nested.kind === "documents") {
    const c = providerCopy(locale as Locale);
    const documents = await loadProviderDashboard(query.organizationId);
    const view = query.vue === "qualification" ? "qualification" as const : "all" as const;
    return (
      <ProviderAppShell locale={locale as Locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="documents" title={c.docsTitle} lead={c.docsLead}>
        <ProviderDocumentsBoard
          locale={locale as Locale}
          query={space.selectedQuery}
          documents={documents.status === "success" ? documents.dashboard.documents : []}
          loadError={documents.status === "error"}
          search={query.q ?? ""}
          view={view}
        />
      </ProviderAppShell>
    );
  }
  const destination = providerFallbackPath(slug);
  if (destination === slug.join("/")) notFound();
  redirect(`/${locale}/sous-traitant/${destination}${space.selectedQuery}`);
}

export async function ProviderCompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Search;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const space = await spaceOrRedirect(locale, query.organizationId);
  const contextBoundary=providerContextBoundary(locale as Locale,space,"company",query.organizationId);
  if(contextBoundary)return contextBoundary;
  const w = workbenchCopy(locale as Locale);
  const c = providerCopy(locale as Locale);
  const [security, sessions, roles] = await Promise.all([getAccountSecurity(), listMySessions(), loadProviderTeam(space.selectedOrganizationId)]);
  const roleMessages = getRoleMessages(locale as Locale);
  const dateLabel = (value: string | null) => {
    if (!value) return "—";
    const date = new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value) ? `${value}Z` : value);
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium", timeStyle: "short" }).format(date);
  };
  return (
    <ProviderAppShell locale={locale as Locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="company" title={w.companyTitle} lead={w.companyLead} kicker={c.kicker}>
      <CompanySecurityWorkbench
        locale={locale as Locale}
        query={space.selectedQuery}
        organizationName={space.organizationName}
        userEmail={space.userEmail}
        mfaEnabled={security.status === "success" ? security.factors.some((factor) => factor.status === "verified") : null}
        sessionsUnavailable={sessions.status !== "success"}
        membersUnavailable={roles.status !== "success"}
        securityUnavailable={security.status !== "success"}
        sessions={sessions.status === "success" ? sessions.sessions.map((session) => ({
          id: session.id,
          label: session.userAgent && /Mobile|Android|iPhone|iPad/i.test(session.userAgent)
            ? (locale === "ar" ? "جهاز جوّال" : "Appareil mobile")
            : (locale === "ar" ? "جهاز مكتبي" : "Appareil de bureau"),
          lastSeen: dateLabel(session.lastSeenAt),
          isCurrent: session.isCurrent,
        })) : []}
        members={roles.status === "success" ? roles.members.map((member) => ({
          id: member.id,
          name: member.isCurrentUser ? (locale === "ar" ? "أنتم" : "Vous") : roleMessages.anotherMember,
          role: member.roles.length ? member.roles.map(role => roleMessages.roles[role as keyof typeof roleMessages.roles] ?? (locale === "ar" ? "صلاحية خاصة" : "Habilitation particulière")).join(" · ") : roleMessages.noRole,
        })) : []}
      />
    </ProviderAppShell>
  );
}

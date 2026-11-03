import Link from "next/link";
import type { ReactNode } from "react";
import {messageHistoryHref,parseMessageCursor} from "./history-navigation";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { InternalMessageAttachments, MessageAttachments } from "@/modules/shared/ui/internal-message-attachments";
import { Badge } from "@/modules/shared/ui/badge";
import { createInternalMessagingRepository } from "@/modules/shared/lib/internal-messaging/server-repository";
import { resolveWorkspaceShell } from "@/modules/shared/lib/connected-space/workspace-shell";
import { isLocale, type Locale } from "@/modules/shared/lib/i18n/locale";
import { resolveConnectedSpace } from "@/modules/shared/lib/account-security/connected-space";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { MessagesBoard, SpaceActions } from "@/modules/client/screens/spaces/boards";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";
import { providerCopy } from "@/modules/provider/data/spaces/copy";
import { ProviderActions, ProviderAppShell } from "@/modules/provider/ui/provider-app-shell";
import { OpenThreadForm, SendMessageForm } from "./messaging-forms";
import { getMessagingMessages } from "./messages";

function date(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Casablanca" }).format(new Date(value));
}

function ConversationPanel({
  locale,
  m,
  result,historyNavigation,organizationId,
}: {
  historyNavigation?:ReactNode;
  organizationId?:string;
  locale: Locale;
  m: ReturnType<typeof getMessagingMessages>;
  result: Awaited<ReturnType<Awaited<ReturnType<typeof createInternalMessagingRepository>>["load"]>>;
}) {
  if (result.status === "error") {
    return <p role="alert">{m.loadError}</p>;
  }
  if (result.value.conversation) {
    return (
      <div className="space-y-4">
        <header className="client-priority-head">
          <h2>{result.value.conversation.thread.subject}</h2>
          <Badge variant="outline">{m.policy}</Badge>
        </header>
        <ol className="client-feed">
          {result.value.conversation.messages.map((message) => (
            <li key={message.id}>
              <span>
                <strong>{message.sender_alias === "CLIENT" ? m.client : message.sender_alias === "FRANCHISE"?m.franchise:m.provider}</strong>
                <small>{date(message.created_at, locale)}</small>
                <p>{message.body}</p>
                <MessageAttachments attachments={message.attachments} locale={locale} />
              </span>
            </li>
          ))}
        </ol>
        {historyNavigation}
        {result.value.conversation.thread.can_send !== true && result.value.conversation.thread.status !== "LOCKED" ? <p role="status">{result.value.conversation.thread.can_send === false ? (locale === "ar" ? "هذه المحادثة للقراءة فقط بحسب دوركم أو إسناد المهمة إليكم." : "Cette conversation est en lecture seule pour votre rôle ou votre affectation.") : (locale === "ar" ? "صلاحيات الإرسال غير متاحة. أعد تحميل المحادثة." : "Les droits d’envoi sont indisponibles. Rechargez cette conversation.")}</p> : <SendMessageForm
          threadId={result.value.conversation.thread.id}
          senderOrganizationId={result.value.conversation.thread.participant_organization_id}
          locale={locale}
          m={m}
          locked={result.value.conversation.thread.status === "LOCKED"}
        />}
        {result.value.conversation.thread.status !== "LOCKED" && result.value.conversation.thread.can_send === true ? <InternalMessageAttachments threadId={result.value.conversation.thread.id} senderOrganizationId={result.value.conversation.thread.participant_organization_id} locale={locale} /> : null}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <OpenThreadForm options={result.value.options} locale={locale} m={m} organizationId={organizationId} />
      <p>{m.choose}</p>
    </div>
  );
}

export default async function MessagingPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ fil?: string; organizationId?: string; q?: string; page?:string;before?:string;beforeId?:string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveConnectedSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/messagerie` }));
  const repository=await createInternalMessagingRepository(),page=Math.min(100000,Math.max(1,Number.parseInt(query.page??"1",10)||1)),needle=(query.q??"").trim().slice(0,200);
  const cursor=parseMessageCursor(query);if(!cursor.valid)notFound();
  const [options, workspaceShell,inbox,history] = await Promise.all([
    repository.load(undefined,{skipInbox:true,organizationId:space.selectedOrganizationId??undefined}),
    resolveWorkspaceShell(space.selectedOrganizationId),
    repository.search(needle,space.selectedOrganizationId??undefined,page),
    query.fil?repository.history(query.fil,cursor.cursor,space.selectedOrganizationId??undefined):Promise.resolve(null),
  ]);
  const result=options.status==="error"?options:history?.status==="error"?history:{status:"success"as const,value:{...options.value,conversation:history?.status==="success"?history.value:null}};
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/messagerie` }));
  const m = getMessagingMessages(locale);
  const c = spaceCopy(locale);
  const threads =
    inbox.status === "success"
      ? inbox.value.inbox.map((thread) => ({
          id: thread.id,
          title: thread.subject,
          meta: thread.counterparty_alias === "CLIENT" ? m.client : thread.counterparty_alias === "FRANCHISE"?m.franchise:m.provider,
          href: `/${locale}/messagerie?${new URLSearchParams({fil:thread.id,q:needle,page:String(page),...(space.selectedOrganizationId?{organizationId:space.selectedOrganizationId}:{})})}`,
        }))
      : [];

  const pageHref=(next:number)=>`/${locale}/messagerie?${new URLSearchParams({q:needle,page:String(next),...(query.fil?{fil:query.fil}:{}),...(space.selectedOrganizationId?{organizationId:space.selectedOrganizationId}:{})})}`;
  const board = (
    <MessagesBoard serverFiltered inboxError={inbox.status==="error"} inboxFooter={inbox.status==="success"?<><p>{inbox.value.total} {locale==="fr"?"fil(s) correspondant(s)":"محادثة مطابقة"}</p><nav className="flex gap-4" aria-label={locale==="fr"?"Pages des conversations":"صفحات المحادثات"}>{page>1?<Link className="min-h-11 underline" href={pageHref(page-1)}>{locale==="fr"?"Précédent":"السابق"}</Link>:null}{inbox.value.total>page*inbox.value.pageSize?<Link className="min-h-11 underline" href={pageHref(page+1)}>{locale==="fr"?"Suivant":"التالي"}</Link>:null}</nav></>:null} locale={locale} query={space.selectedQuery} search={needle} threads={threads} organizationName={space.organizationName}>
      <ConversationPanel locale={locale} m={m} result={result} organizationId={space.selectedOrganizationId??undefined} historyNavigation={history?.status==="success"?<nav className="flex flex-wrap items-center gap-4" aria-label={locale==="fr"?"Historique des messages":"سجل الرسائل"}><p>{history.value.total} {locale==="fr"?"message(s) au total":"رسالة إجمالاً"}</p>{history.value.hasMore&&history.value.nextCursor?<Link className="inline-flex min-h-11 items-center underline" href={messageHistoryHref(locale,{...query,q:needle,page:String(page),organizationId:space.selectedOrganizationId??undefined},history.value.nextCursor)}>{locale==="fr"?"Messages plus anciens":"رسائل أقدم"}</Link>:null}{cursor.cursor?<Link className="inline-flex min-h-11 items-center underline" href={messageHistoryHref(locale,{...query,q:needle,page:String(page),organizationId:space.selectedOrganizationId??undefined})}>{locale==="fr"?"Messages récents":"الرسائل الحديثة"}</Link>:null}</nav>:null}/>

    </MessagesBoard>
  );

  if (workspaceShell === "provider") {
    const p = providerCopy(locale);
    return (
      <ProviderAppShell
        locale={locale}
        selectedQuery={space.selectedQuery}
        selectedOrganizationId={space.selectedOrganizationId}
        userEmail={space.userEmail}
        active="messages"
        title={m.title}
        lead={m.description}
        kicker={p.kicker}
        actions={<ProviderActions href={`/${locale}/messagerie${space.selectedQuery}`} label={m.open} />}
      >
        {board}
      </ProviderAppShell>
    );
  }

  return (
    <ClientAppShell
      languagePath={messageHistoryHref(locale,{...query,q:needle,page:String(page),organizationId:space.selectedOrganizationId??undefined},cursor.cursor)}
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail}
      organizationName={space.organizationName}
      active="messages"
      title={c.msgTitle}
      lead={c.msgLead}
      kicker={c.kicker}
      actions={<SpaceActions href={`/${locale}/messagerie${space.selectedQuery}`} label={c.newMessage} />}
    >
      {board}
    </ClientAppShell>
  );
}

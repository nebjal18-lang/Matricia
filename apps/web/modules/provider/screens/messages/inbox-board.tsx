import Link from "next/link";
import { InternalMessageAttachments, MessageAttachments } from "@/modules/shared/ui/internal-message-attachments";
import type { MessagingFailure } from "@/modules/shared/lib/internal-messaging/repository";
import type { ThreadPage, MessageCursor } from "@/modules/shared/lib/internal-messaging/model";
import { OpenThreadForm, SendMessageForm } from "@/app/[locale]/messagerie/messaging-forms";
import { getMessagingMessages } from "@/app/[locale]/messagerie/messages";
import { getNotificationMessages } from "@/app/[locale]/notifications/messages";
import type { InboxThread, ThreadConversation, ThreadOption } from "@/modules/shared/lib/internal-messaging/model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

function date(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Casablanca" }).format(new Date(value));
}

export type ProviderInboxNotification = {
  id: string;
  subject: string;
  createdAt: string;
  href: string | null;
  unread: boolean;
};

export function ProviderInboxBoard({
  locale,
  query,
  threads,
  conversation,
  options,
  preferredRfqId,
  notifications = [],
  organizationId,
  search = "",
  page = 1,
  total,
  pageSize = 25,
  inboxError,
  conversationError,
  optionsError = false,
  notificationsUnavailable = false,
  history,
}: {
  locale: Locale;
  query: string;
  threads: InboxThread[];
  conversation: ThreadConversation | null;
  options: ThreadOption[];
  preferredRfqId?: string;
  notifications?: readonly ProviderInboxNotification[];
  organizationId?: string | null;
  search?: string;
  page?: number;
  total?: number;
  pageSize?: number;
  inboxError?: MessagingFailure;
  conversationError?: MessagingFailure;
  optionsError?: boolean;
  notificationsUnavailable?: boolean;
  history?: ThreadPage;
}) {
  const m = getMessagingMessages(locale);
  const n = getNotificationMessages(locale);
  const filteredOptions = preferredRfqId ? options.filter((item) => item.rfqId === preferredRfqId) : options;
  const openOptions = filteredOptions.map(item => ({...item,label:`${item.context === "CONTRACT" ? (locale === "ar" ? "ملف عقد" : "Dossier contractuel") : (locale === "ar" ? "استشارة" : "Consultation")} ${item.rfqId.slice(0,8).toUpperCase()}`}));
  const empty = locale === "ar" ? "لا توجد محادثة مرتبطة باستشارة." : "Aucune conversation liée à une consultation.";
  const tr = (fr: string, ar: string) => locale === "ar" ? ar : fr;
  const base = `/${locale}/sous-traitant/messages`;
  const pageHref = (next:number) => {const params=new URLSearchParams(query);params.set("page",String(next));return `${base}?${params}`;};
  const historyHref = (cursor?:MessageCursor) => {const params=new URLSearchParams(query);params.delete("before");params.delete("beforeId");if(cursor){params.set("before",cursor.createdAt);params.set("beforeId",cursor.id);}return `${base}/${conversation!.thread.id}${params.size?`?${params}`:""}`;};
  const errorMessage = (reason:MessagingFailure) => reason === "FORBIDDEN" ? tr("Cette conversation n’est pas accessible dans l’organisation sélectionnée.","هذه المحادثة غير متاحة في المؤسسة المختارة.") : m.loadError;
  return (
    <main className="client-page provider-workbench provider-messages">
      <header className="provider-workbench-hero">
        <div>
          <h2>{m.title}</h2>
          <p>{m.description}</p>
        </div>
      </header>
      <section className="provider-messages-grid" id="messages">
        <article className="client-card provider-thread-list">
          <header><h2>{m.threads}</h2></header>
          <form method="get" action={base} role="search" className="grid gap-2">
            {organizationId ? <input type="hidden" name="organizationId" value={organizationId} /> : null}
            <label htmlFor="provider-inbox-search">{tr("Rechercher une conversation", "البحث عن محادثة")}</label>
            <input id="provider-inbox-search" name="q" defaultValue={search} maxLength={120} className="min-h-11 rounded border px-3" />
            <button className="client-cta" type="submit">{tr("Rechercher", "بحث")}</button>
          </form>
          {inboxError ? <p role="alert">{errorMessage(inboxError)} <Link href={`${base}${query}`}>{tr("Réessayer", "إعادة المحاولة")}</Link></p> : threads.length === 0 ? <p>{m.empty}</p> : (
            <ul className="client-feed">
              {threads.map((thread) => (
                <li key={thread.id}>
                  <Link
                    href={`/${locale}/sous-traitant/messages/${thread.id}${query}`}
                    className="provider-thread-link"
                    data-active={conversation?.thread.id === thread.id ? "true" : undefined}
                  >
                    <strong>{thread.subject}</strong>
                    <small>{thread.counterparty_alias === "CLIENT" ? m.client : m.provider} · {date(thread.last_message_at, locale)}</small>
                    <em>{thread.object_type === "FRANCHISE_RFQ" ? tr("Consultation du réseau", "استشارة الشبكة") : m.consultation}</em>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {!inboxError && total !== undefined ? <nav className="flex flex-wrap gap-3" aria-label={tr("Pages de conversations", "صفحات المحادثات")}>
            {page > 1 ? <Link href={pageHref(page-1)}>{tr("Précédent", "السابق")}</Link> : null}
            <span>{tr("Page", "الصفحة")} {page}</span>
            {page*pageSize < total ? <Link href={pageHref(page+1)}>{tr("Suivant", "التالي")}</Link> : null}
          </nav> : null}
          {optionsError ? <p role="alert">{tr("Les consultations permettant d’ouvrir un échange sont indisponibles. Réessayez le chargement.", "تعذر تحميل الاستشارات المتاحة لبدء محادثة. أعد المحاولة.")}</p> : <OpenThreadForm
            options={openOptions}
            locale={locale}
            m={m}
            successBase={`/${locale}/sous-traitant/messages`}
            successSuffix={query}
          />}
        </article>
        <article className="client-card provider-message-pane">
          {conversationError ? <p role="alert">{errorMessage(conversationError)} <Link href={`${base}${query}`}>{tr("Retour aux conversations", "العودة إلى المحادثات")}</Link></p> : conversation ? (
            <>
              <header className="client-priority-head">
                <div>
                  <h3>{conversation.thread.subject}</h3>
                  <p>{m.privacy}</p>
                </div>
                <Link href={`/${locale}/sous-traitant/consultations/${conversation.thread.object_id}${query}`} className="client-text-link">{m.consultation}</Link>
              </header>
              <ol className="client-feed provider-message-thread">
                {conversation.messages.map((message) => (
                  <li key={message.id} data-mine={message.mine ? "true" : "false"}>
                    <span>
                      <strong>{message.sender_alias === "CLIENT" ? m.client : message.sender_alias === "FRANCHISE" ? m.franchise : m.provider}</strong>
                      <small>{date(message.created_at, locale)}</small>
                      <p className={message.mine ? "provider-message-self" : undefined}>{message.body}</p>
                      <MessageAttachments attachments={message.attachments} locale={locale} />
                    </span>
                  </li>
                ))}
              </ol>
              {history ? <nav className="flex flex-wrap gap-3" aria-label={tr("Historique de conversation", "سجل المحادثة")}>
                {history.hasMore && history.nextCursor ? <Link href={historyHref(history.nextCursor)}>{tr("Messages plus anciens", "رسائل أقدم")}</Link> : null}
                <Link href={historyHref()}>{tr("Messages les plus récents", "أحدث الرسائل")}</Link>
              </nav> : null}
              {conversation.thread.can_send !== true && conversation.thread.status !== "LOCKED" ? <p role="status">{conversation.thread.can_send === false ? tr("Cette conversation est en lecture seule pour votre rôle ou votre affectation.", "هذه المحادثة للقراءة فقط بحسب دوركم أو إسناد المهمة إليكم.") : tr("Les droits d’envoi sont indisponibles. Rechargez cette conversation.", "صلاحيات الإرسال غير متاحة. أعد تحميل المحادثة.")}</p> : <SendMessageForm
                threadId={conversation.thread.id}
                senderOrganizationId={conversation.thread.participant_organization_id}
                locale={locale}
                m={m}
                locked={conversation.thread.status === "LOCKED"}
              />}
              {conversation.thread.status !== "LOCKED" && conversation.thread.can_send === true ? <InternalMessageAttachments threadId={conversation.thread.id} senderOrganizationId={conversation.thread.participant_organization_id} locale={locale} /> : null}
            </>
          ) : (
            <p>{inboxError ? tr("Choisissez une conversation après avoir rétabli le chargement.", "اختر محادثة بعد استعادة تحميل البيانات.") : threads.length === 0 ? empty : m.choose}</p>
          )}
        </article>
        <article className="client-card" id="notifications">
          <header className="client-priority-head">
            <h2>{n.center}</h2>
            <Link href={`/${locale}/notifications${query}`} className="client-text-link">{n.preferences}</Link>
          </header>
          {notificationsUnavailable ? <p role="alert">{tr("Notifications indisponibles. Ouvrez le centre de notifications pour réessayer.", "الإشعارات غير متاحة. افتح مركز الإشعارات للمحاولة مجددا.")}</p> : notifications.length === 0 ? <p role="status">{n.empty}</p> : (
            <ul className="client-feed">
              {notifications.map((item) => (
                <li key={item.id}>
                  <span>
                    <strong>{item.subject}</strong>
                    <small>{date(item.createdAt, locale)}{item.unread ? ` · ${n.unread}` : ""}</small>
                  </span>
                  <Link href={item.href ?? `/${locale}/notifications${query}`} className="client-text-link">{n.open}</Link>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </main>
  );
}

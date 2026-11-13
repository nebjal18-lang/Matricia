import Link from "next/link";
import { InternalMessageAttachments, MessageAttachments } from "@/modules/shared/ui/internal-message-attachments";
import { OpenFranchiseMessageForm, SendFranchiseMessageForm } from "@/modules/franchise/screens/messages/forms";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { loadFranchiseMessaging } from "@/modules/franchise/data/messaging/repository";

type MessagingScope = {
  locale: Locale;
  organizationId: string;
  franchiseId: string;
  commandKey: string;
};

type LoadedMessaging = NonNullable<Awaited<ReturnType<typeof loadFranchiseMessaging>>>;

export function FranchiseMessagesWorkspace({
  locale,
  scope,
  loaded,
  link,
  searchQuery,
  queryFil,
  queryBefore,
}: {
  locale: Locale;
  scope: MessagingScope;
  loaded: Extract<LoadedMessaging, { status: "success" }>;
  link: (updates: Record<string, string | null>) => string;
  searchQuery?: string;
  queryFil?: string;
  queryBefore?: string;
}) {
  const ar = locale === "ar";
  return (
    <main className="client-page">
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="client-card space-y-4">
          <h2>{ar ? "المحادثات" : "Conversations"}</h2>
          <form method="get">
            <input type="hidden" name="organizationId" value={scope.organizationId} />
            <input type="hidden" name="franchiseId" value={scope.franchiseId} />
            <label className="franchise-field">
              {ar ? "البحث في المواضيع والرسائل" : "Rechercher dans les objets et messages"}
              <input name="q" defaultValue={searchQuery ?? ""} maxLength={120} />
            </label>
            <button type="submit" className="franchise-tool">{ar ? "بحث" : "Rechercher"}</button>
          </form>
          <p>
            {loaded.total} {ar ? "محادثة مطابقة" : "conversation(s) correspondante(s)"}
          </p>
          <ul className="space-y-3">
            {loaded.inbox.map((thread) => (
              <li key={thread.id}>
                <Link
                  aria-current={queryFil === thread.id ? "page" : undefined}
                  className="client-soft-link"
                  href={link({ fil: thread.id })}
                >
                  {thread.subject}
                </Link>
                <small className="block">
                  {thread.message_count} {ar ? "رسالة" : "message(s)"} ·{" "}
                  {thread.counterparty_alias === "CLIENT" ? (ar ? "عميل" : "Client") : ar ? "مقدم خدمة" : "Prestataire"}
                </small>
              </li>
            ))}
          </ul>
          {loaded.inbox.length === 0 ? (
            <p>{ar ? "لا توجد محادثات مطابقة في هذه الصفحة." : "Aucune conversation correspondante sur cette page."}</p>
          ) : null}
          <nav aria-label={ar ? "صفحات المحادثات" : "Pages des conversations"} className="flex flex-wrap gap-3">
            {loaded.page > 1 ? (
              <Link className="franchise-tool" href={link({ page: String(loaded.page - 1) })}>
                {ar ? "السابق" : "Précédent"}
              </Link>
            ) : null}
            {loaded.page * loaded.pageSize < loaded.total ? (
              <Link className="franchise-tool" href={link({ page: String(loaded.page + 1) })}>
                {ar ? "التالي" : "Suivant"}
              </Link>
            ) : null}
          </nav>
        </section>
        <section className="client-card space-y-4 lg:col-span-2">
          {loaded.conversation ? (
            <>
              <h2>{loaded.conversation.thread.subject}</h2>
              <p>
                {loaded.conversation.messages.length} / {loaded.conversation.total}{" "}
                {ar
                  ? "رسالة. تُعرض هوية المشاركين المحمية."
                  : "message(s). Les participants utilisent leur identité protégée."}
              </p>
              <nav aria-label={ar ? "سجل المحادثة" : "Historique de la conversation"} className="flex flex-wrap gap-3">
                {loaded.conversation.nextCursor ? (
                  <Link
                    className="franchise-tool"
                    href={link({
                      before: loaded.conversation.nextCursor.createdAt,
                      beforeId: loaded.conversation.nextCursor.id,
                    })}
                  >
                    {ar ? "رسائل أقدم" : "Messages plus anciens"}
                  </Link>
                ) : null}
                {queryBefore ? (
                  <Link className="franchise-tool" href={link({ before: null, beforeId: null })}>
                    {ar ? "أحدث الرسائل" : "Messages récents"}
                  </Link>
                ) : null}
              </nav>
              <ol className="space-y-4">
                {loaded.conversation.messages.map((message) => (
                  <li key={message.id} className="rounded-lg border p-3">
                    <strong>
                      {message.sender_alias === "FRANCHISE"
                        ? ar
                          ? "صاحب الامتياز"
                          : "Franchisé"
                        : message.sender_alias === "CLIENT"
                          ? ar
                            ? "العميل"
                            : "Client"
                          : ar
                            ? "مقدم الخدمة"
                            : "Prestataire"}
                    </strong>
                    <time className="block text-sm" dateTime={message.created_at}>
                      {new Intl.DateTimeFormat(ar ? "ar-MA" : "fr-MA", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Africa/Casablanca",
                      }).format(new Date(message.created_at))}
                    </time>
                    <p className="whitespace-pre-wrap">{message.body}</p>
                    <MessageAttachments attachments={message.attachments} locale={locale} />
                  </li>
                ))}
              </ol>
              <SendFranchiseMessageForm
                key={loaded.conversation.thread.id}
                scope={scope}
                threadId={loaded.conversation.thread.id}
                locked={loaded.conversation.thread.status === "LOCKED"}
              />
              {loaded.conversation.thread.status !== "LOCKED" ? (
                <InternalMessageAttachments
                  threadId={loaded.conversation.thread.id}
                  senderOrganizationId={loaded.conversation.thread.participant_organization_id}
                  locale={locale}
                />
              ) : null}
            </>
          ) : (
            <OpenFranchiseMessageForm scope={scope} options={loaded.options} />
          )}
          <Link className="franchise-tool" href={link({ fil: null, before: null, beforeId: null })}>
            {ar ? "تبادل جديد" : "Nouvel échange"}
          </Link>
        </section>
      </div>
    </main>
  );
}

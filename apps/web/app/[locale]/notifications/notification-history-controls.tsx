import Link from "next/link";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { NotificationDashboard } from "@/modules/shared/lib/notifications/model";
import type { NotificationMessages } from "./messages";

export function notificationHistoryHref(locale: Locale, organizationId: string, workspace: string | undefined, history: { q?: string; unread?: boolean; before?: string; beforeId?: string }) {
  const query = new URLSearchParams({ organizationId });
  if (workspace) query.set("workspace", workspace);
  if (history.q) query.set("q", history.q);
  if (history.unread) query.set("unread", "1");
  if (history.before && history.beforeId) { query.set("before", history.before); query.set("beforeId", history.beforeId); }
  return `/${locale}/notifications?${query}`;
}

export function NotificationHistoryControls({ dashboard, locale, workspace, m }: { dashboard: NotificationDashboard; locale: Locale; workspace?: string; m: NotificationMessages }) {
  const history = dashboard.history;
  const first = notificationHistoryHref(locale, dashboard.organizationId, workspace, { q: history?.q, unread: history?.unread });
  return <div className="space-y-3 rounded-xl border bg-card p-4">
    <form method="get" action={`/${locale}/notifications`} className="flex min-w-0 flex-wrap items-end gap-3" role="search">
      <input type="hidden" name="organizationId" value={dashboard.organizationId}/>
      {workspace ? <input type="hidden" name="workspace" value={workspace}/> : null}
      <div className="min-w-0 flex-1 basis-48"><label htmlFor="notification-search" className="mb-1 block text-sm font-medium">{m.search}</label><input id="notification-search" type="search" name="q" maxLength={160} defaultValue={history?.q ?? ""} className="min-h-11 w-full min-w-0 rounded-md border bg-background px-3"/></div>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="unread" value="1" defaultChecked={history?.unread}/>{m.unreadOnly}</label>
      <button type="submit" className="min-h-11 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2">{m.searchAction}</button>
    </form>
    <nav aria-label={m.navigation} className="flex flex-wrap gap-3 text-sm">
      {history?.q || history?.unread ? <Link className="inline-flex min-h-11 items-center underline" href={notificationHistoryHref(locale, dashboard.organizationId, workspace, {})}>{m.reset}</Link> : null}
      {history?.before ? <Link className="inline-flex min-h-11 items-center underline" href={first}>{m.firstPage}</Link> : null}
      {history?.next ? <Link className="inline-flex min-h-11 items-center underline" href={notificationHistoryHref(locale, dashboard.organizationId, workspace, {q:history.q,unread:history.unread,before:history.next.createdAt,beforeId:history.next.id})}>{m.older}</Link> : null}
    </nav>
  </div>;
}

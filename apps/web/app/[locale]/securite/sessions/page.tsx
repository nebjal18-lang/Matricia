import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";
import { safeReturnPath } from "@/modules/shared/lib/auth/return-path";
import { translateLocalPath } from "@/modules/shared/lib/auth/workspace-navigation";
import { Badge } from "@/modules/shared/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/modules/shared/ui/card";
import { getDictionary } from "@/modules/shared/lib/i18n/dictionaries";
import { isLocale, type Locale } from "@/modules/shared/lib/i18n/locale";
import { listMySessions, type SafeSession } from "./actions";
import { RevokeSessionForm } from "./revoke-session-form";
import { ConnectedAppShell } from "@/modules/shared/ui/connected-app-shell";
import { spaceCopy } from "@/modules/client/data/spaces/copy";

function dateLabel(value: string | null, locale: Locale, unavailable: string) {
  if (!value) return unavailable;
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value) ? `${value}Z` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return unavailable;
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-MA" : "ar-MA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function deviceLabel(session: SafeSession, labels: { unknownDevice: string; mobileDevice: string; desktopDevice: string }) {
  if (!session.userAgent) return labels.unknownDevice;
  return /Mobile|Android|iPhone|iPad/i.test(session.userAgent) ? labels.mobileDevice : labels.desktopDevice;
}

export default async function SessionsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string; next?: string; workspace?: string }> }) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  const nextPath = safeReturnPath(query.next, locale);
  const contextQuery = new URLSearchParams();
  if (query.organizationId) contextQuery.set("organizationId", query.organizationId);
  if (nextPath) contextQuery.set("next", nextPath);
  if (query.workspace) contextQuery.set("workspace", query.workspace);
  const suffix = contextQuery.size ? `?${contextQuery}` : "";
  const selfPath = `/${locale}/securite/sessions${suffix}`;
  const result = await listMySessions();
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: selfPath }));
  const messages = getDictionary(locale).sessions;
  const c = spaceCopy(locale);
  const alternate = locale === "fr" ? "ar" : "fr";

  return (
    <ConnectedAppShell
      locale={locale}
      organizationId={query.organizationId}
      allowContextFailure
      currentPath={selfPath}
      nextPath={nextPath}
      workspace={query.workspace}
      title={c.sessions}
      lead={messages.description}
      clientActive="company"
      providerActive="company"
      franchiseActive="governance"
    >
      <main className="client-page">
        <nav className="client-tabs" aria-label={c.orgTitle}>
          <Link href={`/${locale}/organisation${query.organizationId ? `?organizationId=${query.organizationId}` : ""}`}>{c.orgTitle}</Link>
          <Link href={`/${locale}/securite/compte${suffix}`}>{c.security}</Link>
          <a href="#sessions" aria-current="page">{c.sessions}</a>
          <Link href={`/${locale}/organisation/roles${query.organizationId ? `?organizationId=${query.organizationId}` : ""}`}>{c.people}</Link>
        </nav>
        <p>
          <Link href={translateLocalPath(selfPath, locale, alternate)} hrefLang={alternate} className="client-text-link">{messages.language}</Link>
        </p>
        {result.status === "error" ? (
          <WorkspaceFailure locale={locale} reason={result.reason === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "QUERY_FAILED"} returnPath={selfPath} />
        ) : result.sessions.length === 0 ? (
          <article className="client-card">
            <h2>{messages.emptyTitle}</h2>
            <p>{messages.emptyDescription}</p>
          </article>
        ) : (
          <section id="sessions" aria-labelledby="session-list-title" className="client-card">
            <h2 id="session-list-title">{messages.listTitle}</h2>
            <ul className="grid gap-4">
              {result.sessions.map((session) => (
                <li key={session.id}>
                  <Card className={session.isCurrent ? "border-primary/50" : undefined}>
                    <CardHeader>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <CardTitle>{deviceLabel(session, messages)}</CardTitle>
                        {session.isCurrent ? <Badge>{messages.current}</Badge> : null}
                      </div>
                      <CardDescription dir="ltr" className="break-words text-start">{session.userAgent ?? messages.userAgentUnavailable}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <dl className="grid gap-3 text-sm sm:grid-cols-3">
                        <div><dt className="text-muted-foreground">{messages.lastActive}</dt><dd className="mt-1 font-medium">{dateLabel(session.lastSeenAt, locale, messages.dateUnavailable)}</dd></div>
                        <div><dt className="text-muted-foreground">{messages.created}</dt><dd className="mt-1 font-medium">{dateLabel(session.createdAt, locale, messages.dateUnavailable)}</dd></div>
                        <div><dt className="text-muted-foreground">{messages.expires}</dt><dd className="mt-1 font-medium">{dateLabel(session.expiresAt, locale, messages.dateUnavailable)}</dd></div>
                      </dl>
                      {session.isCurrent ? (
                        <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">{messages.currentProtection}</p>
                      ) : (
                        <RevokeSessionForm sessionId={session.id} locale={locale} messages={messages.revokeForm} />
                      )}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </ConnectedAppShell>
  );
}

import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { Badge } from "@/modules/shared/ui/badge";
import { isLocale, type Locale } from "@/modules/shared/lib/i18n/locale";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { OrganizationTabs } from "@/modules/client/screens/spaces/organization-tabs";
import { ConnectedAppShell } from "@/modules/shared/ui/connected-app-shell";
import { listOrganizationRoles } from "./actions";
import { getRoleMessages } from "./messages";
import { RoleDecisionForm } from "./role-decision-form";
import { RoleRequestForm } from "./role-request-form";

function dateLabel(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-MA" : "ar-MA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function OrganizationRolesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const result = await listOrganizationRoles();
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect("/" + locale + "/connexion");
  const messages = getRoleMessages(locale);
  const c = spaceCopy(locale);
  const queryString = query.organizationId ? `?organizationId=${query.organizationId}` : "";

  if (result.status === "error") {
    return (
      <ConnectedAppShell
        locale={locale}
        organizationId={query.organizationId}
        title={messages.title}
        lead={messages.description}
        kicker={messages.eyebrow}
        clientActive="company"
        providerActive="company"
        franchiseActive="governance"
      >
        <main className="client-page" data-client-layout="roles">
          <OrganizationTabs locale={locale} query={queryString} active="people" />
          <Alert variant="destructive">
            <AlertTitle>{messages.loadErrorTitle}</AlertTitle>
            <AlertDescription>
              <p>{messages.loadError}</p>
              <Link href={"/" + locale + "/organisation/roles" + queryString} className="client-ghost-link">{messages.retry}</Link>
            </AlertDescription>
          </Alert>
        </main>
      </ConnectedAppShell>
    );
  }

  return (
    <ConnectedAppShell
      locale={locale}
      organizationId={query.organizationId}
      title={messages.title}
      lead={messages.description}
      kicker={messages.eyebrow}
      clientActive="company"
      providerActive="company"
      franchiseActive="governance"
    >
      <main className="client-page" data-client-layout="roles">
        <OrganizationTabs locale={locale} query={queryString} active="people" />
        <section className="client-board">
          <article className="client-card" id="invitations">
            <header className="client-priority-head">
              <div>
                <h2>{messages.requestTitle}</h2>
                <p>{messages.requestDescription}</p>
              </div>
              <Link href={"/" + locale + "/organisation" + queryString} className="client-ghost-link">{messages.back}</Link>
            </header>
            <RoleRequestForm locale={locale} organizations={result.organizations} idempotencyKey={randomUUID()} messages={messages} />
          </article>
          <article className="client-card" id="roles">
            <header><h2>{messages.membershipsTitle}</h2></header>
            {result.memberships.length === 0 ? <p className="client-access-note">{messages.membershipsEmpty}</p> : (
              <ul className="client-feed">
                {result.memberships.map((membership) => (
                  <li key={membership.id}>
                    <span>
                      <strong>{membership.organizationName ?? messages.unknownOrganization}</strong>
                      <small>{membership.isCurrentUser ? messages.you : messages.anotherMember}</small>
                    </span>
                    <em>{messages.membershipStatuses[membership.status]}</em>
                    {membership.roles.length > 0 ? (
                      <span>{membership.roles.map((role) => messages.roles[role]).join(" · ")}</span>
                    ) : (
                      <span>{messages.noRole}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="client-access-note">{c.accessNote}</p>
          </article>
        </section>
        <section className="client-board" aria-labelledby="requests-title">
          <article className="client-card">
            <header><h2 id="requests-title">{messages.requestsTitle}</h2></header>
            {result.requests.length === 0 ? <p className="client-access-note">{messages.requestsEmpty}</p> : (
              <ul className="client-feed">
                {result.requests.map((request) => (
                  <li key={request.id}>
                    <span>
                      <strong>{request.organizationName ?? messages.unknownOrganization}</strong>
                      <small>{request.isOwn ? messages.ownRequest : messages.memberRequest} · {messages.roles[request.requestedRole]}</small>
                      <small><time dateTime={request.createdAt}>{messages.created} {dateLabel(request.createdAt, locale)}</time></small>
                      {request.decidedAt ? <small><time dateTime={request.decidedAt}>{messages.decided} {dateLabel(request.decidedAt, locale)}</time></small> : null}
                      {request.requiresCentralApproval ? <small>{messages.centralRequired}</small> : null}
                    </span>
                    <em><Badge variant="outline">{messages.requestStatuses[request.status]}</Badge></em>
                    {request.canDecide ? (
                      <div className="provider-workbench-actions">
                        <RoleDecisionForm requestId={request.id} locale={locale} decision="APPROVE" messages={messages} />
                        <RoleDecisionForm requestId={request.id} locale={locale} decision="REJECT" messages={messages} />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>
      </main>
    </ConnectedAppShell>
  );
}

import Link from "next/link";
import { Laptop, Shield, ShieldCheck, Smartphone, UserPlus } from "lucide-react";
import type { ReactNode } from "react";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import type { AccountSecurityResult } from "@/app/[locale]/securite/compte/actions";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { MemberInviteForm } from "./member-invite-form";
import { OrganizationTabs } from "./organization-tabs";

export type SecuritySessionRow = {
  id: string;
  isCurrent: boolean;
  label: string;
  detail: string;
  lastSeen: string;
};

export type SecurityMemberRow = {
  id: string;
  name: string;
  role: string;
  status: string;
  lastSeen?: string;
};

export function SecurityBoard({
  locale,
  query,
  organizationName,
  organizationId,
  security,
  sessions,
  members,
  children,
}: {
  locale: Locale;
  query: string;
  organizationName?: string | null;
  organizationId?: string | null;
  security: Extract<AccountSecurityResult, { status: "success" }>;
  sessions: SecuritySessionRow[];
  members: SecurityMemberRow[];
  children?: ReactNode;
}) {
  const c = spaceCopy(locale);
  const mfaOn = security.factors.some((factor) => factor.status === "verified") || security.currentAal === "aal2";
  const method = security.factors.find((factor) => factor.status === "verified")?.friendlyName ?? security.currentAal.toUpperCase();
  const history = [
    {
      id: "mfa",
      title: c.mfaOn,
      detail: mfaOn ? c.obtained : c.inProgressBadge,
      tone: mfaOn ? "mint" : "peach" as const,
    },
    ...sessions.slice(0, 6).map((session) => ({
      id: session.id,
      title: session.isCurrent ? c.currentSession : session.label,
      detail: `${session.detail} · ${session.lastSeen}`,
      tone: session.isCurrent ? "mint" : "sky" as const,
    })),
  ];
  return (
    <main className="client-page" data-client-layout="security">
      <header className="client-priority-head">
        <div>
          <p className="client-access-note">{organizationName ? `${organizationName} · ${c.orgActive}` : c.orgTitle}</p>
        </div>
        <Link href={`/${locale}/organisation${query}`} className="client-ghost-link">{c.publicProfile}</Link>
        <span className="client-access-note">{c.notificationPrefs}</span>
      </header>
      <OrganizationTabs locale={locale} query={query} active="security" />
      <section className="client-board" id="securite">
        <article className="client-card">
          <header><h2>{c.accountSec}</h2></header>
          <ul className="client-feed">
            <li>
              <span className="client-feed-icon" data-tone={mfaOn ? "mint" : "peach"}>{mfaOn ? <ShieldCheck className="size-4" aria-hidden /> : <Shield className="size-4" aria-hidden />}</span>
              <span><strong>{c.mfaOn}</strong><small>{c.mfaOnLead}</small></span>
              <em>{mfaOn ? c.obtained : c.inProgressBadge}</em>
            </li>
            <li>
              <span className="client-feed-icon" data-tone="violet"><Shield className="size-4" aria-hidden /></span>
              <span><strong>{c.verificationMethod}</strong><small>{method}</small></span>
              <Link href={`/${locale}/securite/compte${query}`} className="client-text-link">{c.manageMethod}</Link>
            </li>
            <li id="telephone">
              <span className="client-feed-icon" data-tone="sky"><Smartphone className="size-4" aria-hidden /></span>
              <span><strong>{c.recoveryPhone}</strong><small>{locale === "ar" ? "يُدار مع عامل التحقق القوي أدناه" : "Géré avec le second facteur ci-dessous"}</small></span>
              <Link href={`/${locale}/securite/compte`} className="client-text-link">{c.manageMethod}</Link>
            </li>
          </ul>
        </article>
        <article className="client-card">
          <header className="client-priority-head">
            <h2>{c.activeSessions}</h2>
            <Link href={`/${locale}/securite/sessions`} className="client-text-link">{c.seeHistory}</Link>
          </header>
          {sessions.length === 0 ? <p>{locale === "ar" ? "لا جلسات ظاهرة." : "Aucune session visible."}</p> : (
            <ul className="client-feed">
              {sessions.slice(0, 4).map((session) => (
                <li key={session.id}>
                  <span className="client-feed-icon" data-tone={session.isCurrent ? "mint" : "sky"}>
                    {/iphone|android|mobile|ipad/i.test(session.label) ? <Smartphone className="size-4" aria-hidden /> : <Laptop className="size-4" aria-hidden />}
                  </span>
                  <span><strong>{session.label}</strong><small>{session.detail}</small></span>
                  <em>{session.isCurrent ? c.currentSession : session.lastSeen}</em>
                  {!session.isCurrent ? <Link href={`/${locale}/securite/sessions`} className="client-text-link">{c.revoke}</Link> : null}
                </li>
              ))}
            </ul>
          )}
          <Link href={`/${locale}/securite/sessions`} className="client-ghost-link">{c.revokeAll}</Link>
        </article>
        <article className="client-card">
          <header className="client-priority-head">
            <h2>{c.securityHistory}</h2>
            <Link href={`/${locale}/securite/sessions`} className="client-text-link">{c.seeHistory}</Link>
          </header>
          {history.length === 0 ? <p>{c.historyEmpty}</p> : (
            <ol className="client-feed">
              {history.map((item) => (
                <li key={item.id}>
                  <span className="client-feed-icon" data-tone={item.tone}><Shield className="size-4" aria-hidden /></span>
                  <span><strong>{item.title}</strong><small>{item.detail}</small></span>
                </li>
              ))}
            </ol>
          )}
        </article>
      </section>
      <section className="client-board">
        <article className="client-card">
          <header className="client-priority-head">
            <h2>{c.people}</h2>
            <Link href={`/${locale}/organisation/roles${query}`} className="client-text-link">{c.seeAllMembers}</Link>
          </header>
          {members.length === 0 ? <p>{organizationName ?? c.emptyPeople}</p> : (
            <div className="client-table-wrap">
              <table className="client-space-table">
                <thead>
                  <tr>
                    <th>{locale === "ar" ? "الاسم" : "Nom"}</th>
                    <th>{locale === "ar" ? "الدور" : "Rôle"}</th>
                    <th>{c.accessScope}</th>
                    <th>{c.lastConnection}</th>
                    <th>{c.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {members.slice(0, 6).map((member) => (
                    <tr key={member.id}>
                      <td>{member.name}</td>
                      <td>{member.role}</td>
                      <td>{member.role}</td>
                      <td>{member.lastSeen ?? "—"}</td>
                      <td><span className="client-status-chip" data-tone="mint">{member.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
        <article className="client-card" id="invitation">
          <header><h2>{c.inviteMember}</h2></header>
          <p>{c.accessNote}</p>
          <MemberInviteForm locale={locale} organizationId={organizationId ?? null} />
          <p className="client-access-note"><UserPlus className="size-4" aria-hidden /> {c.inviteNote}</p>
        </article>
      </section>
      <div id="mfa">{children}</div>
    </main>
  );
}

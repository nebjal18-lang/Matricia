import Link from "next/link";
import {
  Archive, ArrowRight, Building2, Eye, FileText, FolderKanban, KeyRound, Lock, Mail, MoreHorizontal,
  Pencil, Power, Search, Shield, ShieldCheck, UserRound, Users,
} from "lucide-react";
import type { ReactNode } from "react";
import type { SafeInvitation } from "@/app/[locale]/invitations/actions";
import { getInvitationMessages } from "@/app/[locale]/invitations/messages";
import type { AdminClientCase } from "@/modules/admin/data/clients/model";
import { actorCopy } from "@/modules/admin/data/spaces/actors-copy";
import { type ActorUserRow } from "@/modules/admin/data/spaces/actors-repository";
import { workflowStatusLabel } from "@/modules/shared/lib/i18n/workflow-statuses";
import { matchesActorUser } from "@/modules/admin/data/spaces/actor-user-model";
import { adminCopy } from "@/modules/admin/data/spaces/copy";
import type { AdminOrganizationFiche, AdminSupervisionDashboard } from "@/modules/admin/data/supervision/types";
import type { SafeComplianceCase } from "@/modules/admin/screens/conformite-clients/actions";
import { getComplianceMessages } from "@/modules/admin/screens/conformite-clients/messages";
import { ActorIntentForm } from "@/modules/admin/screens/spaces/actor-forms";
import { PipelineGlyph } from "./pipeline-step";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

function organizationQuery(query: string, organizationId: string | null) { const params=new URLSearchParams(query);if(organizationId)params.set("organizationId",organizationId);else params.delete("organizationId");const value=params.toString();return value?`?${value}`:""; }
function accountLabel(locale: Locale, row: ActorUserRow | undefined) { return row?.displayName ?? row?.email ?? (locale === "ar" ? "حساب" : "Compte"); }
function noOrganization(locale: Locale) { return locale === "ar" ? "بدون مؤسسة" : "Sans organisation"; }
function accountStatusLabel(status: string, locale: Locale) {
 const extra: Record<string,readonly[string,string]>={REVOKED:["Accès retiré","وصول مسحوب"],DELETED:["Compte supprimé","حساب محذوف"],PENDING_CONFIRMATION:["Confirmation attendue","بانتظار التأكيد"]};
 return extra[status]?.[locale==="ar"?1:0]??workflowStatusLabel(status,locale);
}
function accountLastSignIn(value: string | null | undefined, locale: Locale) {
 if(!value||!Number.isFinite(Date.parse(value)))return locale==="ar"?"غير مسجّل":"Non communiquée";
 return new Intl.DateTimeFormat(locale==="ar"?"ar-MA":"fr-MA",{dateStyle:"short",timeStyle:"short",timeZone:"Africa/Casablanca"}).format(new Date(value));
}

function Cta({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="client-ghost-link">{children}<ArrowRight className="size-4 rtl:rotate-180" aria-hidden /></Link>;
}

function statusTone(status: string): "mint" | "sky" | "peach" | "violet" {
  const key = status.toUpperCase();
  if (key === "ACTIVE" || key === "VERIFIED" || key === "TERMINE" || key === "DONE") return "mint";
  if (key === "PENDING" || key === "UNDER_REVIEW" || key === "IN_REVIEW") return "violet";
  if (key === "SUSPENDED" || key === "REJECTED" || key === "INACTIVE") return "peach";
  return "sky";
}

export function UsersBoard({
  locale,
  query,
  users,
  invites,
  search,
  filters,
  page = 1,
}: {
  locale: Locale;
  query: string;
  users: ActorUserRow[];
  invites: SafeInvitation[];
  page?: number;
  search?: string;
  filters?: { org?: string; role?: string; status?: string };
}) {
  const a = actorCopy(locale);
  const c = adminCopy(locale);
  const inviteMessages = getInvitationMessages(locale);
  const orgs = [...new Map(users.flatMap(row=>row.organizationId&&row.organizationName?[[row.organizationId,{id:row.organizationId,name:row.organizationName}] as const]:[])).values()].sort((a,b)=>a.name.localeCompare(b.name));
  const roles = [...new Set(users.flatMap((row) => [...row.roles,...(row.platformRoles??[])]))].sort();
  const statuses = [...new Set(users.map((row) => row.status))].sort();
  const filtered = users.filter(row=>matchesActorUser(row,filters,search));
  const pageCount=Math.max(1,Math.ceil(filtered.length/50));
  const currentPage=Math.min(pageCount,Math.max(1,Number.isFinite(page)?Math.floor(page):1));
  const visible=filtered.slice((currentPage-1)*50,currentPage*50);
  const pageHref=(number:number)=>{const params=new URLSearchParams(query);if(search)params.set("q",search);for(const[k,v]of Object.entries(filters??{}))if(v)params.set(k,v);params.set("page",String(number));return `/${locale}/administration/utilisateurs?${params.toString()}`;};
  return (
    <main className="client-page">
      <section className="admin-two">
        <article className="client-card">
          <header className="client-priority-head">
            <div>
              <h2><Users className="size-4" aria-hidden /> {a.usersCard}</h2>
              <Link href={`/${locale}/administration/utilisateurs/acces`}>{locale==="ar"?"مراجعات وصول الحسابات":"Revues des accès aux comptes"}</Link>
              <p>{a.usersCardLead}</p>
            </div>
          </header>
          <form className="admin-filters" method="get" action={`/${locale}/administration/utilisateurs`}>
            <label className="client-top-search">
              <Search className="size-4" aria-hidden />
              <span className="sr-only">{a.searchUsers}</span>
              <input name="q" defaultValue={search} placeholder={a.searchUsers} />
            </label>
            <label>{c.orgs}
              <select name="org" defaultValue={filters?.org ?? "all"}>
                <option value="all">{c.all}</option>
                <option value="unassigned">{noOrganization(locale)}</option>
                {orgs.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
              </select>
            </label>
            <label>{c.roles}
              <select name="role" defaultValue={filters?.role ?? "all"}>
                <option value="all">{c.all}</option>
                {roles.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </label>
            <label>{c.state}
              <select name="status" defaultValue={filters?.status ?? "all"}>
                <option value="all">{c.all}</option>
                {statuses.map((status) => <option key={status} value={status}>{accountStatusLabel(status,locale)}</option>)}
              </select>
            </label>
            <button type="submit" className="admin-soft-cta">{locale === "ar" ? "تصفية" : "Filtrer"}</button>
          </form>
          {filtered.length === 0 ? null : (
            <div className="client-table-wrap">
              <table className="client-space-table">
                <thead>
                  <tr>
                    <th>{a.user}</th>
                    <th>{a.orgActive}</th>
                    <th>{c.roles}</th>
                    <th>{c.state}</th>
                    <th>{locale==="ar"?"آخر تسجيل دخول":"Dernière connexion"}</th>
                    <th>{a.security}</th>
                    <th>{c.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr key={`${row.userId}-${row.membershipId}`}>
                      <td>
                        <span className="client-doc-cell">
                          <span className="client-avatar" data-tone="violet">{accountLabel(locale,row).slice(0,1)}</span>
                          <span>
                            <strong>{accountLabel(locale,row)}</strong>
                            <small dir="ltr">{row.email??row.userId.slice(0,8)}</small>
                          </span>
                        </span>
                      </td>
                      <td>{row.organizationName??noOrganization(locale)}</td>
                      <td><span className="client-status-chip" data-tone="violet">{[...row.roles,...(row.platformRoles??[])].join(" · ") || "—"}</span></td>
                      <td><span className="client-status-chip" data-tone={statusTone(row.accountStatus??row.status)}>{accountStatusLabel(row.accountStatus??row.status,locale)}</span></td>
                      <td dir="ltr">{accountLastSignIn(row.lastSignInAt,locale)}</td>
                      <td><ShieldCheck className="size-4" aria-hidden /> {row.mfaStatus === "ENABLED" ? (locale === "ar" ? "مفعّلة" : "Activée") : row.mfaStatus === "DISABLED" ? (locale === "ar" ? "غير مفعّلة" : "Non activée") : a.notShown}</td>
                      <td>
                        <details className="admin-row-menu">
                          <summary aria-label={c.actions}><MoreHorizontal className="size-4" /></summary>
                          <div>
                            <Link href={`/${locale}/administration/utilisateurs/${row.userId}${organizationQuery(query,row.organizationId)}`}><Eye className="size-3.5" aria-hidden />{c.consult}</Link>
                            <Link href={`/${locale}/administration/utilisateurs/${row.userId}/roles${organizationQuery(query,row.organizationId)}`}><Pencil className="size-3.5" aria-hidden />{a.editRoles}</Link>
                            {row.organizationId?<Link href={`/${locale}/administration/entreprises/${row.organizationId}${query}`}><Building2 className="size-3.5" aria-hidden />{c.orgs}</Link>:null}
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filtered.length ? <nav aria-label={locale==="ar"?"صفحات المستخدمين":"Pages des utilisateurs"}className="flex flex-wrap items-center gap-3"><span>{currentPage} / {pageCount} · {filtered.length}</span>{currentPage>1?<Link href={pageHref(currentPage-1)}>{locale==="ar"?"السابق":"Précédent"}</Link>:null}{currentPage<pageCount?<Link href={pageHref(currentPage+1)}>{locale==="ar"?"التالي":"Suivant"}</Link>:null}</nav>:null}
          {filtered.length === 0 ? (
            <div className="admin-empty-card">
              <UserRound className="size-6" aria-hidden />
              <h3>{a.noUser}</h3>
              <p>{a.noUserLead}</p>
              <Link href={`/${locale}/administration/utilisateurs`} className="client-ghost-link">{c.reset}</Link>
            </div>
          ) : null}
        </article>
        <aside className="client-card">
          <h2><Mail className="size-4" aria-hidden /> {a.pendingInvites}</h2>
          <p>{a.pendingInvitesLead}</p>
          <ul className="client-feed">
            {invites.length === 0 ? <li><span>{inviteMessages.managedEmpty}</span></li> : invites.slice(0, 6).map((invite) => (
              <li key={invite.id}>
                <span className="client-feed-icon" data-tone="violet"><Mail className="size-4" aria-hidden /></span>
                <span>
                  <strong>{invite.organizationName ?? inviteMessages.unknownOrganization}</strong>
                  <small>{invite.roles[0] ? inviteMessages.roles[invite.roles[0]] : inviteMessages.noRoles}</small>
                </span>
                <ActorIntentForm locale={locale} resourceId={invite.id} resourceType="INVITATION" intent="CHANGE_CONFIGURATION" reason="Renvoi d’invitation demandé depuis l’administration." label={a.resend} />
                <ActorIntentForm locale={locale} resourceId={invite.id} resourceType="INVITATION" intent="RESTRICT_ENTITY" reason="Annulation d’invitation demandée depuis l’administration." label={a.cancelInvite} />
              </li>
            ))}
          </ul>
          <p className="admin-note">{a.invitePolicy}</p><Link href={`/${locale}/invitations`}>{locale==="ar"?"عرض كل الدعوات":"Voir toutes les invitations"}</Link>
        </aside>
      </section>
      <section className="admin-three">
        <article className="client-card admin-span-2">
          <h2><Shield className="size-4" aria-hidden /> {a.accessControls}</h2>
          <p>{a.accessControlsLead}</p>
          <div className="admin-two">
            <div>
              <h3>{a.sepOrgs}</h3>
              <p>{a.sepOrgsLead}</p>
            </div>
            <div>
              <h3>{a.leastPriv}</h3>
              <p>{a.leastPrivLead}</p>
            </div>
          </div>
        </article>
        {filtered.length === 0 ? (
          <>
            <article className="admin-empty-card">
              <UserRound className="size-6" aria-hidden />
              <h3>{a.noUser}</h3>
              <p>{a.noUserLead}</p>
              <Link href={`/${locale}/administration/utilisateurs`} className="client-ghost-link">{c.reset}</Link>
            </article>
            <article className="admin-empty-card">
              <Lock className="size-6" aria-hidden />
              <h3>{a.forbiddenSection}</h3>
              <p>{a.forbiddenSectionLead}</p>
              <Link href={`/${locale}/administration/command-center${query}`} className="client-ghost-link">{a.home}</Link>
            </article>
          </>
        ) : null}
      </section>
    </main>
  );
}

export function UserFicheBoard({
  locale,
  query,
  userId,
  rows,
  fiche,
}: {
  locale: Locale;
  query: string;
  userId: string;
  rows: ActorUserRow[];
  fiche: AdminOrganizationFiche | null;
}) {
  const a = actorCopy(locale);
  const c = adminCopy(locale);
  const primary = rows[0];
  const orgName = primary?.organizationName ?? noOrganization(locale);
  const memberships=rows.filter(row=>row.membershipId!==null&&row.organizationId!==null);
  const base = `/${locale}/administration/utilisateurs/${userId}`;
  return (
    <main className="client-page">
      <section className="admin-two">
        <div className="client-stack">
          <article className="client-card">
            <div className="admin-user-hero">
              <span className="client-avatar" data-tone="violet">{orgName.slice(0, 1)}</span>
              <div>
                <h2>{a.userFiche} — {accountLabel(locale,primary)}</h2>
                <p>{primary?.email??a.userFicheLead}</p>
              </div>
              <span className="admin-status">{accountStatusLabel(primary?.accountStatus??primary?.status??"UNKNOWN",locale)}</span>
            </div>
          </article>
          <nav className="client-tabs" aria-label={c.overview}>
            <a href={`${base}${query}`}>{c.overview}</a>
            <a href={`${base}${query}#organisations`} aria-current="page">{a.orgsRoles}</a>
            <a href={`${base}${query}#securite-compte`}>{a.sessions}</a>
            <a href={`${base}${query}#invitations`}>{c.invites}</a>
            <a href={`/${locale}/administration/operations${query}`}>{c.audit}</a>
          </nav>
          <article className="client-card" id="organisations">
            <header><h2>{a.memberOrgs}</h2><p>{a.memberOrgsLead}</p></header>
            {memberships.length===0?<p>{noOrganization(locale)}</p>:null}
            <ul className="client-feed">
              {memberships.map((row) => (
                <li key={row.membershipId}>
                  <span className="client-feed-icon" data-tone="violet"><Building2 className="size-4" aria-hidden /></span>
                  <span><strong>{row.organizationName}</strong><small>{a.memberSince}</small></span>
                  <span className="client-status-chip" data-tone={statusTone(row.status)}>{accountStatusLabel(row.status,locale)}</span>
                  <Cta href={`/${locale}/administration/entreprises/${row.organizationId}${query}`}>{c.open}</Cta>
                </li>
              ))}
            </ul>
          </article>
          <article className="client-card">
            <header><h2>{a.userRoles}</h2><p>{a.userRolesLead}</p></header>
            <ul className="client-feed">
              {memberships.map((row) => (
                <li key={`${row.membershipId}-role`}>
                  <span className="client-feed-icon" data-tone="violet"><UserRound className="size-4" aria-hidden /></span>
                  <span><strong>{row.roles.join(" · ") || "—"}</strong><small>{row.organizationName}</small></span>
                  <span className="client-status-chip" data-tone={statusTone(row.status)}>{accountStatusLabel(row.status,locale)}</span>
                  <Cta href={`${base}/roles${query}`}>{a.editRoles}</Cta>
                </li>
              ))}
            </ul>
          </article>
          <article className="client-card"><h2>{locale==="ar"?"أدوار المنصة":"Rôles plateforme"}</h2><p>{primary?.platformRoles?.join(" · ")||"—"}</p><p>{locale==="ar"?"حالة الحساب":"État du compte"} : {accountStatusLabel(primary?.accountStatus??primary?.status??"UNKNOWN",locale)}</p></article>
          <article className="client-card">
            <header><h2>{a.associatedCaps}</h2><p>{a.associatedCapsLead}</p></header>
            <div className="admin-cap-pills">
              {[...(primary?.roles??[]),...(primary?.platformRoles??[])].map((role) => <span key={role}>{role}</span>)}
            </div>
          </article>
          <article className="client-card">
            <header><h2>{a.explicitPerimeters}</h2></header>
            <div className="admin-two">
              <div>
                <h3>{a.orgPerimeter}</h3>
                <p>{orgName}</p>
                <small>{a.orgPerimeterLead}</small>
              </div>
              <div>
                <h3>{a.funcPerimeter}</h3>
                <p>{[...(primary?.roles??[]),...(primary?.platformRoles??[])].join(" · ") || "—"}</p>
                <small>{a.funcPerimeterLead}</small>
              </div>
            </div>
            <p className="admin-note">{a.noCrossLead}</p>
          </article>
        </div>
        <aside className="client-stack">
          <article className="client-card">
            <h2 id="securite-compte"><Shield className="size-4" aria-hidden /> {a.securityControls}</h2>
            <ul className="admin-security">
              <li><span><Lock className="size-4" aria-hidden /> {a.mfa}</span><span className="client-status-chip" data-tone={primary?.mfaStatus === "ENABLED" ? "mint" : "peach"}>{primary?.mfaStatus === "ENABLED" ? (locale === "ar" ? "مفعّلة" : "Activée") : primary?.mfaStatus === "DISABLED" ? (locale === "ar" ? "غير مفعّلة" : "Non activée") : a.notShown}</span></li>
              <li><span>{a.sessionStatus}</span><span className="client-status-chip" data-tone="sky">{primary?.sessionCount ?? a.notShown}</span></li>
              <li><span>{a.roleRevocation}</span><span className="client-status-chip" data-tone="violet">{a.available}</span></li>
              <li><span>{a.noCross}</span><span className="client-status-chip" data-tone="sky">{a.notShown}</span></li>
            </ul>
          </article>
          <article className="client-card">
            <h2>{c.actions}</h2>
            <div className="admin-empty-actions">
              <Link href={`${base}/roles${query}`} className="admin-primary-cta">{a.editRoles}</Link>
              {primary?.organizationId?<ActorIntentForm locale={locale} organizationId={primary.organizationId} resourceId={userId} resourceType="SESSION" intent="RESTRICT_ENTITY" reason="Révocation de sessions demandée depuis la fiche utilisateur." label={a.revokeSession} tone="danger" />:null}
              {primary?.organizationId?<ActorIntentForm locale={locale} organizationId={primary.organizationId} resourceId={userId} resourceType="MEMBERSHIP" intent="SUSPEND_ENTITY" reason="Suspension d’accès demandée depuis la fiche utilisateur." label={a.suspendAccount} tone="danger" />:null}
            </div>
          </article>
          <article className="client-card">
            <h2>{a.auditHistory}</h2>
            <ul className="admin-history">
              {(fiche?.timeline ?? []).slice(0, 5).map((item) => (
                <li key={item.ref}><span className="client-history-dot" data-tone="violet" /><span><strong>{item.label}</strong><small dir="ltr">{item.at?.slice(0, 16) ?? "—"}</small></span></li>
              ))}
              {(fiche?.timeline.length ?? 0) === 0 ? <li><span>{c.lastChangeLead}</span></li> : null}
            </ul>
            <Cta href={`/${locale}/administration/operations${query}`}>{a.seeHistory}</Cta>
          </article>
        </aside>
      </section>
    </main>
  );
}

export function ClientsBoard({
  locale,
  query,
  organizations,
  cases,
  diagnostics,
  search,
  filters,
}: {
  locale: Locale;
  query: string;
  organizations: AdminSupervisionDashboard["organizations"];
  cases: AdminClientCase[];
  diagnostics: AdminSupervisionDashboard["diagnostics"];
  search?: string;
  filters?: { status?: string; compliance?: string };
}) {
  const a = actorCopy(locale);
  const c = adminCopy(locale);
  const statuses = [...new Set(organizations.map((org) => org.status))].sort();
  const complianceStatuses = [...new Set(cases.map((item) => item.status))].sort();
  const filtered = organizations.filter((org) => {
    if (filters?.status && filters.status !== "all" && org.status !== filters.status) return false;
    if (filters?.compliance && filters.compliance !== "all") {
      const compliance = cases.find((item) => item.organizationName === org.display_name);
      if ((compliance?.status ?? "NONE") !== filters.compliance) return false;
    }
    return !search || `${org.display_name} ${org.legal_name}`.toLowerCase().includes(search.toLowerCase());
  });
  const actionItems = [
    ...cases.filter((item) => item.status !== "VERIFIED").slice(0, 2).map((item) => ({ id: item.id, title: item.organizationName, detail: item.status, href: `/${locale}/administration/conformite-clients${query}`, tone: "peach" as const })),
    ...organizations.filter((org) => org.open_disputes > 0 || org.open_requests > 0).slice(0, 3).map((org) => ({ id: org.id, title: org.display_name, detail: org.open_disputes > 0 ? c.lastDispute : c.lastOpenRequest, href: `/${locale}/administration/clients/${org.id}${query}`, tone: "sky" as const })),
  ];
  const journey = [
    { label: locale === "ar" ? "التسجيل" : "Inscription", detail: a.done, tone: "violet" },
    { label: c.orgStep, detail: c.orgTitle, tone: "violet" },
    { label: c.compliance, detail: a.inReview, tone: "mint" },
    { label: a.diagnostic, detail: a.ongoing, tone: "peach" },
    { label: c.requests, detail: a.ongoing, tone: "violet" },
    { label: c.missions, detail: a.ongoing, tone: "violet" },
  ];
  return (
    <main className="client-page">
      <section className="admin-two">
        <article className="client-card">
          <form className="admin-filters" method="get" action={`/${locale}/administration/clients`}>
            <label>{c.compliance}
              <select name="compliance" defaultValue={filters?.compliance ?? "all"}>
                <option value="all">{c.all}</option>
                {complianceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label>{c.state}
              <select name="status" defaultValue={filters?.status ?? "all"}>
                <option value="all">{c.all}</option>
                {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label className="client-top-search">
              <Search className="size-4" aria-hidden />
              <span className="sr-only">{c.searchList}</span>
              <input name="q" defaultValue={search} placeholder={c.searchList} />
            </label>
            <button type="submit" className="admin-soft-cta">{locale === "ar" ? "تصفية" : "Filtrer"}</button>
          </form>
          {filtered.length === 0 ? null : (
            <div className="client-table-wrap">
              <table className="client-space-table">
                <thead>
                  <tr>
                    <th>{c.kindClient}</th>
                    <th>{a.onboarding}</th>
                    <th>{c.compliance}</th>
                    <th>{a.diagnostic}</th>
                    <th>{c.requests}</th>
                    <th>{c.plan}</th>
                    <th>{c.state}</th>
                    <th>{c.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((org) => {
                    const compliance = cases.find((item) => item.organizationName === org.display_name);
                    const diagnostic = diagnostics.find((item) => item.organization_id === org.id);
                    return (
                      <tr key={org.id}>
                        <td>
                          <span className="client-doc-cell">
                            <span className="client-avatar" data-tone="violet">{org.display_name.slice(0, 1)}</span>
                            {org.display_name}
                          </span>
                        </td>
                        <td><span className="client-status-chip" data-tone="mint">{a.done}</span></td>
                        <td><span className="client-status-chip" data-tone={compliance && compliance.status !== "VERIFIED" ? "peach" : "mint"}>{compliance?.status ?? c.complianceOk}</span></td>
                        <td><span className="client-status-chip" data-tone={diagnostic ? "mint" : "sky"}>{diagnostic?.status ?? a.notStarted}</span></td>
                        <td>{org.open_requests}</td>
                        <td><span className="client-status-chip" data-tone="violet">{c.unknownPlan}</span></td>
                        <td><span className="client-status-chip" data-tone={statusTone(org.status)}>{org.status}</span></td>
                        <td>
                          <details className="admin-row-menu">
                            <summary aria-label={c.actions}><MoreHorizontal className="size-4" /></summary>
                            <div>
                              <Link href={`/${locale}/administration/clients/${org.id}${query}`}><Eye className="size-3.5" aria-hidden />{c.consult}</Link>
                              <Link href={`/${locale}/administration/entreprises/${org.id}/modifier${query}`}><Pencil className="size-3.5" aria-hidden />{c.edit}</Link>
                              <Link href={`/${locale}/administration/entreprises/${org.id}/archiver${query ? `${query}&mode=disable` : "?mode=disable"}`}><Power className="size-3.5" aria-hidden />{c.disable}</Link>
                              <Link href={`/${locale}/administration/entreprises/${org.id}/archiver${query}`} data-tone="peach"><Archive className="size-3.5" aria-hidden />{c.archive}</Link>
                            </div>
                          </details>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {filtered.length === 0 ? (
            <div className="admin-empty-card">
              <FolderKanban className="size-6" aria-hidden />
              <h3>{a.noClient}</h3>
              <p>{a.noClientLead}</p>
              <Link href={`/${locale}/administration/clients`} className="client-ghost-link">{c.reset}</Link>
            </div>
          ) : null}
        </article>
        <aside className="client-card admin-treat-rail">
          <h2>{a.clientNeeds}</h2>
          <ul className="client-feed">
            {actionItems.length === 0 ? <li><span>{a.noRequiredLead}</span></li> : actionItems.map((item) => (
              <li key={item.id}>
                <span className="client-feed-icon" data-tone={item.tone}><FileText className="size-4" aria-hidden /></span>
                <span><strong>{item.title}</strong><small>{item.detail}</small></span>
                <Cta href={item.href}>{c.open}</Cta>
              </li>
            ))}
          </ul>
          <Cta href={`/${locale}/administration/clients${query}`}>{a.seeAllClients}</Cta>
        </aside>
      </section>
      <article className="client-card">
        <h2>{a.clientJourney}</h2>
        <ol className="admin-pipeline">
          {journey.map((step, index) => (
            <li key={step.label}>
              <PipelineGlyph index={index} tone={step.tone as "mint" | "sky" | "peach" | "violet"} />
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </li>
          ))}
        </ol>
      </article>
      {filtered.length === 0 ? (
        <section className="admin-two">
          <article className="admin-empty-card">
            <FolderKanban className="size-6" aria-hidden />
            <h3>{a.noClient}</h3>
            <p>{a.noClientLead}</p>
            <Link href={`/${locale}/administration/clients`} className="client-ghost-link">{c.reset}</Link>
          </article>
          <article className="admin-empty-card">
            <Lock className="size-6" aria-hidden />
            <h3>{a.forbiddenSection}</h3>
            <p>{a.forbiddenSectionLead}</p>
            <Link href={`/${locale}/administration/command-center${query}`} className="client-ghost-link">{a.home}</Link>
          </article>
        </section>
      ) : null}
    </main>
  );
}

export function ClientFicheBoard({
  locale,
  query,
  fiche,
}: {
  locale: Locale;
  query: string;
  fiche: AdminOrganizationFiche;
}) {
  const a = actorCopy(locale);
  const c = adminCopy(locale);
  const org = fiche.organization;
  const base = `/${locale}/administration/clients/${org.id}`;
  const compliance = org.client_compliance_snapshot;
  const profile = org.client_legal_profile;
  return (
    <main className="client-page">
      <nav className="client-tabs" aria-label={c.overview}>
        <a href={`${base}${query}`} aria-current="page">{c.overview}</a>
        <a href={`/${locale}/administration/entreprises/${org.id}/modifier${query}`}>{locale === "ar" ? "ملف المؤسسة" : "Profil entreprise"}</a>
        <a href={`/${locale}/administration/conformite-clients${query}`}>{c.compliance}</a>
        <a href={`/${locale}/administration/parcours${query}`}>{locale === "ar" ? "المسارات" : "Parcours"}</a>
        <a href={`/${locale}/administration/finance${query}`}>{c.boxes}</a>
        <a href={`/${locale}/administration/finance${query}`}>{c.navFinance}</a>
        <a href={`/${locale}/administration/operations${query}`}>{c.audit}</a>
      </nav>
      <section className="admin-fiche-grid">
        <article className="client-card">
          <header><h2>{a.onboardingState}</h2></header>
          <ol className="admin-journey">
            {[{ label: locale === "ar" ? "التسجيل" : "Inscription", state: "done" }, { label: locale === "ar" ? "الملف" : "Profil", state: profile ? "done" : compliance ? "current" : "pending" }, { label: c.compliance, state: compliance?.currently_verified ? "done" : compliance ? "current" : "pending" }, { label: locale === "ar" ? "التفعيل" : "Activation", state: org.status === "ACTIVE" && compliance?.currently_verified ? "done" : "pending" }].map((step) => (
              <li key={step.label} data-state={step.state}><i aria-hidden /><span>{step.label}</span></li>
            ))}
          </ol>
          <Cta href={`/${locale}/administration/parcours${query}`}>{a.seeOnboarding}</Cta>
        </article>
        <article className="client-card">
          <header><h2>{a.companyInfo}</h2></header>
          <dl className="admin-dl">
            <div><dt>{c.legal}</dt><dd>{org.legal_name}</dd></div>
            <div><dt>{c.legalForm}</dt><dd>{profile?.legal_form ?? "—"}</dd></div>
            <div><dt>{c.activity}</dt><dd>{profile?.activity ?? "—"}</dd></div>
            <div><dt>{locale === "ar" ? "البلد" : "Pays"}</dt><dd>{org.country_code}</dd></div>
          </dl>
          <Cta href={`/${locale}/administration/entreprises/${org.id}/modifier${query}`}>{a.seeProfile}</Cta>
        </article>
        <article className="client-card">
          <header><h2>{c.compliance}</h2></header>
          <dl className="admin-dl">
            <div><dt>{c.state}</dt><dd>{org.status}</dd></div>
            <div><dt>KYC</dt><dd>{compliance?.status ?? "—"}</dd></div>
            <div><dt>{c.documents}</dt><dd>{compliance?.document_count ?? "—"}</dd></div>
          </dl>
          <Cta href={`/${locale}/administration/conformite-clients${query}`}>{a.seeCompliance}</Cta>
        </article>
        <article className="client-card">
          <header><h2>{locale === "ar" ? "إجراءات الامتثال المطلوبة" : "Actions de conformité requises"}</h2></header>
          {compliance ? compliance.required_actions.length ? <ul className="client-feed">{compliance.required_actions.map((action)=><li key={action.id}><span>{locale === "ar" ? action.label_ar : action.label_fr}</span></li>)}</ul> : <p>{locale === "ar" ? "لا توجد عوائق أو أسئلة امتثال مفتوحة في هذا الملف." : "Aucune anomalie bloquante ni question de conformité ouverte dans ce dossier."}</p> : <p>{locale === "ar" ? "ملف الامتثال غير متاح." : "Dossier de conformité non disponible."}</p>}
          <Cta href={compliance ? `/${locale}/administration/conformite-clients/${compliance.case_id}${query}` : `/${locale}/administration/conformite-clients${query}`}>{locale === "ar" ? "فتح ملف الامتثال" : "Ouvrir le dossier de conformité"}</Cta>
        </article>
        <article className="client-card">
          <header><h2>{a.dossierActivity}</h2></header>
          <ul className="client-feed">
            {fiche.timeline.slice(0, 4).map((item) => <li key={item.ref}><span><strong>{item.label}</strong><small dir="ltr">{item.at?.slice(0, 16) ?? "—"}</small></span></li>)}
            {fiche.timeline.length === 0 ? <li><span>{c.lastChangeLead}</span></li> : null}
          </ul>
          <Cta href={`/${locale}/administration/operations${query}`}>{a.seeActivity}</Cta>
        </article>
      </section>
      <section className="admin-fiche-lower">
        <article className="client-card" id="documents">
          <header><h2>{c.documents}</h2></header>
          <ul className="client-feed">
            <li><span><strong>{c.state}</strong><small>{org.status}</small></span></li>
            <li><span><strong>{c.ids}</strong><small dir="ltr">{org.id.slice(0, 8)}…</small></span></li>
          </ul>
          <Cta href={compliance ? `/${locale}/administration/conformite-clients/${compliance.case_id}${query}` : `/${locale}/administration/conformite-clients${query}`}>{a.manageDocs}</Cta>
        </article>
        <article className="client-card">
          <header><h2>{c.requests}</h2></header>
          <ul className="client-feed">
            <li><span><strong>{locale === "ar" ? "الطلبات المسجلة" : "Demandes enregistrées"}</strong><small>{fiche.client_request_count ?? "—"}</small></span></li>
            <li><span><strong>{locale === "ar" ? "النزاعات المعروضة" : "Litiges visibles"}</strong><small>{fiche.disputes.length}</small></span></li>
          </ul>
          <Cta href={`/${locale}/administration/parcours${query}`}>{a.seeRequests}</Cta>
        </article>
        <article className="client-card">
          <header><h2>{c.boxes}</h2></header>
          <ul className="client-feed">
            <li><span><strong>{c.plan}</strong><small>{fiche.subscriptions[0]?.status ?? "—"}</small></span></li>
            <li><span><strong>{c.nextBill}</strong><small>{fiche.subscriptions[0]?.current_period_end ?? "—"}</small></span></li>
          </ul>
          <Cta href={`/${locale}/administration/finance${query}`}>{a.managePlan}</Cta>
        </article>
        <article className="client-card">
          <header><h2>{c.audit}</h2></header>
          <ul className="client-feed">
            <li><span><strong>{c.lastChange}</strong><small>{fiche.organization.updated_at?.slice(0, 16) ?? "—"}</small></span></li>
            <li><span><strong>{c.actor}</strong><small>{c.actorYou}</small></span></li>
          </ul>
          <Cta href={`/${locale}/administration/operations${query}`}>{c.seeAudit}</Cta>
        </article>
      </section>
      <p className="admin-note"><strong>{a.completeDossier}</strong> {a.completeDossierLead}</p>
    </main>
  );
}

export function ComplianceBoard({
  locale,
  query,
  cases,
  filter,
  serverCounts,
}: {
  locale: Locale;
  query: string;
  cases: SafeComplianceCase[];
  filter?: string;
  serverCounts?: Record<"all"|"check"|"complement"|"review"|"decided", number>;
}) {
  const a = actorCopy(locale);
  const c = adminCopy(locale);
  const messages = getComplianceMessages(locale);
  const counts = serverCounts ?? {
    all: cases.length,
    check: cases.filter((item) => item.status === "DOCUMENTS_REQUIRED" || item.status === "UNDER_REVIEW").length,
    complement: cases.filter((item) => item.status === "QUESTION_REQUIRED").length,
    review: cases.filter((item) => item.status === "UNDER_REVIEW" || item.status === "RESPONSE_RECEIVED").length,
    decided: cases.filter((item) => item.status === "VERIFIED" || item.status === "REJECTED").length,
  };
  const visible = cases.filter((item) => {
    if (!filter || filter === "all") return true;
    if (filter === "check") return item.status === "DOCUMENTS_REQUIRED" || item.status === "UNDER_REVIEW";
    if (filter === "complement") return item.status === "QUESTION_REQUIRED";
    if (filter === "review") return item.status === "UNDER_REVIEW" || item.status === "RESPONSE_RECEIVED";
    if (filter === "decided") return item.status === "VERIFIED" || item.status === "REJECTED";
    return true;
  });
  const pills = [
    { id: "all", label: `${c.all} (${counts.all})` },
    { id: "check", label: `${a.toCheck} (${counts.check})` },
    { id: "complement", label: `${a.complement} (${counts.complement})` },
    { id: "review", label: `${a.inReview} (${counts.review})` },
    { id: "decided", label: `${a.decided} (${counts.decided})` },
  ];
  const risk = (item: SafeComplianceCase) => item.anomalies.some((anomaly) => anomaly.severity === "CRITICAL") ? a.high : item.anomalies.length > 0 ? a.medium : a.low;
  const pipeline = [
    { label: a.deposit, lead: a.depositLead, tone: "mint" },
    { label: a.control, lead: a.controlLead, tone: "violet" },
    { label: a.complementStep, lead: a.complementLead, tone: "peach" },
    { label: a.review, lead: a.reviewLead, tone: "violet" },
    { label: a.decision, lead: a.decisionLead, tone: "mint" },
  ];
  const treat = cases.filter((item) => item.status !== "VERIFIED" && item.status !== "REJECTED").slice(0, 7);
  const qs = query ? `${query}&filter=` : "?filter=";
  return (
    <main className="client-page">
      <section className="admin-two">
        <article className="client-card">
          <nav className="admin-pills" aria-label={a.complianceTitle}>
            {pills.map((pill) => (
              <Link key={pill.id} href={`/${locale}/administration/conformite-clients${qs}${pill.id}`} aria-current={!filter && pill.id === "all" || filter === pill.id ? "page" : undefined}>{pill.label}</Link>
            ))}
          </nav>
          {visible.length === 0 ? <p>{messages.empty}</p> : (
            <div className="client-table-wrap">
              <table className="client-space-table">
                <thead>
                  <tr>
                    <th>{c.kindClient}</th>
                    <th>{a.pieces}</th>
                    <th>{c.state}</th>
                    <th>{a.risk}</th>
                    <th>{a.nextAction}</th>
                    <th>{c.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="client-doc-cell">
                          <span className="client-avatar" data-tone="violet">{(item.organizationName ?? "M").slice(0, 1)}</span>
                          {item.organizationName ?? messages.unknownOrganization}
                        </span>
                      </td>
                      <td>{item.evidence.length > 0 ? item.evidence.map((evidence) => messages.evidenceTypes[evidence.type]).join(" · ") : messages.noEvidence}</td>
                      <td><span className="client-status-chip" data-tone={statusTone(item.status)}>{messages.statuses[item.status]}</span></td>
                      <td><span className="client-status-chip" data-tone={risk(item) === a.high ? "peach" : risk(item) === a.medium ? "sky" : "mint"}>{risk(item)}</span></td>
                      <td>{item.status === "QUESTION_REQUIRED" ? a.askComplement : a.decision}</td>
                      <td>
                        <Link href={`/${locale}/administration/conformite-clients/${item.id}${query}`} className="admin-soft-cta">{c.open}</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
        <aside className="client-card admin-treat-rail">
          <header className="client-priority-head"><h2>{a.toTreat}</h2><Link href={`/${locale}/administration/conformite-clients${query}`}>{a.treatAll}</Link></header>
          <ul className="client-feed">
            {treat.length === 0 ? <li><span>{messages.empty}</span></li> : treat.map((item) => (
              <li key={item.id}>
                <span className="client-feed-icon" data-tone="peach"><FileText className="size-4" aria-hidden /></span>
                <span><strong>{item.organizationName ?? messages.unknownOrganization}</strong><small>{messages.statuses[item.status]}</small></span>
                <Cta href={`/${locale}/administration/conformite-clients/${item.id}${query}`}>{c.open}</Cta>
              </li>
            ))}
          </ul>
        </aside>
      </section>
      <section className="admin-two">
        <article className="client-card">
          <h2>{a.complianceJourney}</h2>
          <ol className="admin-pipeline">
            {pipeline.map((step, index) => (
              <li key={step.label}>
                <PipelineGlyph index={index} tone={step.tone as "mint" | "sky" | "peach" | "violet"} />
                <strong>{step.label}</strong>
                <small>{step.lead}</small>
              </li>
            ))}
          </ol>
        </article>
        <article className="client-card">
          <h2><KeyRound className="size-4" aria-hidden /> {a.trace}</h2>
          <p>{a.traceLead}</p>
          <Cta href={`/${locale}/administration/operations${query}`}>{a.seeAudit}</Cta>
        </article>
      </section>
    </main>
  );
}

export function ComplianceDecisionBoard({
  locale,
  query,
  item,
  form,
}: {
  locale: Locale;
  query: string;
  item: SafeComplianceCase;
  form: ReactNode;
}) {
  const a = actorCopy(locale);
  const c = adminCopy(locale);
  const messages = getComplianceMessages(locale);
  return (
    <main className="client-page">
      <article className="client-card">
        <div className="admin-user-hero">
          <span className="client-avatar" data-tone="violet">{(item.organizationName ?? "M").slice(0, 1)}</span>
          <div>
            <h2>{item.organizationName ?? messages.unknownOrganization}</h2>
            <p>{c.kindClient} · {messages.profileVersion} {item.profileVersion ?? messages.noProfile}</p>
          </div>
          <span className="admin-status">{messages.statuses[item.status]}</span>
          <Link href={`/${locale}/administration/clients${query}`} className="admin-soft-cta">{a.seeDossier}</Link>
        </div>
        <dl className="admin-hero-meta">
          <div><strong>{locale === "ar" ? "أُنشئ" : "Créé le"}</strong>{item.createdAt.slice(0, 16)}</div>
          <div><strong>{messages.updated}</strong>{item.updatedAt.slice(0, 16)}</div>
          <div><strong>{locale === "ar" ? "المرحلة" : "Étape actuelle"}</strong>{messages.statuses[item.status]}</div>
        </dl>
      </article>
      <div className="admin-banner" data-tone="danger">
        <strong>{a.staleDossier}</strong>
        <Link href={`/${locale}/administration/conformite-clients/${item.id}${query}`} className="admin-soft-cta">{a.refreshDossier}</Link>
      </div>
      <section className="admin-two">
        <div className="client-stack">
          <article className="client-card">
            <header><h2>{a.dossierDocs}</h2></header>
            <div className="client-table-wrap">
              <table className="client-space-table">
                <thead>
                  <tr>
                    <th>{c.documents}</th>
                    <th>{c.type}</th>
                    <th>{a.docDate}</th>
                    <th>{c.state}</th>
                    <th>{c.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {item.evidence.length === 0 ? (
                    <tr><td colSpan={5}>{messages.noEvidence}</td></tr>
                  ) : item.evidence.map((evidence, index) => (
                    <tr key={`${evidence.type}-${index}`}>
                      <td>{messages.evidenceTypes[evidence.type]}</td>
                      <td>{evidence.type}</td>
                      <td>{item.updatedAt.slice(0, 10)}</td>
                      <td><span className="client-status-chip" data-tone={evidence.status === "VERIFIED" ? "mint" : "peach"}>{messages.evidenceStatuses[evidence.status]}</span></td>
                      <td><Link href={`/${locale}/administration/conformite-clients/${item.id}${query}`}>{c.consult}</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          <article className="client-card">
            <header><h2>{a.decisionTitle}</h2></header>
            {form}
            <p className="admin-note"><strong>{a.important}</strong> {a.i1} {a.i2}</p>
          </article>
        </div>
        <aside className="client-stack">
          <article className="client-card">
            <h2>{a.decisionImpact}</h2>
            <dl className="admin-dl">
              <div><dt>{a.clientStatus}</dt><dd>{messages.statuses[item.status]}</dd></div>
              <div><dt>{a.journeyAccess}</dt><dd>{item.status === "VERIFIED" ? a.available : a.waiting}</dd></div>
              <div><dt>{a.financeElig}</dt><dd>{c.restrictedValue}</dd></div>
              <div><dt>{a.surveillance}</dt><dd>{item.anomalies.some((anomaly) => anomaly.blocking) ? a.high : a.low}</dd></div>
            </dl>
          </article>
          <article className="client-card">
            <h2>{a.fourEyes}</h2>
            <p>{a.fourEyesLead}</p>
            <ol className="admin-four-steps">
              <li><i>1</i><span><strong>{a.yourDecision}</strong><small>{a.waiting}</small></span></li>
              <li><i>2</i><span><strong>{a.peer}</strong><small>{a.waiting}</small></span></li>
              <li><i>3</i><span><strong>{a.finalized}</strong><small>{a.afterValidation}</small></span></li>
            </ol>
          </article>
          <article className="admin-note">
            <strong>{a.readOnlyAudit}</strong>
            <p>{a.readOnlyAuditLead}</p>
          </article>
        </aside>
      </section>
    </main>
  );
}

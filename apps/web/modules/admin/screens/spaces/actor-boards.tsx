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
import { groupActorAccounts, matchesActorUser } from "@/modules/admin/data/spaces/actor-user-model";
import { actorAccountSubtitle, actorAccountTitle, actorAvatarInitial, actorMembershipOrganizationsLabel, actorMembershipRolesLabel, actorOrganizationLabel, actorRolesLabel, actorScopeLabels, adminFixturesHiddenLabel, isAdminDirectoryFixture, isAdminOrgDirectoryFixture } from "@/modules/admin/data/spaces/actor-presentation";
import { adminCopy } from "@/modules/admin/data/spaces/copy";
import { localizeStatus } from "@/modules/admin/data/spaces/view-model";
import type { AdminOrganizationFiche, AdminSupervisionDashboard } from "@/modules/admin/data/supervision/types";
import type { SafeComplianceCase } from "@/modules/admin/screens/conformite-clients/actions";
import { getComplianceMessages } from "@/modules/admin/screens/conformite-clients/messages";
import { ActorIntentForm } from "@/modules/admin/screens/spaces/actor-forms";
import { PipelineGlyph } from "./pipeline-step";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { formatDateTimeCasablanca } from "@/modules/shared/lib/format/display";

function matchClientCase(cases: AdminClientCase[], org: { display_name: string; legal_name: string }) {
  return cases.find((item) => item.organizationName === org.display_name || item.organizationName === org.legal_name)
    ?? cases.find((item) => actorOrganizationLabel(item.organizationName, "fr") === actorOrganizationLabel(org.display_name, "fr"));
}

function organizationQuery(query: string, organizationId: string | null) { const params=new URLSearchParams(query);if(organizationId)params.set("organizationId",organizationId);else params.delete("organizationId");const value=params.toString();return value?`?${value}`:""; }
function accountLabel(locale: Locale, row: ActorUserRow | undefined) { return row ? actorAccountTitle(row, locale) : (locale === "ar" ? "حساب" : "Compte"); }
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
  includeFixtures = false,
}: {
  locale: Locale;
  query: string;
  users: ActorUserRow[];
  invites: SafeInvitation[];
  page?: number;
  search?: string;
  filters?: { org?: string; role?: string; status?: string };
  includeFixtures?: boolean;
}) {
  const a = actorCopy(locale);
  const c = adminCopy(locale);
  const inviteMessages = getInvitationMessages(locale);
  const showFixtures = includeFixtures || Boolean(search?.trim());
  const directory = showFixtures ? users : users.filter((row) => !isAdminDirectoryFixture(row));
  const hiddenFixtureAccounts = new Set(users.filter((row) => isAdminDirectoryFixture(row)).map((row) => row.userId)).size;
  const orgs = [...new Map(directory.flatMap(row=>row.organizationId&&row.organizationName?[[row.organizationId,{id:row.organizationId,name:row.organizationName}] as const]:[])).values()].sort((left,right)=>left.name.localeCompare(right.name));
  const roles = [...new Set(directory.flatMap((row) => [...row.roles,...(row.platformRoles??[])]))].sort();
  const statuses = [...new Set(directory.map((row) => row.accountStatus??row.status))].sort();
  const filteredRows = directory.filter((row) => matchesActorUser(row, filters, search));
  const accounts = groupActorAccounts(filteredRows);
  const pageCount = Math.max(1, Math.ceil(accounts.length / 50));
  const currentPage = Math.min(pageCount, Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1));
  const visible = accounts.slice((currentPage - 1) * 50, currentPage * 50);
  const pageHref = (number: number) => {
    const params = new URLSearchParams(query);
    if (search) params.set("q", search);
    for (const [key, value] of Object.entries(filters ?? {})) if (value) params.set(key, value);
    if (includeFixtures) params.set("fixtures", "1");
    params.set("page", String(number));
    return `/${locale}/administration/utilisateurs?${params.toString()}`;
  };
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
          <form
            key={`users:${filters?.org ?? "all"}:${filters?.role ?? "all"}:${filters?.status ?? "all"}:${search ?? ""}:${includeFixtures ? "1" : "0"}:${currentPage}`}
            className="admin-filters"
            method="get"
            action={`/${locale}/administration/utilisateurs`}
          >
            <label className="client-top-search admin-filter-search">
              <Search className="size-4" aria-hidden />
              <input name="q" defaultValue={search} placeholder={a.searchUsers} aria-label={a.searchUsers} />
            </label>
            <label>{c.orgs}
              <select name="org" defaultValue={filters?.org ?? "all"}>
                <option value="all">{c.all}</option>
                <option value="unassigned">{noOrganization(locale)}</option>
                {orgs.map((org) => <option key={org.id} value={org.id}>{actorOrganizationLabel(org.name, locale)}</option>)}
              </select>
            </label>
            <label>{c.roles}
              <select name="role" defaultValue={filters?.role ?? "all"}>
                <option value="all">{c.all}</option>
                {roles.map((role) => <option key={role} value={role}>{actorRolesLabel([role], locale)}</option>)}
              </select>
            </label>
            <label>{c.state}
              <select name="status" defaultValue={filters?.status ?? "all"}>
                <option value="all">{c.all}</option>
                {statuses.map((status) => <option key={status} value={status}>{accountStatusLabel(status,locale)}</option>)}
              </select>
            </label>
            {includeFixtures ? <input type="hidden" name="fixtures" value="1" /> : null}
            <button type="submit" className="admin-soft-cta">{locale === "ar" ? "تصفية" : "Filtrer"}</button>
          </form>
          {hiddenFixtureAccounts > 0 && !showFixtures ? (
            <p role="status" className="client-access-note">
              {adminFixturesHiddenLabel(hiddenFixtureAccounts, locale)}
              {" "}
              <Link className="client-text-link" href={`/${locale}/administration/utilisateurs?fixtures=1${search ? `&q=${encodeURIComponent(search)}` : ""}`}>
                {locale === "ar" ? "إظهارها" : "Afficher les fixtures"}
              </Link>
            </p>
          ) : null}
          {accounts.length === 0 ? null : (
            <div className="client-table-wrap">
              <table className="client-space-table">
                <thead>
                  <tr>
                    <th>{a.user}</th>
                    <th>{a.orgActive}</th>
                    <th>{locale === "ar" ? "أدوار المؤسسة" : "Rôles organisation"}</th>
                    <th>{locale === "ar" ? "أدوار المنصة" : "Rôles plateforme"}</th>
                    <th>{c.state}</th>
                    <th>{locale==="ar"?"آخر تسجيل دخول":"Dernière connexion"}</th>
                    <th>{a.security}</th>
                    <th>{c.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((account) => {
                    const title = actorAccountTitle(account, locale);
                    const primaryOrgId = account.memberships.find((item) => item.organizationId)?.organizationId ?? null;
                    return (
                      <tr key={account.userId}>
                        <td>
                          <span className="client-doc-cell admin-identity-cell">
                            <span className="client-avatar" data-tone="violet" aria-hidden>{actorAvatarInitial(account, locale)}</span>
                            <span className="admin-identity-stack">
                              <strong className="admin-identity-name">{title}</strong>
                              {account.email ? <span className="admin-identity-email" dir="ltr">{account.email}</span> : null}
                              {(account.phone || account.preferredLocale) ? (
                                <span className="admin-identity-meta" dir="ltr">
                                  {[account.phone, account.preferredLocale].filter(Boolean).join(" · ")}
                                </span>
                              ) : null}
                              {(account.libraryScopes.length > 0 || account.franchiseScopes.length > 0) ? (
                                <span className="admin-identity-meta">
                                  {locale === "ar" ? "نطاق" : "Périmètre"}
                                  {": "}
                                  {[
                                    account.libraryScopes.length ? (locale === "ar" ? `${account.libraryScopes.length} مكتبة` : `${account.libraryScopes.length} bibliothèque(s)`) : null,
                                    account.franchiseScopes.length ? (locale === "ar" ? `${account.franchiseScopes.length} امتياز` : `${account.franchiseScopes.length} franchise(s)`) : null,
                                  ].filter(Boolean).join(" · ")}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </td>
                        <td>
                          <span className="admin-identity-stack">
                            <span>{actorMembershipOrganizationsLabel(account.memberships, locale)}</span>
                            {account.memberships.length > 1 ? (
                              <small>{locale === "ar" ? `${account.memberships.length} عضويات` : `${account.memberships.length} adhésions`}</small>
                            ) : null}
                          </span>
                        </td>
                        <td><span className="client-status-chip" data-tone="violet">{actorMembershipRolesLabel(account.memberships, locale)}</span></td>
                        <td><span className="client-status-chip" data-tone="sky">{actorRolesLabel(account.platformRoles, locale)}</span></td>
                        <td><span className="client-status-chip" data-tone={statusTone(account.accountStatus ?? "UNKNOWN")}>{accountStatusLabel(account.accountStatus ?? "UNKNOWN", locale)}</span></td>
                        <td dir="ltr">{accountLastSignIn(account.lastSignInAt, locale)}</td>
                        <td>
                          <ShieldCheck className="size-4" aria-hidden />{" "}
                          {account.mfaStatus === "ENABLED" ? (locale === "ar" ? "مفعّلة" : "Activée") : account.mfaStatus === "DISABLED" ? (locale === "ar" ? "غير مفعّلة" : "Non activée") : a.notShown}
                          {typeof account.sessionCount === "number" ? (
                            <small> · {locale === "ar" ? `${account.sessionCount} جلسة` : `${account.sessionCount} session(s)`}</small>
                          ) : null}
                        </td>
                        <td>
                          <details className="admin-row-menu">
                            <summary aria-label={c.actions}><MoreHorizontal className="size-4" /></summary>
                            <div>
                              <Link href={`/${locale}/administration/utilisateurs/${account.userId}${organizationQuery(query, primaryOrgId)}`}><Eye className="size-3.5" aria-hidden />{c.consult}</Link>
                              <Link href={`/${locale}/administration/utilisateurs/${account.userId}/roles${organizationQuery(query, primaryOrgId)}`}><Pencil className="size-3.5" aria-hidden />{a.editRoles}</Link>
                              {primaryOrgId ? <Link href={`/${locale}/administration/entreprises/${primaryOrgId}${query}`}><Building2 className="size-3.5" aria-hidden />{c.orgs}</Link> : null}
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
          {accounts.length ? <nav aria-label={locale==="ar"?"صفحات المستخدمين":"Pages des utilisateurs"} className="flex flex-wrap items-center gap-3"><span>{currentPage} / {pageCount} · {accounts.length}</span>{currentPage>1?<Link href={pageHref(currentPage-1)}>{locale==="ar"?"السابق":"Précédent"}</Link>:null}{currentPage<pageCount?<Link href={pageHref(currentPage+1)}>{locale==="ar"?"التالي":"Suivant"}</Link>:null}</nav>:null}
          {accounts.length === 0 ? (
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
          {invites.length === 0 ? (
            <p>{inviteMessages.managedEmpty}</p>
          ) : (
            <>
              <p>{a.pendingInvitesLead}</p>
              <ul className="client-feed">
                {invites.slice(0, 6).map((invite) => (
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
            </>
          )}
          <Link href={`/${locale}/invitations`}>{locale==="ar"?"عرض كل الدعوات":"Voir toutes les invitations"}</Link>
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
        {accounts.length === 0 ? (
          <article className="admin-empty-card">
            <UserRound className="size-6" aria-hidden />
            <h3>{a.noUser}</h3>
            <p>{a.noUserLead}</p>
            <Link href={`/${locale}/administration/utilisateurs`} className="client-ghost-link">{c.reset}</Link>
          </article>
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
  const memberships = rows.filter((row) => row.membershipId !== null && row.organizationId !== null);
  const orgRoles = [...new Set(memberships.flatMap((row) => row.roles))];
  const platformRoles = primary?.platformRoles ?? [];
  const functionalRoles = [...new Set([...orgRoles, ...platformRoles])];
  const libraryScopes = [...new Set(memberships.flatMap((row) => row.libraryScopes ?? []))];
  const franchiseScopes = [...new Set(memberships.flatMap((row) => row.franchiseScopes ?? []))];
  const title = accountLabel(locale, primary);
  const mfaRequired = orgRoles.some((role) => /^(FRANCHISE_|CLIENT_OWNER|CLIENT_ADMIN|PROVIDER_OWNER|PROVIDER_MANAGER)/u.test(role))
    || platformRoles.length > 0;
  const mfaLabel = primary?.mfaStatus === "ENABLED"
    ? a.mfaOn
    : primary?.mfaStatus === "DISABLED"
      ? (mfaRequired ? a.mfaRequiredOff : a.mfaOff)
      : a.notShown;
  const requestedOrgId = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query).get("organizationId");
  const actionOrganizationId = requestedOrgId && memberships.some((row) => row.organizationId === requestedOrgId)
    ? requestedOrgId
    : memberships.length === 1
      ? memberships[0]?.organizationId ?? null
      : null;
  const base = `/${locale}/administration/utilisateurs/${userId}`;
  return (
    <main className="client-page">
      <section className="admin-two">
        <div className="client-stack">
          <article className="client-card" id="vue">
            <div className="admin-user-hero">
              <span className="client-avatar" data-tone="violet" aria-hidden>{primary ? actorAvatarInitial(primary, locale) : "?"}</span>
              <div className="admin-user-hero-copy">
                <h2>{a.userFiche} — {title}</h2>
                <p>{a.userFicheLead}</p>
                <dl className="admin-user-meta">
                  <div><dt>Email</dt><dd dir="ltr">{primary?.email?.trim() || "—"}</dd></div>
                  <div><dt>{locale === "ar" ? "الهاتف" : "Téléphone"}</dt><dd dir="ltr">{primary?.phone?.trim() || "—"}</dd></div>
                  <div><dt>Locale</dt><dd dir="ltr">{primary?.preferredLocale?.trim() || "—"}</dd></div>
                  <div><dt>{a.lastSignIn}</dt><dd dir="ltr">{accountLastSignIn(primary?.lastSignInAt, locale)}</dd></div>
                </dl>
              </div>
              <span className="admin-status">{accountStatusLabel(primary?.accountStatus ?? primary?.status ?? "UNKNOWN", locale)}</span>
            </div>
          </article>
          <nav className="client-tabs" aria-label={c.overview}>
            <a href={`${base}${query}#vue`}>{c.overview}</a>
            <a href={`${base}${query}#organisations`}>{a.orgsRoles}</a>
            <a href={`${base}${query}#perimetres`}>{a.perimetersTab}</a>
            <a href={`${base}${query}#securite-compte`}>{a.sessions}</a>
          </nav>
          <article className="client-card" id="organisations">
            <header><h2>{a.memberOrgs}</h2><p>{a.memberOrgsLead}</p></header>
            {memberships.length === 0 ? <p>{noOrganization(locale)}</p> : null}
            <ul className="client-feed admin-membership-feed">
              {memberships.map((row) => {
                const scopeLine = [
                  (row.libraryScopes?.length ?? 0) > 0 ? `${locale === "ar" ? "مكتبة" : "Bibliothèque"} : ${actorScopeLabels(row.libraryScopes, locale)}` : null,
                  (row.franchiseScopes?.length ?? 0) > 0 ? `${locale === "ar" ? "امتياز" : "Franchise"} : ${actorScopeLabels(row.franchiseScopes, locale)}` : null,
                ].filter(Boolean).join(" · ");
                return (
                  <li key={row.membershipId}>
                    <span className="client-feed-icon" data-tone="violet"><Building2 className="size-4" aria-hidden /></span>
                    <span>
                      <strong>{actorOrganizationLabel(row.organizationName, locale)}</strong>
                      <small>{actorRolesLabel(row.roles, locale)}</small>
                      {scopeLine ? <small>{scopeLine}</small> : null}
                    </span>
                    <span className="client-status-chip" data-tone={statusTone(row.status)}>{accountStatusLabel(row.status, locale)}</span>
                    <div className="admin-feed-actions">
                      <Cta href={`/${locale}/administration/entreprises/${row.organizationId}${query}`}>{c.open}</Cta>
                      <Cta href={`${base}/roles${organizationQuery(query, row.organizationId)}`}>{a.editRolesShort}</Cta>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="admin-platform-block">
              <h3>{a.platformRoles}</h3>
              <p>{platformRoles.length ? actorRolesLabel(platformRoles, locale) : a.platformRolesNone}</p>
              <small>{locale === "ar" ? "حالة الحساب" : "État du compte"} : {accountStatusLabel(primary?.accountStatus ?? primary?.status ?? "UNKNOWN", locale)}</small>
            </div>
          </article>
          <article className="client-card" id="perimetres">
            <header><h2>{a.explicitPerimeters}</h2><p>{a.noCrossLead}</p></header>
            <div className="admin-perimeter-grid">
              <div>
                <h3>{a.orgPerimeter}</h3>
                <p>{memberships.length ? memberships.map((row) => actorOrganizationLabel(row.organizationName, locale)).join(" · ") : noOrganization(locale)}</p>
                <small>{a.orgPerimeterLead}</small>
              </div>
              <div>
                <h3>{a.libraryPerimeter}</h3>
                <p>{actorScopeLabels(libraryScopes, locale)}</p>
                <small>{a.libraryPerimeterLead}</small>
              </div>
              <div>
                <h3>{a.franchisePerimeter}</h3>
                <p>{actorScopeLabels(franchiseScopes, locale)}</p>
                <small>{a.franchisePerimeterLead}</small>
              </div>
              <div>
                <h3>{a.funcPerimeter}</h3>
                <p>{actorRolesLabel(functionalRoles, locale)}</p>
                <small>{a.funcPerimeterLead}</small>
                {functionalRoles.length > 0 ? (
                  <div className="admin-cap-pills" aria-label={a.associatedCaps}>
                    {functionalRoles.map((role) => <span key={role}>{actorRolesLabel([role], locale)}</span>)}
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        </div>
        <aside className="client-stack">
          <article className="client-card">
            <h2 id="securite-compte"><Shield className="size-4" aria-hidden /> {a.securityControls}</h2>
            <ul className="admin-security">
              <li>
                <span><Lock className="size-4" aria-hidden /> {a.mfa}</span>
                <span className="client-status-chip" data-tone={primary?.mfaStatus === "ENABLED" ? "mint" : "peach"}>{mfaLabel}</span>
              </li>
              <li><span>{a.sessionStatus}</span><span className="client-status-chip" data-tone="sky">{primary?.sessionCount ?? a.notShown}</span></li>
              <li><span>{a.roleRevocation}</span><span className="client-status-chip" data-tone="violet">{a.available}</span></li>
              <li><span>{a.noCross}</span><span className="client-status-chip" data-tone="mint">{a.conform}</span></li>
            </ul>
            <p className="admin-note">{a.mfaLead}</p>
          </article>
          <article className="client-card">
            <h2>{c.actions}</h2>
            <div className="admin-empty-actions">
              <Link href={`${base}/roles${query}`} className="admin-primary-cta">{a.editRoles}</Link>
              {actionOrganizationId ? (
                <>
                  <ActorIntentForm locale={locale} organizationId={actionOrganizationId} resourceId={userId} resourceType="SESSION" intent="RESTRICT_ENTITY" reason="Révocation de sessions demandée depuis la fiche utilisateur." label={a.revokeSession} tone="danger" />
                  <ActorIntentForm locale={locale} organizationId={actionOrganizationId} resourceId={userId} resourceType="MEMBERSHIP" intent="SUSPEND_ENTITY" reason="Suspension d’accès demandée depuis la fiche utilisateur." label={a.suspendAccount} tone="danger" />
                </>
              ) : memberships.length > 1 ? (
                <p className="admin-note">{locale === "ar" ? "اختر مؤسسة قبل تعليق العضوية أو إلغاء الجلسات." : "Choisissez une organisation avant de suspendre une adhésion ou de révoquer les sessions."}</p>
              ) : null}
              {memberships.length > 1 ? (
                <ul className="admin-org-action-list">
                  {memberships.map((row) => (
                    <li key={`action-org-${row.membershipId}`}>
                      <Cta href={`${base}${organizationQuery(query, row.organizationId)}#securite-compte`}>
                        {actorOrganizationLabel(row.organizationName, locale)}
                      </Cta>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </article>
          <article className="client-card">
            <h2>{a.relatedInvites}</h2>
            <Cta href={`/${locale}/invitations${query}`}>{a.openInvites}</Cta>
          </article>
          <article className="client-card">
            <h2>{a.auditHistory}</h2>
            <ul className="admin-history">
              {(fiche?.timeline ?? []).slice(0, 5).map((item) => (
                <li key={item.ref}><span className="client-history-dot" data-tone="violet" /><span><strong>{item.label}</strong><small dir="ltr">{item.at ? formatDateTimeCasablanca(item.at, locale) : "—"}</small></span></li>
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
  includeFixtures = false,
}: {
  locale: Locale;
  query: string;
  organizations: AdminSupervisionDashboard["organizations"];
  cases: AdminClientCase[];
  diagnostics: AdminSupervisionDashboard["diagnostics"];
  search?: string;
  filters?: { status?: string; compliance?: string };
  includeFixtures?: boolean;
}) {
  const a = actorCopy(locale);
  const c = adminCopy(locale);
  const complianceMessages = getComplianceMessages(locale);
  const complianceLabel = (status: string | undefined) => {
    if (!status || status === "NONE") return locale === "ar" ? "غير متحقق" : "Non vérifié";
    return complianceMessages.statuses[status as keyof typeof complianceMessages.statuses] ?? status;
  };
  const showFixtures = includeFixtures || Boolean(search?.trim());
  const directory = showFixtures ? organizations : organizations.filter((org) => !isAdminOrgDirectoryFixture(org.display_name, org.legal_name));
  const hiddenFixtures = organizations.length - directory.length;
  const statuses = [...new Set(directory.map((org) => org.status))].sort();
  const complianceStatuses = [...new Set(cases.map((item) => item.status))].sort();
  const filtered = directory.filter((org) => {
    if (filters?.status && filters.status !== "all" && org.status !== filters.status) return false;
    if (filters?.compliance && filters.compliance !== "all") {
      const compliance = matchClientCase(cases, org);
      if ((compliance?.status ?? "NONE") !== filters.compliance) return false;
    }
    return !search || `${org.display_name} ${org.legal_name}`.toLowerCase().includes(search.toLowerCase());
  });
  const actionItems = [
    ...cases.filter((item) => item.status !== "VERIFIED" && !isAdminOrgDirectoryFixture(item.organizationName)).slice(0, 2).map((item) => ({ id: item.id, title: actorOrganizationLabel(item.organizationName, locale), detail: complianceLabel(item.status), href: `/${locale}/administration/conformite-clients${query}`, tone: "peach" as const })),
    ...directory.filter((org) => org.open_disputes > 0 || org.open_requests > 0).slice(0, 3).map((org) => ({ id: org.id, title: actorOrganizationLabel(org.display_name, locale), detail: org.open_disputes > 0 ? c.lastDispute : c.lastOpenRequest, href: `/${locale}/administration/clients/${org.id}${query}`, tone: "sky" as const })),
  ];
  const journey = [
    { label: locale === "ar" ? "التسجيل" : "Inscription", detail: locale === "ar" ? "إنشاء الحساب" : "Création du compte", tone: "violet" },
    { label: c.orgStep, detail: locale === "ar" ? "هوية المؤسسة" : "Identité organisation", tone: "violet" },
    { label: c.compliance, detail: locale === "ar" ? "التحقق من الوثائق" : "Vérification documentaire", tone: "mint" },
    { label: a.diagnostic, detail: locale === "ar" ? "تقييم الصحة" : "Évaluation de santé", tone: "peach" },
    { label: c.requests, detail: locale === "ar" ? "احتياجات الخدمة" : "Besoins de service", tone: "violet" },
    { label: c.missions, detail: locale === "ar" ? "التنفيذ والمتابعة" : "Exécution et suivi", tone: "violet" },
  ];
  return (
    <main className="client-page">
      <section className="admin-two">
        <article className="client-card">
          <form
            key={`clients:${filters?.status ?? "all"}:${filters?.compliance ?? "all"}:${search ?? ""}:${includeFixtures ? "1" : "0"}`}
            className="admin-filters"
            method="get"
            action={`/${locale}/administration/clients`}
          >
            <label>{c.compliance}
              <select name="compliance" defaultValue={filters?.compliance ?? "all"}>
                <option value="all">{c.all}</option>
                {complianceStatuses.map((status) => <option key={status} value={status}>{complianceLabel(status)}</option>)}
              </select>
            </label>
            <label>{c.state}
              <select name="status" defaultValue={filters?.status ?? "all"}>
                <option value="all">{c.all}</option>
                {statuses.map((status) => <option key={status} value={status}>{localizeStatus(status, locale)}</option>)}
              </select>
            </label>
            <label className="client-top-search admin-filter-search">
              <Search className="size-4" aria-hidden />
              <input name="q" defaultValue={search} placeholder={c.searchList} aria-label={c.searchList} />
            </label>
            {includeFixtures ? <input type="hidden" name="fixtures" value="1" /> : null}
            <button type="submit" className="admin-soft-cta">{locale === "ar" ? "تصفية" : "Filtrer"}</button>
            <Link href={`/${locale}/administration/clients`} className="client-ghost-link">{c.reset}</Link>
          </form>
          {hiddenFixtures > 0 && !showFixtures ? (
            <p role="status" className="client-access-note">
              {adminFixturesHiddenLabel(hiddenFixtures, locale)}
              {" "}
              <Link className="client-text-link" href={`/${locale}/administration/clients?fixtures=1${search ? `&q=${encodeURIComponent(search)}` : ""}`}>
                {locale === "ar" ? "إظهارها" : "Afficher les fixtures"}
              </Link>
            </p>
          ) : null}
          {filtered.length === 0 ? null : (
            <div className="client-table-wrap" tabIndex={0} role="region" aria-label={a.clientsTitle}>
              <table className="client-space-table admin-clients-table">
                <thead>
                  <tr>
                    <th>{c.kindClient}</th>
                    <th>{a.onboarding}</th>
                    <th>{c.compliance}</th>
                    <th>{a.diagnostic}</th>
                    <th>{c.requests}</th>
                    <th>{c.lastDispute}</th>
                    <th>{c.state}</th>
                    <th>{c.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((org) => {
                    const orgLabel = actorOrganizationLabel(org.display_name, locale);
                    const compliance = matchClientCase(cases, org);
                    const diagnostic = diagnostics.find((item) => item.organization_id === org.id);
                    return (
                      <tr key={org.id}>
                        <td>
                          <span className="client-doc-cell admin-identity-cell">
                            <span className="client-avatar" data-tone="violet" aria-hidden>{orgLabel.slice(0, 1)}</span>
                            <span className="admin-identity-stack">
                              <strong className="admin-identity-name">{orgLabel}</strong>
                              {org.legal_name && org.legal_name !== org.display_name ? (
                                <span className="admin-identity-meta">{org.legal_name}</span>
                              ) : null}
                            </span>
                          </span>
                        </td>
                        <td><span className="client-status-chip" data-tone={compliance ? "mint" : "sky"}>{compliance ? (compliance.status === "VERIFIED" ? a.done : a.inReview) : a.notStarted}</span></td>
                        <td><span className="client-status-chip" data-tone={compliance && compliance.status !== "VERIFIED" ? "peach" : "mint"}>{compliance?.status === "VERIFIED" ? c.complianceOk : compliance?.status === "UNDER_REVIEW" || compliance?.status === "QUESTION_REQUIRED" ? c.complianceReview : complianceLabel(compliance?.status)}</span></td>
                        <td><span className="client-status-chip" data-tone={diagnostic ? "mint" : "sky"}>{diagnostic?.status ? localizeStatus(diagnostic.status, locale) : a.notStarted}</span></td>
                        <td>{org.open_requests}</td>
                        <td>{org.open_disputes}</td>
                        <td><span className="client-status-chip" data-tone={statusTone(org.status)}>{localizeStatus(org.status, locale)}</span></td>
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
  const complianceMessages = getComplianceMessages(locale);
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
            <div><dt>{c.state}</dt><dd>{localizeStatus(org.status, locale)}</dd></div>
            <div><dt>KYC</dt><dd>{compliance?.status ? (complianceMessages.statuses[compliance.status as keyof typeof complianceMessages.statuses] ?? compliance.status) : "—"}</dd></div>
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
            {fiche.timeline.slice(0, 4).map((item) => <li key={item.ref}><span><strong>{item.label}</strong><small dir="ltr">{item.at ? formatDateTimeCasablanca(item.at, locale) : "—"}</small></span></li>)}
            {fiche.timeline.length === 0 ? <li><span>{c.lastChangeLead}</span></li> : null}
          </ul>
          <Cta href={`/${locale}/administration/operations${query}`}>{a.seeActivity}</Cta>
        </article>
      </section>
      <section className="admin-fiche-lower">
        <article className="client-card" id="documents">
          <header><h2>{c.documents}</h2></header>
          <ul className="client-feed">
            <li><span><strong>{c.state}</strong><small>{localizeStatus(org.status, locale)}</small></span></li>
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
            <li><span><strong>{c.plan}</strong><small>{fiche.subscriptions[0]?.status ? localizeStatus(fiche.subscriptions[0].status, locale) : "—"}</small></span></li>
            <li><span><strong>{c.nextBill}</strong><small>{fiche.subscriptions[0]?.current_period_end ?? "—"}</small></span></li>
          </ul>
          <Cta href={`/${locale}/administration/finance${query}`}>{a.managePlan}</Cta>
        </article>
        <article className="client-card">
          <header><h2>{c.audit}</h2></header>
          <ul className="client-feed">
            <li><span><strong>{c.lastChange}</strong><small>{fiche.organization.updated_at ? formatDateTimeCasablanca(fiche.organization.updated_at, locale) : "—"}</small></span></li>
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
    check: cases.filter((item) => item.status === "DOCUMENTS_REQUIRED").length,
    complement: cases.filter((item) => item.status === "QUESTION_REQUIRED").length,
    review: cases.filter((item) => item.status === "UNDER_REVIEW" || item.status === "RESPONSE_RECEIVED").length,
    decided: cases.filter((item) => item.status === "VERIFIED" || item.status === "REJECTED").length,
  };
  const visible = cases.filter((item) => {
    if (!filter || filter === "all") return true;
    if (filter === "check") return item.status === "DOCUMENTS_REQUIRED";
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
                          <span className="client-avatar" data-tone="violet">{actorOrganizationLabel(item.organizationName, locale).slice(0, 1)}</span>
                          {actorOrganizationLabel(item.organizationName, locale)}
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
          <span className="client-avatar" data-tone="violet">{actorOrganizationLabel(item.organizationName, locale).slice(0, 1)}</span>
          <div>
            <h2>{actorOrganizationLabel(item.organizationName, locale)}</h2>
            <p>{c.kindClient} · {messages.profileVersion} {item.profileVersion ?? messages.noProfile}</p>
          </div>
          <span className="admin-status">{messages.statuses[item.status]}</span>
          <Link href={`/${locale}/administration/conformite-clients${query}`} className="admin-soft-cta">{a.seeDossier}</Link>
        </div>
        <dl className="admin-hero-meta">
          <div><strong>{locale === "ar" ? "أُنشئ" : "Créé le"}</strong>{formatDateTimeCasablanca(item.createdAt, locale)}</div>
          <div><strong>{messages.updated}</strong>{formatDateTimeCasablanca(item.updatedAt, locale)}</div>
          <div><strong>{locale === "ar" ? "المرحلة" : "Étape actuelle"}</strong>{messages.statuses[item.status]}</div>
        </dl>
      </article>
      {item.anomalies.some((anomaly) => anomaly.severity === "CRITICAL") ? (
        <div className="admin-banner" data-tone="danger">
          <strong>{a.staleDossier}</strong>
          <Link href={`/${locale}/administration/conformite-clients/${item.id}${query}`} className="admin-soft-cta">{a.refreshDossier}</Link>
        </div>
      ) : null}
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

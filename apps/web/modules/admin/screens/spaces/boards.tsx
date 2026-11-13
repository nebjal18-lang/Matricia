import { adminFixturesHiddenLabel } from "@/modules/admin/data/spaces/actor-presentation";
import { filterAdminOrgRows, localizeStatus } from "@/modules/admin/data/spaces/view-model";
import Link from "next/link";
import {
  Archive,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleDot,
  Download,
  Eye,
  FileText,
  FolderKanban,
  Info,
  Landmark,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Route,
  Search,
  Settings2,
  Shield,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { adminCopy } from "@/modules/admin/data/spaces/copy";
import {
  adminDirectoryGroup,
  adminDirectoryGroups,
  inferOrgType,
  ORG_TYPE_NONE,
  orgTypeFilterCodes,
  orgTypeOptionLabel,
  type AdminDirectoryGroup,
} from "@/modules/admin/data/spaces/directory";
import { organizationJourney, type AdminOrgRow, type AdminTreatItem } from "@/modules/admin/data/spaces/view-model";
import type { AdminOrganizationFiche } from "@/modules/admin/data/supervision/types";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

function Cta({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="client-ghost-link">{children}<ArrowRight className="size-4 rtl:rotate-180" aria-hidden /></Link>;
}

const GROUP_ICONS: Record<AdminDirectoryGroup["id"], LucideIcon> = {
  actors: Users,
  parcours: Route,
  catalog: BookOpen,
  finance: Landmark,
  growth: TrendingUp,
  ops: Settings2,
};

function DirectoryCard({ group }: { group: AdminDirectoryGroup }) {
  const Icon = GROUP_ICONS[group.id];
  return (
    <article className="admin-dir-card" data-tone={group.tone}>
      <header>
        <span className="admin-dir-card-icon" aria-hidden><Icon className="size-4" /></span>
        {group.title}
      </header>
      <ul>
        {group.links.map((link) => (
          <li key={`${group.id}-${link.label}`}>
            <Link href={link.href}>
              <span className="admin-dir-link-label">
                <CircleDot className="size-3.5 admin-dir-link-glyph" aria-hidden />
                {link.label}
              </span>
              <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function AdminDirectoryBoard({ locale, query }: { locale: Locale; query: string }) {
  const c = adminCopy(locale);
  const groups = adminDirectoryGroups(locale, query);
  const actions = [
    { href: `/${locale}/administration/entreprises/nouvelle${query}`, label: c.create, tone: "violet" as const, icon: Plus },
    { href: `/${locale}/administration/entreprises${query}`, label: c.edit, tone: "peach" as const, icon: Pencil },
    { href: `/${locale}/administration/operations${query}#archives`, label: c.archiveRestore, tone: "mint" as const, icon: Archive },
    { href: `/${locale}/administration/entreprises/export${query}`, label: c.export, tone: "sky" as const, icon: Download },
  ];
  const sensitive = [c.s1, c.s2, c.s3, c.s4, c.s5];
  return (
    <main className="client-page admin-home-page">
      <h2 className="admin-home-title">{c.homeTitle}</h2>
      <section className="admin-home-toolbar">
        <div className="admin-dir-actions">
          {actions.map((item) => {
            const Icon = item.icon;
            const className = "admin-dir-action";
            const content = (
              <>
                <Icon className="size-4" aria-hidden />
                {item.label}
                <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
              </>
            );
            return item.href.includes("/export")
              ? <a key={item.label} href={item.href} className={className} data-tone={item.tone}>{content}</a>
              : <Link key={item.label} href={item.href} className={className} data-tone={item.tone}>{content}</Link>;
          })}
        </div>
        <article className="admin-sensitive">
          <h3><Shield className="size-4" aria-hidden /> {c.sensitive}</h3>
          <ul>
            {sensitive.map((item) => (
              <li key={item}><Check className="size-3.5 admin-sensitive-check" aria-hidden />{item}</li>
            ))}
          </ul>
        </article>
      </section>
      <section className="admin-dir-grid" aria-label={c.homeTitle}>
        {groups.map((group) => <DirectoryCard key={group.id} group={group} />)}
      </section>
      <p className="admin-foot-note"><Info className="size-4 shrink-0" aria-hidden />{c.foot}</p>
    </main>
  );
}

export function AdminHubBoard({
  locale,
  query,
  groupId,
}: {
  locale: Locale;
  query: string;
  groupId: AdminDirectoryGroup["id"];
}) {
  const c = adminCopy(locale);
  const group = adminDirectoryGroup(locale, query, groupId);
  if (!group) return null;
  return (
    <main className="client-page">
      <section className="admin-hub-layout">
        <DirectoryCard group={group} />
        <article className="admin-sensitive">
          <h3><Shield className="size-4" aria-hidden /> {c.sensitive}</h3>
          <ul>
            {[c.s1, c.s2, c.s3, c.s4, c.s5].map((item) => (
              <li key={item}><Check className="size-3.5 admin-sensitive-check" aria-hidden />{item}</li>
            ))}
          </ul>
        </article>
      </section>
      <p className="admin-foot-note"><Info className="size-4 shrink-0" aria-hidden />{c.foot}</p>
    </main>
  );
}

export function AdminHubStrip({
  locale,
  query,
  groupId,
}: {
  locale: Locale;
  query: string;
  groupId: AdminDirectoryGroup["id"];
}) {
  const group = adminDirectoryGroup(locale, query, groupId);
  if (!group) return null;
  return (
    <nav className="admin-hub-strip" aria-label={group.title} data-tone={group.tone}>
      {group.links.map((link) => (
        <Link key={link.href} href={link.href}>{link.label}</Link>
      ))}
    </nav>
  );
}

export function OrganizationsBoard({
  locale,
  query,
  rows,
  treat,
  search,
  archives,
  filters,
  includeFixtures = false,
}: {
  locale: Locale;
  query: string;
  rows: AdminOrgRow[];
  treat: AdminTreatItem[];
  search?: string;
  archives?: boolean;
  filters?: { type?: string; status?: string; compliance?: string; plan?: string };
  includeFixtures?: boolean;
}) {
  const c = adminCopy(locale);
  const showFixtures = includeFixtures || Boolean(search?.trim());
  const directory = showFixtures ? rows : rows.filter((row) => !row.fixture);
  const hiddenFixtures = rows.length - directory.length;
  const types = [...new Set(directory.flatMap((row) => orgTypeFilterCodes(row.typeCodes ?? [])))].sort();
  const statuses = [...new Set(directory.map((row) => row.statusCode ?? row.status).filter(Boolean))].sort();
  const compliances = [...new Set(directory.map((row) => row.complianceCode ?? row.compliance).filter(Boolean))].sort();
  const plans = [...new Set(directory.map((row) => row.planCode ?? row.plan).filter(Boolean))].sort();
  const filtered = filterAdminOrgRows(directory, filters ?? {}, search, archives);
  const orgParams = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  const organizationId = orgParams.get("organizationId");
  const activeFilters = Boolean(
    (filters?.type && filters.type !== "all")
    || (filters?.status && filters.status !== "all")
    || (filters?.compliance && filters.compliance !== "all")
    || (filters?.plan && filters.plan !== "all")
    || archives
    || search?.trim(),
  );
  const resetHref = `/${locale}/administration/entreprises${organizationId ? `?organizationId=${organizationId}` : ""}`;
  const fixturesHref = (() => {
    const params = new URLSearchParams(organizationId ? { organizationId } : undefined);
    params.set("fixtures", "1");
    if (search?.trim()) params.set("q", search.trim());
    return `/${locale}/administration/entreprises?${params.toString()}`;
  })();
  return (
    <main className="client-page">
      <section className="admin-org-layout">
        <article className="client-card">
          <form
            key={`org-filters:${filters?.type ?? "all"}:${filters?.status ?? "all"}:${filters?.compliance ?? "all"}:${filters?.plan ?? "all"}:${search ?? ""}:${archives ? "1" : "0"}:${includeFixtures ? "1" : "0"}`}
            className="admin-filters"
            data-layout="orgs"
            data-active={activeFilters ? "true" : undefined}
            method="get"
            action={`/${locale}/administration/entreprises`}
          >
            {organizationId ? <input type="hidden" name="organizationId" value={organizationId} /> : null}
            {includeFixtures ? <input type="hidden" name="fixtures" value="1" /> : null}
            <div className="admin-filters-grid">
              <label>{c.type}
                <select name="type" defaultValue={filters?.type === "Non renseigné" || filters?.type === "غير محدد" ? ORG_TYPE_NONE : (filters?.type ?? "all")}>
                  <option value="all">{c.all}</option>
                  {types.map((type) => <option key={type} value={type}>{orgTypeOptionLabel(type, locale)}</option>)}
                </select>
              </label>
              <label>{c.state}
                <select name="status" defaultValue={filters?.status ?? "all"}>
                  <option value="all">{c.all}</option>
                  {statuses.map((status) => <option key={status} value={status}>{localizeStatus(status, locale)}</option>)}
                </select>
              </label>
              <label>{c.compliance}
                <select name="compliance" defaultValue={filters?.compliance ?? "all"}>
                  <option value="all">{c.all}</option>
                  {compliances.map((compliance) => <option key={compliance} value={compliance}>{compliance === "CURRENT" ? c.complianceOk : compliance === "REVIEW" ? c.complianceReview : locale === "ar" ? "غير متحقق" : "Non vérifié"}</option>)}
                </select>
              </label>
              <label>{c.plan}
                <select name="plan" defaultValue={filters?.plan ?? "all"}>
                  <option value="all">{c.all}</option>
                  {plans.map((plan) => <option key={plan} value={plan}>{plan === "UNKNOWN" ? c.unknownPlan : plan}</option>)}
                </select>
              </label>
            </div>
            <div className="admin-filters-tools">
              <label className="admin-check"><input type="checkbox" name="archives" value="1" defaultChecked={archives} />{c.includeArchived}</label>
              <Link href={`/${locale}/administration/operations${organizationId ? `?organizationId=${organizationId}` : ""}#archives`} className="client-ghost-link">{c.seeArchives}</Link>
              <label className="client-top-search admin-filter-search">
                <Search className="size-4" aria-hidden />
                <input name="q" defaultValue={search} placeholder={c.searchList} aria-label={c.searchList} />
              </label>
              <button type="submit" className="admin-soft-cta">{locale === "ar" ? "تصفية" : "Filtrer"}</button>
              <Link href={resetHref} className="client-ghost-link">{c.reset}</Link>
            </div>
          </form>
          {hiddenFixtures > 0 && !showFixtures ? (
            <p role="status" className="client-access-note">
              {adminFixturesHiddenLabel(hiddenFixtures, locale)}
              {" "}
              <Link className="client-text-link" href={fixturesHref}>
                {locale === "ar" ? "إظهارها" : "Afficher les fixtures"}
              </Link>
            </p>
          ) : null}
          <div className="admin-table-tools">
            <div>
              <h2>{c.allOrgs}</h2>
              <p>{c.allOrgsLead}</p>
            </div>
            {filtered.length > 0 ? (
              <p className="admin-result-count" role="status">
                {locale === "ar" ? `${filtered.length} نتيجة` : `${filtered.length} résultat${filtered.length > 1 ? "s" : ""}`}
                {activeFilters ? (locale === "ar" ? " · مصفّاة" : " · filtrés") : null}
              </p>
            ) : null}
          </div>
          {filtered.length === 0 ? null : (
            <div className="client-table-wrap" tabIndex={0} role="region" aria-label={c.allOrgs}>
              <table className="client-space-table admin-org-table">
                <thead>
                  <tr>
                    <th>{c.orgs}</th>
                    <th>{c.type}</th>
                    <th>{c.state}</th>
                    <th>{c.compliance}</th>
                    <th>{c.plan}</th>
                    <th>{c.lastAction}</th>
                    <th>{c.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <span className="client-doc-cell">
                          <span className="client-avatar" data-tone={row.statusTone}>{row.name.slice(0, 1)}</span>
                          <span>
                            <strong>{row.name}</strong>
                            {row.legalName && row.legalName !== row.name ? <small>{row.legalName}</small> : null}
                          </span>
                        </span>
                      </td>
                      <td><span className="client-status-chip" data-tone={row.typeTone ?? "violet"}>{row.type}</span></td>
                      <td><span className="client-status-chip" data-tone={row.statusTone}>{row.status}</span></td>
                      <td><span className="client-status-chip" data-tone={row.complianceTone}>{row.compliance}</span></td>
                      <td><span className="client-status-chip" data-tone="violet">{row.plan}</span></td>
                      <td>{row.lastAction}</td>
                      <td>
                        <details className="admin-row-menu">
                          <summary aria-label={c.actions}><MoreHorizontal className="size-4" /></summary>
                          <div>
                            <Link href={`/${locale}/administration/entreprises/${row.id}${query}`}><Eye className="size-3.5" aria-hidden />{c.consult}</Link>
                            <Link href={`/${locale}/administration/entreprises/${row.id}/modifier${query}`}><Pencil className="size-3.5" aria-hidden />{c.edit}</Link>
                            <Link href={`/${locale}/administration/entreprises/${row.id}/archiver${query ? `${query}&mode=disable` : "?mode=disable"}`}><Power className="size-3.5" aria-hidden />{c.disable}</Link>
                            <Link href={`/${locale}/administration/entreprises/${row.id}/archiver${query}`} data-tone="peach"><Archive className="size-3.5" aria-hidden />{c.archive}</Link>
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filtered.length === 0 ? (
            <div className="admin-empty-card">
              <FolderKanban className="size-6" aria-hidden />
              <h3>{c.emptyOrgs}</h3>
              <p>{c.emptyOrgsLead}</p>
              <div className="admin-empty-actions">
                <Link href={resetHref} className="client-ghost-link">{c.reset}</Link>
                <Link href={`/${locale}/administration/entreprises/nouvelle${query}`} className="admin-primary-cta">{c.createOrg}</Link>
              </div>
            </div>
          ) : null}
          {archives ? (
            <p className="client-access-note">{c.archivesNote}</p>
          ) : null}
        </article>
        <aside className="client-card admin-treat-rail">
          <h2>{c.toTreat}</h2>
          <p>{c.toTreatLead}</p>
          <ul className="client-feed">
            {treat.length === 0 ? <li><span>{c.emptyOrgsLead}</span></li> : treat.map((item) => (
              <li key={item.id}>
                <span className="client-feed-icon" data-tone={item.tone}><FileText className="size-4" aria-hidden /></span>
                <span><strong>{item.title}</strong><small>{item.detail}</small></span>
                <Cta href={item.href}>{c.open}</Cta>
              </li>
            ))}
          </ul>
          <Cta href={`/${locale}/administration/parcours${query}`}>{c.seeQueue}</Cta>
          <p className="client-access-note">{c.controlNote}</p>
        </aside>
      </section>
    </main>
  );
}

export function OrganizationFicheBoard({
  locale,
  query,
  fiche,
}: {
  locale: Locale;
  query: string;
  fiche: AdminOrganizationFiche;
}) {
  const c = adminCopy(locale);
  const org = fiche.organization;
  const base = `/${locale}/administration/entreprises/${org.id}`;
  const journey = organizationJourney(fiche, locale);
  const memberQuery = new URLSearchParams({ organizationId: org.id, org: org.id });
  const membersHref = `/${locale}/administration/utilisateurs?${memberQuery}`;
  const required = [
    { href: `${base}/modifier${query}`, title: c.completeInfo, detail: c.completeInfoLead, tone: "peach" as const },
    { href: `/${locale}/administration/conformite-clients${query}`, title: c.finishCompliance, detail: c.finishComplianceLead, tone: "peach" as const },
    { href: `/${locale}/administration/parcours${query}`, title: c.completeFolder, detail: c.completeFolderLead, tone: "sky" as const },
    { href: membersHref, title: c.assignRoles, detail: c.assignRolesLead, tone: "peach" as const },
  ];
  const history = fiche.timeline.slice(0, 4);
  const unknown = locale === "ar" ? "غير متاح" : "Non disponible";
  const roles = [...new Set(fiche.memberships.flatMap((item) => item.roles))];
  return (
    <main className="client-page">
      <nav className="client-tabs" aria-label={c.overview}>
        <a href={`${base}${query}`} aria-current="page">{c.overview}</a>
        <a href={`${base}${query}#membres`}>{c.members}</a>
        <a href={`/${locale}/administration/conformite-clients${query}`}>{c.compliance}</a>
        <a href={`/${locale}/administration/parcours${query}`}>{c.dossiers}</a>
        <a href={`${base}${query}#boxes`}>{c.boxes}</a>
        <a href={`/${locale}/administration/finance${query}`}>{c.navFinance}</a>
        <a href={`/${locale}/administration/operations${query}`}>{c.audit}</a>
      </nav>
      <section className="admin-fiche-grid">
        <article className="client-card">
          <header><h2>{c.info}</h2></header>
          <dl className="admin-dl">
            <div><dt>{c.legal}</dt><dd>{org.legal_name}</dd></div>
            <div><dt>{c.type}</dt><dd>{inferOrgType(`${org.display_name} ${org.legal_name}`, locale, org.role_codes)}</dd></div>
            <div><dt>{c.activity}</dt><dd>{org.client_legal_profile?.activity ?? unknown}</dd></div>
            <div><dt>{locale === "ar" ? "البلد" : "Pays"}</dt><dd dir="ltr">{org.country_code}</dd></div>
            <div><dt>{locale === "ar" ? "المعرّف الضريبي (IF)" : "Identifiant fiscal (IF)"}</dt><dd dir="ltr">{org.client_legal_profile?.if_number ?? unknown}</dd></div>
            <div><dt>{locale === "ar" ? "السجل التجاري (RC)" : "Registre de commerce (RC)"}</dt><dd dir="ltr">{org.client_legal_profile?.rc_number ?? unknown}</dd></div>
            <div><dt>{locale === "ar" ? "المعرّف" : "Réf."}</dt><dd dir="ltr">{org.id.slice(0, 8)}…</dd></div>
          </dl>
        </article>
        <article className="client-card">
          <header><h2>{c.journey}</h2></header>
          <ol className="admin-journey">
            {journey.map((step) => (
              <li key={step.id} data-state={step.state}>
                <i aria-hidden />
                <span><strong>{step.label}</strong><small>{step.detail}</small></span>
              </li>
            ))}
          </ol>
        </article>
        <article className="client-card">
          <header className="client-priority-head"><h2>{locale === "ar" ? "إجراءات الملف" : "Actions sur le dossier"}</h2><Cta href={`/${locale}/administration/parcours${query}`}>{c.seeAll}</Cta></header>
          <ul className="admin-req-list">
            {required.map((item) => (
              <li key={item.title}>
                <span><strong>{item.title}</strong><small>{item.detail}</small></span>
                <Link href={item.href} className="admin-soft-cta">{c.open}</Link>
              </li>
            ))}
          </ul>
        </article>
      </section>
      <section className="admin-fiche-lower">
        <article className="client-card" id="membres">
          <header className="client-priority-head"><h2>{c.members}</h2></header>
          <ul className="client-feed">
            <li><Users className="size-4" aria-hidden /><span><strong>{c.membersCount}</strong><small dir="ltr">{fiche.memberships.length}</small></span></li>
            <li><span><strong>{c.roles}</strong><small>{roles.join(", ") || "—"}</small></span></li>
            <li><span><strong>{c.access}</strong><small>{fiche.memberships.filter((item) => item.status === "ACTIVE").length}</small></span></li>
            <li><span><strong>{c.invites}</strong><small>{fiche.memberships.filter((item) => item.status === "INVITED").length}</small></span></li>
          </ul>
          <p className="client-access-note">{locale === "ar" ? "إدارة الأدوار تتم من دليل المستخدمين." : "La gestion des rôles se fait depuis l’annuaire des utilisateurs."}</p>
          <Link href={membersHref} className="admin-soft-cta">{c.manageMembers}</Link>
        </article>
        <article className="client-card" id="boxes">
          <header className="client-priority-head"><h2>{c.boxes}</h2></header>
          <ul className="client-feed">
            <li><span><strong>{locale === "ar" ? "حالات الاشتراكات" : "États des abonnements"}</strong><small>{[...new Set(fiche.subscriptions.map(item => item.status))].join(", ") || "—"}</small></span></li>
            <li><span><strong>{c.boxesActive}</strong><small>{unknown}</small></span></li>
            <li><span><strong>{c.credits}</strong><small>{unknown}</small></span></li>
            <li><span><strong>{locale === "ar" ? "نهايات فترات الاشتراك" : "Fins de période des abonnements"}</strong><small dir="ltr">{fiche.subscriptions.map(item => item.current_period_end).filter(Boolean).join(", ") || "—"}</small></span></li>
          </ul>
          <Link href={`/${locale}/administration/finance${query}`} className="admin-dir-action" data-tone="mint">{c.seeFinance}</Link>
        </article>
        <article className="client-card">
          <header className="client-priority-head"><h2>{c.dossiers}</h2><Cta href={`/${locale}/administration/parcours${query}`}>{c.seeAll}</Cta></header>
          <ul className="client-feed">
            <li><span><strong>{c.requests}</strong><small>{fiche.requests.length}</small></span></li>
            <li><span><strong>{locale === "ar" ? "النزاعات" : "Litiges"}</strong><small>{fiche.disputes.length}</small></span></li>
            <li><span><strong>{c.diag}</strong><small>{fiche.diagnostics.length}</small></span></li>
            <li><span><strong>{c.missions}</strong><small>{fiche.missions.length}</small></span></li>
          </ul>
          <Link href={`/${locale}/administration/conformite-clients${query}`} className="admin-dir-action" data-tone="peach">{c.openCompliance}</Link>
        </article>
        <article className="client-card">
          <header className="client-priority-head"><h2>{c.lastChange}</h2><Cta href={`/${locale}/administration/operations${query}`}>{c.seeAll}</Cta></header>
          <ul className="client-feed">
            {history.length === 0 ? (
              <li><span><strong>—</strong><small>{c.lastChangeLead}</small></span></li>
            ) : history.map((item) => (
              <li key={item.ref}><span className="client-history-dot" data-tone="violet" /><span><strong>{item.label}</strong><small dir="ltr">{item.at?.slice(0, 16) ?? "—"}</small></span></li>
            ))}
          </ul>
          <Link href={`/${locale}/administration/operations${query}`} className="admin-dir-action" data-tone="violet">{c.seeAudit}</Link>
        </article>
      </section>
    </main>
  );
}

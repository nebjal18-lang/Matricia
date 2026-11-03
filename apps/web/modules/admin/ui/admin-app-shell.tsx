import Link from "next/link";
import { translateLocalPath } from "@/modules/shared/lib/auth/workspace-navigation";
import { Bell, Building2, ChevronDown, CircleHelp, Route, Search, Users } from "lucide-react";
import type { ReactNode } from "react";
import { adminActorLinks, adminParcoursLinks } from "@/modules/admin/data/spaces/admin-nav";
import { adminCopy } from "@/modules/admin/data/spaces/copy";
import { buildAdminNav, type AdminNavKey } from "@/modules/admin/ui/admin-nav";
import { WorkspaceAccountMenu } from "@/modules/shared/ui/workspace-account-menu";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

export type { AdminNavKey };

export function AdminAppShell({
  locale,
  selectedQuery,
  selectedOrganizationId,
  userEmail,
  active,
  searchAction,
  searchPlaceholder,
  alternateHref,
  title,
  lead,
  kicker,
  crumb,
  actions,
  actorCurrent,
  parcoursCurrent,
  children,
}: {
  locale: Locale;
  selectedQuery: string;
  selectedOrganizationId: string | null;
  userEmail: string | null;
  active: AdminNavKey;
  searchAction?: string;
  searchPlaceholder?: string;
  alternateHref: string;
  title?: string;
  lead?: string;
  kicker?: string;
  crumb?: ReactNode;
  actions?: ReactNode;
  actorCurrent?: string;
  parcoursCurrent?: string;
  children: ReactNode;
}): ReactNode {
  const c = adminCopy(locale);
  const alternate = locale === "fr" ? "ar" : "fr";
  const q = selectedQuery;
  const p = `/${locale}`;
  const actors = adminActorLinks(locale, q);
  const parcours = adminParcoursLinks(locale, q);
  const nav = buildAdminNav(locale, q);

  return (
    <div dir={locale === "ar" ? "rtl" : "ltr"} className="client-workspace admin-workspace">
      <aside className="client-side">
        <Link href={`${p}/administration/command-center${q}`} className="client-brand">
          <span className="client-brand-mark" aria-hidden>
            <svg viewBox="0 0 32 32" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 28V16a11 11 0 0 1 22 0v12" />
              <path d="M12 28V18a4 4 0 0 1 8 0v10" />
            </svg>
          </span>
          <span>
            <strong>Matricia</strong>
            <small>{c.space}</small>
          </span>
        </Link>
        <nav className="client-side-nav" aria-label={active === "home" ? c.commandNav : c.space}>
          {nav.map((item) => {
            const Icon = item.icon;
            if (item.key === "actors") {
              return (
                <details key={item.key} className="admin-side-group" open={active === "actors"}>
                  <summary data-active={active === "actors" ? "true" : undefined}>
                    <Users aria-hidden className="size-4" />
                    {item.label}
                    <ChevronDown aria-hidden className="size-3.5 admin-side-chevron" />
                  </summary>
                  <div className="admin-side-sub">
                    {actors.map((link) => (
                      <Link key={link.id} href={link.href} data-current={actorCurrent === link.id ? "true" : undefined}>{link.label}</Link>
                    ))}
                  </div>
                </details>
              );
            }
            if (item.key === "parcours") {
              return (
                <details key={item.key} className="admin-side-group" open={active === "parcours"}>
                  <summary data-active={active === "parcours" ? "true" : undefined}>
                    <Route aria-hidden className="size-4" />
                    {item.label}
                    <ChevronDown aria-hidden className="size-3.5 admin-side-chevron" />
                  </summary>
                  <div className="admin-side-sub">
                    {parcours.map((link) => (
                      <Link key={link.id} href={link.href} data-current={parcoursCurrent === link.id ? "true" : undefined}>{link.label}</Link>
                    ))}
                  </div>
                </details>
              );
            }
            return (
              <Link key={item.key} href={item.href} data-active={item.key === active ? "true" : undefined}>
                <Icon aria-hidden className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <p className="client-side-foot"><span aria-hidden>◆</span>{locale === "ar" ? "منصة لريادة الأعمال معاً" : "Une plateforme pour entreprendre demain, ensemble."}</p>
      </aside>
      <div className="client-frame">
        <div className="client-scene" aria-hidden>
          <div className="client-scene-arch" />
          <div className="client-scene-palms" />
          <div className="client-scene-pattern" />
        </div>
        <div className="client-topbar">
          <form className="client-top-search admin-shell-search" method="get" action={searchAction ?? `${p}/administration/command-center`} role="search" aria-label={searchPlaceholder ?? c.search}>
            {selectedOrganizationId ? <input type="hidden" name="organizationId" value={selectedOrganizationId} /> : null}
            <Search aria-hidden className="size-4" />
            <label className="sr-only" htmlFor="admin-shell-search">{searchPlaceholder ?? c.search}</label>
            <input id="admin-shell-search" name="q" placeholder={searchPlaceholder ?? c.search} />
          </form>
          <Link href={alternateHref} hrefLang={alternate} className="admin-lang">
            <span data-active={locale === "fr" ? "true" : undefined}>{c.langFr}</span>
            <span aria-hidden>|</span>
            <span data-active={locale === "ar" ? "true" : undefined}>{c.langAr}</span>
          </Link>
          <Link href={`${p}/notifications${q}`} className="client-icon-btn" aria-label={locale === "ar" ? "الإشعارات" : "Notifications"}><Bell className="size-4" /></Link>
          <Link href={`${p}/administration/operations${q}`} className="client-icon-btn" aria-label={locale === "ar" ? "الإشراف على العمليات" : "Supervision des opérations"} title={locale === "ar" ? "الإشراف على العمليات" : "Supervision des opérations"}><CircleHelp className="size-4" /></Link>
          <WorkspaceAccountMenu
            locale={locale}
            userEmail={userEmail}
            returnTo={translateLocalPath(alternateHref, alternate, locale)}
            fallbackInitial="A"
            label={c.administrator}
            workspace="administration"
          />
        </div>
        {new URL(alternateHref, "https://matricia.invalid").searchParams.get("navigation") === "role-fallback" ? <p role="status" className="m-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">{locale === "ar" ? "الصفحة المطلوبة غير متاحة بصلاحياتكم. تم فتح مساحتكم المسموح بها." : "La page demandée ne correspond pas à vos habilitations. Votre espace autorisé a été ouvert."}</p> : null}
        {crumb ? <div className="admin-crumb">{crumb}</div> : null}
        {title ? (
          <header className="client-mast">
            <div>
            <h1>{title}</h1>
              {lead ? <p>{lead}</p> : null}
            </div>
            <div className="client-offer-actions">
              {actions}
              {kicker ? <small className="client-hello-kicker">{kicker}</small> : null}
            </div>
          </header>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function AdminCrumb({
  locale,
  query,
  current,
  organizationName,
  items,
}: {
  locale: Locale;
  query: string;
  current?: string;
  organizationName?: string;
  items?: Array<{ href?: string; label: string }>;
}) {
  const c = adminCopy(locale);
  if (items) {
    return (
      <nav className="client-crumb" aria-label={c.navActors}>
        {items.map((item, index) => (
          <span key={`${item.label}-${index}`}>
            {index > 0 ? <span aria-hidden> / </span> : null}
            {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
          </span>
        ))}
      </nav>
    );
  }
  return (
    <nav className="client-crumb" aria-label={c.crumbOrgs}>
      <Link href={`/${locale}/administration/command-center${query}`}>{c.crumbAdmin}</Link>
      <span aria-hidden>/</span>
      <Link href={`/${locale}/administration/entreprises${query}`}>{c.crumbOrgs}</Link>
      {organizationName ? <><span aria-hidden>/</span><span>{organizationName}</span></> : null}
      {current ? <><span aria-hidden>/</span><span>{current}</span></> : null}
    </nav>
  );
}

export function AdminOrgActions({ href, label, tone = "primary" }: { href: string; label: string; tone?: "primary" | "danger" | "ghost" }) {
  return <Link href={href} className={tone === "danger" ? "admin-danger-cta" : tone === "ghost" ? "client-ghost-link" : "admin-primary-cta"}>{label}</Link>;
}

export function AdminBrandMark() {
  return <Building2 className="size-4" aria-hidden />;
}

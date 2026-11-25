import Link from "next/link";
import { translateLocalPath } from "@/modules/shared/lib/auth/workspace-navigation";
import { Activity, Bell, Building2, Landmark, Route, Search, Settings, Shield, Users } from "lucide-react";
import type { ReactNode } from "react";
import { adminActorLinks, adminParcoursLinks } from "@/modules/admin/data/spaces/admin-nav";
import { adminCopy } from "@/modules/admin/data/spaces/copy";
import { buildAdminFinanceLinks, buildAdminNav, buildAdminPilotLinks, buildAdminSettingsLinks, type AdminNavKey } from "@/modules/admin/ui/admin-nav";
import { AdminSideGroup } from "@/modules/admin/ui/admin-side-group";
import { WorkspaceAccountMenu } from "@/modules/shared/ui/workspace-account-menu";
import { WorkspaceMobileNav } from "@/modules/shared/ui/workspace-mobile-nav";
import { WorkspaceHashScroll } from "@/modules/shared/ui/hash-nav";
import { SpaceSceneHero } from "@/modules/shared/ui/space-scene-hero";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import "@/modules/client/ui/client-experience.css";
import "@/modules/admin/ui/admin-experience.css";
import "@/modules/admin/ui/admin-page-standard.css";
import "@/modules/shared/shell/admin-experience.css";

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
  sceneHero = false,
  children,
  mainLandmark = true,
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
  /** Photo hero mast — actor identity fiches only. */
  sceneHero?: boolean;
  children: ReactNode;
  /** Shell owns the single page `<main>` by default. Pass false only for rare embed cases. */
  mainLandmark?: boolean;
}): ReactNode {
  const c = adminCopy(locale);
  const alternate = locale === "fr" ? "ar" : "fr";
  const q = selectedQuery;
  const p = `/${locale}`;
  const actors = adminActorLinks(locale, q);
  const parcours = adminParcoursLinks(locale, q);
  const pilot = buildAdminPilotLinks(locale, q);
  const settings = buildAdminSettingsLinks(locale, q);
  const finance = buildAdminFinanceLinks(locale, q);
  const nav = buildAdminNav(locale, q);
  const Frame = mainLandmark ? "main" : "div";
  const sideNav = (
    <nav className="client-side-nav" aria-label={active === "home" ? c.commandNav : c.space}>
      {nav.map((item) => {
        const Icon = item.icon;
        if (item.key === "actors") {
          return (
            <AdminSideGroup key={item.key} label={item.label} active={active === "actors"} icon={<Users aria-hidden className="size-4" />}>
              {actors.map((link) => (
                <Link key={link.id} href={link.href} data-current={actorCurrent === link.id ? "true" : undefined}>{link.label}</Link>
              ))}
            </AdminSideGroup>
          );
        }
        if (item.key === "parcours") {
          return (
            <AdminSideGroup key={item.key} label={item.label} active={active === "parcours"} icon={<Route aria-hidden className="size-4" />}>
              {parcours.map((link) => (
                <Link key={link.id} href={link.href} data-current={parcoursCurrent === link.id ? "true" : undefined}>{link.label}</Link>
              ))}
            </AdminSideGroup>
          );
        }
        if (item.key === "finance") {
          return (
            <AdminSideGroup key={item.key} label={item.label} active={active === "finance"} icon={<Landmark aria-hidden className="size-4" />}>
              {finance.map((link) => (
                <Link key={link.id} href={link.href}>{link.label}</Link>
              ))}
            </AdminSideGroup>
          );
        }
        if (item.key === "pilot") {
          return (
            <AdminSideGroup key={item.key} label={item.label} active={active === "pilot"} icon={<Shield aria-hidden className="size-4" />}>
              {pilot.map((link) => (
                <Link key={link.id} href={link.href}>{link.label}</Link>
              ))}
            </AdminSideGroup>
          );
        }
        if (item.key === "settings") {
          return (
            <AdminSideGroup key={item.key} label={item.label} active={active === "settings"} icon={<Settings aria-hidden className="size-4" />}>
              {settings.map((link) => (
                <Link key={link.id} href={link.href}>{link.label}</Link>
              ))}
            </AdminSideGroup>
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
  );

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
        {sideNav}
        <p className="client-side-foot"><span aria-hidden>◆</span>{locale === "ar" ? "منصة لريادة الأعمال معاً" : "Une plateforme pour entreprendre demain, ensemble."}</p>
      </aside>
      <Frame className="client-frame">
        <div className="client-scene" aria-hidden>
          <div className="client-scene-arch" />
          <div className="client-scene-palms" />
          <div className="client-scene-pattern" />
        </div>
        <div className="client-topbar">
          <WorkspaceMobileNav
            locale={locale}
            title={locale === "ar" ? "قائمة الإدارة" : "Menu administration"}
            description={c.space}
            triggerLabel={locale === "ar" ? "فتح القائمة" : "Ouvrir le menu"}
          >
            {sideNav}
          </WorkspaceMobileNav>
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
          <Link href={`${p}/administration/operations${q}`} className="client-icon-btn" aria-label={locale === "ar" ? "الإشراف على العمليات" : "Supervision des opérations"} title={locale === "ar" ? "الإشراف على العمليات" : "Supervision des opérations"}><Activity className="size-4" /></Link>
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
        {title && sceneHero ? (
          <div className="admin-scene-mast">
            <SpaceSceneHero
              sceneSrc="/scenes/arch-city.png"
              title={title}
              meta={lead}
              badge={kicker ? <span className="mat-status" data-tone="sky">{kicker}</span> : undefined}
              actions={actions}
              priority
            />
          </div>
        ) : title ? (
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
        <WorkspaceHashScroll />
        <div className="admin-page-standard">{children}</div>
      </Frame>
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
    <nav className="client-crumb" aria-label={c.navActors}>
      <Link href={`/${locale}/administration/command-center${query}`}>{c.crumbAdmin}</Link>
      <span aria-hidden>/</span>
      <Link href={`/${locale}/administration/acteurs${query}`}>{c.navActors}</Link>
      {organizationName ? <><span aria-hidden>/</span><Link href={`/${locale}/administration/entreprises${query}`}>{organizationName}</Link></> : <><span aria-hidden>/</span><Link href={`/${locale}/administration/entreprises${query}`}>{c.crumbOrgs}</Link></>}
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

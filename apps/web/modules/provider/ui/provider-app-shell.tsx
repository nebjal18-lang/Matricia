import Image from "next/image";
import Link from "next/link";
import { safeReturnPath } from "@/modules/shared/lib/auth/return-path";
import { queryWithWorkspace, translateLocalPath, withDashboardWorkspaceHint } from "@/modules/shared/lib/auth/workspace-navigation";
import { Bell, Search, Sprout } from "lucide-react";
import { HashAwareLink, WorkspaceHashScroll } from "@/modules/shared/ui/hash-nav";
import { Suspense, type ReactNode } from "react";
import { ProviderLanguageLinks } from "./provider-language-links";
import { ProviderOrganizationSelector } from "./provider-organization-selector";
import { providerCopy } from "@/modules/provider/data/spaces/copy";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { WorkspaceAccountMenu } from "@/modules/shared/ui/workspace-account-menu";
import { WorkspaceMobileNavigation } from "@/modules/shared/ui/workspace-mobile-navigation";
import { SpaceSceneHero } from "@/modules/shared/ui/space-scene-hero";
import { buildProviderNav, type ProviderNavKey } from "@/modules/provider/ui/provider-nav";
import "@/modules/client/ui/client-experience.css";
import "./provider-experience.css";
import "./provider-page-standard.css";

export type { ProviderNavKey };

const routeByActive: Record<ProviderNavKey, string> = {
  home: "tableau-de-bord",
  qualify: "sous-traitant/qualification",
  questionnaires: "sous-traitant/questionnaires",
  services: "sous-traitant/services",
  consult: "sous-traitant/consultations",
  quotes: "sous-traitant/devis",
  missions: "sous-traitant/missions",
  contracts: "sous-traitant/contrats",
  planning: "sous-traitant/planning",
  documents: "sous-traitant/documents",
  billing: "sous-traitant/facturation",
  disputes: "sous-traitant/litiges",
  purchases: "sous-traitant/achats",
  reputation: "sous-traitant/reputation",
  marketing: "sous-traitant/marketing",
  messages: "sous-traitant/messages",
  modeClient: "sous-traitant/mode-client",
  company: "sous-traitant/entreprise",
  settings: "sous-traitant/parametres",
};

export function ProviderAppShell({
  locale,
  selectedQuery,
  languagePath,
  organizations=[],
  selectedOrganizationId,
  userEmail,
  active,
  title,
  lead,
  kicker,
  actions,
  sceneHero = false,
  children,
}: {
  locale: Locale;
  selectedQuery: string;
  languagePath?: string;
  organizations?:readonly {id:string;name:string}[];
  selectedOrganizationId: string | null;
  userEmail: string | null;
  active: ProviderNavKey;
  title?: string;
  lead?: string;
  kicker?: string;
  actions?: ReactNode;
  /** Photo hero mast — identity hubs only (identité / missions / devis). */
  sceneHero?: boolean;
  children: ReactNode;
}): ReactNode {
  const c = providerCopy(locale);
  const nav = buildProviderNav(locale, selectedQuery);
  const alternate = locale === "fr" ? "ar" : "fr";
  const route = routeByActive[active];
  const notificationsQuery = queryWithWorkspace(selectedQuery, "provider");
  const currentPath = safeReturnPath(languagePath, locale);
  const providerHomeHref = withDashboardWorkspaceHint(`/${locale}/tableau-de-bord${selectedQuery}`, locale, "provider");
  const homeHref = withDashboardWorkspaceHint(currentPath ?? `/${locale}/${route}${selectedQuery}`, locale, "provider");
  const altHref = translateLocalPath(homeHref, locale, alternate);

  return (
    <div dir={locale === "ar" ? "rtl" : "ltr"} className="client-workspace provider-workspace">
      <WorkspaceHashScroll />
      <aside className="client-side" aria-label={c.space}>
        <Link href={providerHomeHref} className="client-brand">
          <span className="client-brand-mark" aria-hidden>
            <svg viewBox="0 0 32 32" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 28V16a11 11 0 0 1 22 0v12" />
              <path d="M12 28V18a4 4 0 0 1 8 0v10" />
            </svg>
          </span>
          <span>
            <strong>Matricia</strong>
            <small className="provider-brand-space">{c.brandSpace}</small>
          </span>
        </Link>
        <WorkspaceMobileNavigation locale={locale}>
        <nav className="client-side-nav">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.key} href={item.href} data-active={item.key === active ? "true" : undefined}>
                <Icon aria-hidden className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        </WorkspaceMobileNavigation>
        <figure className="client-side-art">
          <Image src="/scenes/arch-city.png" alt="" width={220} height={120} className="client-side-art-image" />
          <figcaption>{c.brandFooter}</figcaption>
        </figure>
      </aside>
      <div className="client-frame">
        <div className="client-scene" aria-hidden>
          <div className="client-scene-arch" />
          <div className="client-scene-palms" />
          <div className="client-scene-pattern" />
        </div>
        <div className="client-topbar">
          <form
            className="client-top-search client-shell-search provider-shell-search"
            method="get"
            action={`/${locale}/sous-traitant/consultations`}
            role="search"
            aria-label={c.searchConsult}
          >
            {selectedOrganizationId ? <input type="hidden" name="organizationId" value={selectedOrganizationId} /> : null}
            <Search aria-hidden className="size-4" />
            <label className="sr-only" htmlFor="provider-shell-search">{c.searchConsult}</label>
            <input id="provider-shell-search" name="q" placeholder={c.searchGlobal} />
          </form>
          <Link href={`/${locale}/notifications${notificationsQuery}`} className="client-icon-btn" aria-label={locale === "ar" ? "الإشعارات" : "Notifications"}>
            <Bell className="size-4" />
          </Link>
          <Suspense fallback={<nav className="client-lang-switch" aria-label={locale === "ar" ? "اللغة" : "Langue"}><Link href={homeHref} aria-current="page">{locale.toUpperCase()}</Link><Link href={altHref}>{alternate.toUpperCase()}</Link></nav>}>
            <ProviderLanguageLinks locale={locale} fallback={homeHref} />
          </Suspense>
          <span className="client-space-chip">{c.space}</span>
          <WorkspaceAccountMenu
            workspace="provider"
            locale={locale}
            userEmail={userEmail}
            returnTo={homeHref}
            fallbackInitial="P"
            label={c.space}
          />
          <Link href={altHref} hrefLang={alternate} lang={alternate} className="sr-only">
            {alternate.toUpperCase()}
          </Link>
        </div>
        {organizations.length ? (
          <ProviderOrganizationSelector
            locale={locale}
            organizations={organizations}
            selectedOrganizationId={selectedOrganizationId}
            returnPath={languagePath ?? `/${locale}/${route}`}
            active={active}
          />
        ) : null}
        {title && sceneHero ? (
          <div className="client-scene-mast">
            <SpaceSceneHero
              sceneSrc="/scenes/arch-city.png"
              title={title}
              meta={lead}
              badge={kicker ? <span className="mat-status" data-tone="mint">{kicker}</span> : undefined}
              actions={actions}
              priority
            />
          </div>
        ) : title ? (
          <header className="client-mast provider-mast">
            <div>
              <p className="client-space-label">{c.space}</p>
              <h1>{title}</h1>
              {lead ? <p>{lead}</p> : null}
            </div>
            <div className="client-offer-actions provider-mast-actions">
              {actions}
              {kicker ? (
                <p className="provider-mast-tip">
                  <Sprout className="size-4" aria-hidden />
                  <span>{kicker}</span>
                </p>
              ) : null}
            </div>
          </header>
        ) : null}
        <div className="provider-page-standard">{children}</div>
      </div>
    </div>
  );
}

export function ProviderActions({ href, label }: { href: string; label: string }) {
  return <HashAwareLink href={href} className="client-cta">{label} →</HashAwareLink>;
}

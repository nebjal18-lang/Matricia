import Link from "next/link";
import { safeReturnPath } from "@/modules/shared/lib/auth/return-path";
import { translateLocalPath } from "@/modules/shared/lib/auth/workspace-navigation";
import { Bell, BookOpen, Lock, Search } from "lucide-react";
import type { ReactNode } from "react";
import { libraryCopy } from "@/modules/franchise/data/library/copy";
import { franchiseCopy } from "@/modules/franchise/data/spaces/copy";
import { buildFranchiseNav, type FranchiseNavKey } from "@/modules/franchise/ui/franchise-nav";
import { WorkspaceAccountMenu } from "@/modules/shared/ui/workspace-account-menu";
import { FranchiseMandateSelector } from "./franchise-access-state";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import "@/modules/client/ui/client-experience.css";
import "./franchise-experience.css";

export type { FranchiseNavKey };

export function FranchiseAppShell({
  locale,
  selectedQuery,
  languagePath,
  selectedOrganizationId,
  userEmail,
  active,
  title,
  lead,
  kicker,
  actions,
  mandateName,
  mandates,
  children,
}: {
  locale: Locale;
  selectedQuery: string;
  languagePath?: string;
  selectedOrganizationId: string | null;
  userEmail: string | null;
  active: FranchiseNavKey;
  title?: string;
  lead?: string;
  kicker?: string;
  actions?: ReactNode;
  mandateName?: string | null;
  mandates?: Array<{id:string;organizationId:string;label:string}>;
  children: ReactNode;
}): ReactNode {
  const c = franchiseCopy(locale);
  const n = libraryCopy(locale);
  const currentPath = safeReturnPath(languagePath, locale);
  const selectedFranchiseId = new URLSearchParams(selectedQuery.replace(/^\?/, "")).get("franchiseId");
  const nav = buildFranchiseNav(locale, selectedQuery);
  const routeByActive: Record<FranchiseNavKey, string> = {
    home: "accueil",
    library: "bibliotheque",
    services: "services",
    questionnaires: "questionnaires",
    rules: "regles",
    validations: "validations",
    perimeter: "perimetre",
    network: "fournisseurs",
    requests: "demandes",
    quality: "qualite",
    performance: "performance",
    followups: "relances",
    marketing: "marketing",
    documents: "documents",
    messages: "messages",
    governance: "gouvernance",
    finance: "finance",
  };

  return (
    <div dir={locale === "ar" ? "rtl" : "ltr"} className="client-workspace franchise-workspace">
      <aside className="client-side" aria-label={c.space}>
        <Link href={`/${locale}/franchise/accueil${selectedQuery}`} className="client-brand">
          <span className="client-brand-mark" aria-hidden>
            <svg viewBox="0 0 32 32" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 28V16a11 11 0 0 1 22 0v12" />
              <path d="M12 28V18a4 4 0 0 1 8 0v10" />
            </svg>
          </span>
          <span>
            <strong>Matricia</strong>
            <small>{n.brandSpace}</small>
          </span>
        </Link>
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
        <p className="client-side-foot"><span aria-hidden>◆</span>{n.sideFoot}</p>
      </aside>
      <div className="client-frame">
        <div className="client-scene" aria-hidden>
          <div className="client-scene-arch" />
          <div className="client-scene-palms" />
          <div className="client-scene-pattern" />
        </div>
        <div className="client-topbar franchise-topbar">
          <Link href={`/${locale}/franchise/accueil${selectedQuery}`} className="franchise-mobile-brand" aria-label="Matricia">
            <strong>Matricia</strong>
            <small>{n.brandSpace}</small>
          </Link>
          {mandateName ? (
            <span className="franchise-mandate-chip">
              <span className="franchise-mandate-chip-icon" aria-hidden>
                <BookOpen className="size-3.5" />
              </span>
              <span>
                <small>{n.mandateChip}</small>
                <strong>{mandateName}</strong>
              </span>
              <Lock className="size-3.5 franchise-mandate-lock" aria-hidden />
            </span>
          ) : null}
          {mandateName ? <span className="franchise-scope-chip">{n.scope}</span> : null}
          <form className="client-top-search client-shell-search" method="get" action={`/${locale}/franchise/recherche`} role="search" aria-label={n.search}>
            {selectedOrganizationId ? <input type="hidden" name="organizationId" value={selectedOrganizationId} /> : null}
            {selectedFranchiseId ? <input type="hidden" name="franchiseId" value={selectedFranchiseId} /> : null}
            <Search aria-hidden className="size-4" />
            <label className="sr-only" htmlFor="franchise-shell-search">{n.search}</label>
            <input id="franchise-shell-search" name="q" placeholder={n.search} />
          </form>
          <Link href={`/${locale}/franchise/recherche${selectedQuery}`} className="client-icon-btn franchise-mobile-search" aria-label={n.search}>
            <Search aria-hidden className="size-4" />
          </Link>
          <Link href={`/${locale}/notifications${selectedQuery}`} className="client-icon-btn" aria-label={locale === "ar" ? "الإشعارات" : "Notifications"}>
            <Bell className="size-4" />
            <span className="franchise-notify-dot" aria-hidden />
          </Link>
          <nav className="client-lang-switch" aria-label={n.language}>
            <Link href={currentPath ? (locale === "fr" ? currentPath : translateLocalPath(currentPath, locale, "fr")) : `/fr/franchise/${routeByActive[active]}${selectedQuery}`} aria-current={locale === "fr" ? "page" : undefined}>FR</Link>
            <span aria-hidden>|</span>
            <Link href={currentPath ? (locale === "ar" ? currentPath : translateLocalPath(currentPath, locale, "ar")) : `/ar/franchise/${routeByActive[active]}${selectedQuery}`} aria-current={locale === "ar" ? "page" : undefined}>AR</Link>
          </nav>
          <WorkspaceAccountMenu
            workspace="franchise"
            locale={locale}
            userEmail={userEmail}
            returnTo={currentPath ?? `/${locale}/franchise/accueil${selectedQuery}`}
            fallbackInitial="F"
            label={n.account}
            displayName={n.account}
            className="client-account client-account-named"
          />
        </div>
        <nav className="franchise-mobile-dock" aria-label={n.navHome}>
          {([
            { key: "home" as const, href: `/${locale}/franchise/accueil${selectedQuery}`, label: n.navHome, Icon: nav.find((item) => item.key === "home")!.icon },
            { key: "library" as const, href: `/${locale}/franchise/bibliotheque${selectedQuery}`, label: locale === "ar" ? "المحتويات" : "Contenus", Icon: nav.find((item) => item.key === "library")!.icon },
            { key: "network" as const, href: `/${locale}/franchise/fournisseurs${selectedQuery}`, label: n.navProviders, Icon: nav.find((item) => item.key === "network")!.icon },
            { key: "requests" as const, href: `/${locale}/franchise/demandes${selectedQuery}`, label: n.navRequests, Icon: nav.find((item) => item.key === "requests")!.icon },
          ]).map((item) => {
            const Icon = item.Icon;
            const dockActive =
              item.key === "home" ? active === "home"
                : item.key === "library" ? active === "library" || active === "services" || active === "questionnaires" || active === "rules" || active === "validations"
                  : item.key === "network" ? active === "network"
                    : active === "requests";
            return (
              <Link key={item.key} href={item.href} data-active={dockActive ? "true" : undefined}>
                <Icon aria-hidden className="size-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <Link
            href={`/${locale}/franchise/gouvernance${selectedQuery}`}
            data-active={active === "governance" || active === "quality" || active === "performance" || active === "followups" || active === "documents" || active === "messages" || active === "perimeter" || active === "finance" ? "true" : undefined}
          >
            <span aria-hidden>⋯</span>
            <span>{locale === "ar" ? "المزيد" : "Plus"}</span>
          </Link>
        </nav>
        {title ? (
          <header className="client-mast">
            <div>
              {kicker ? <p className="sr-only">{kicker}</p> : null}
              <h1>{title}</h1>
              {lead ? <p>{lead}</p> : null}
            </div>
            <div className="client-offer-actions">
              {actions}
            </div>
          </header>
        ) : null}
        <FranchiseMandateSelector locale={locale} mandates={mandates} organizationId={selectedOrganizationId} selectedFranchiseId={selectedFranchiseId} returnPath={currentPath ?? `/${locale}/franchise/${routeByActive[active]}`} />
        {children}
      </div>
    </div>
  );
}

export function FranchiseActions({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="client-cta">{label}</Link>;
}

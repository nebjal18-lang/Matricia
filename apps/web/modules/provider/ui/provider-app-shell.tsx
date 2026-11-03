import Image from "next/image";
import Link from "next/link";
import { safeReturnPath } from "@/modules/shared/lib/auth/return-path";
import { translateLocalPath } from "@/modules/shared/lib/auth/workspace-navigation";
import { Bell, Search, Sprout } from "lucide-react";
import type { ReactNode } from "react";
import { providerCopy } from "@/modules/provider/data/spaces/copy";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { WorkspaceAccountMenu } from "@/modules/shared/ui/workspace-account-menu";
import { buildProviderNav, type ProviderNavKey } from "@/modules/provider/ui/provider-nav";
import "@/modules/client/ui/client-experience.css";
import "./provider-experience.css";

export type { ProviderNavKey };

const routeByActive: Record<ProviderNavKey, string> = {
  home: "tableau-de-bord",
  qualify: "sous-traitant/qualification",
  services: "sous-traitant/services",
  consult: "sous-traitant/consultations",
  quotes: "sous-traitant/devis",
  missions: "sous-traitant/missions",
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
  children: ReactNode;
}): ReactNode {
  const c = providerCopy(locale);
  const nav = buildProviderNav(locale, selectedQuery);
  const alternate = locale === "fr" ? "ar" : "fr";
  const route = routeByActive[active];
  const currentPath = safeReturnPath(languagePath, locale);
  const homeHref = currentPath ?? (active === "home"
    ? `/${locale}/tableau-de-bord${selectedQuery}`
    : `/${locale}/${route}${selectedQuery}`);
  const altHref = currentPath ? translateLocalPath(currentPath, locale, alternate) : active === "home"
    ? `/${alternate}/tableau-de-bord${selectedQuery}`
    : `/${alternate}/${route}${selectedQuery}`;

  return (
    <div dir={locale === "ar" ? "rtl" : "ltr"} className="client-workspace provider-workspace">
      <aside className="client-side" aria-label={c.space}>
        <Link href={`/${locale}/tableau-de-bord${selectedQuery}`} className="client-brand">
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
        <figure className="client-side-art">
          <Image src="/scenes/arch-city.png" alt="" width={220} height={120} />
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
            action={homeHref.split("?")[0]}
            role="search"
            aria-label={c.searchConsult}
          >
            {selectedOrganizationId ? <input type="hidden" name="organizationId" value={selectedOrganizationId} /> : null}
            <Search aria-hidden className="size-4" />
            <label className="sr-only" htmlFor="provider-shell-search">{c.searchConsult}</label>
            <input id="provider-shell-search" name="q" placeholder={c.searchGlobal} />
          </form>
          <Link href={`/${locale}/notifications${selectedQuery}`} className="client-icon-btn" aria-label={locale === "ar" ? "الإشعارات" : "Notifications"}>
            <Bell className="size-4" />
          </Link>
          <nav className="client-lang-switch" aria-label={locale === "ar" ? "اللغة" : "Langue"}>
            <Link href={currentPath ? (locale === "fr" ? currentPath : altHref) : `/fr/${route}${selectedQuery}`} aria-current={locale === "fr" ? "page" : undefined}>FR</Link>
            <Link href={currentPath ? (locale === "ar" ? currentPath : altHref) : `/ar/${route}${selectedQuery}`} aria-current={locale === "ar" ? "page" : undefined}>AR</Link>
          </nav>
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
        {organizations.length?<form action={`/${locale}/${route}`} method="get" className="client-card mx-4 flex flex-wrap items-end gap-3"><label className="grid gap-2" htmlFor="provider-organization-selector">{locale==="ar"?"منظمة مقدم الخدمات":"Organisation prestataire"}<select id="provider-organization-selector" name="organizationId" defaultValue={selectedOrganizationId??""} required className="min-h-11 rounded-md border px-3"><option value="" disabled>{locale==="ar"?"اختر مؤسسة":"Choisir une organisation"}</option>{organizations.map(org=><option key={org.id} value={org.id}>{org.name}</option>)}</select></label><button className="client-cta" type="submit">{locale==="ar"?"عرض":"Afficher"}</button></form>:null}
        {title ? (
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
        {children}
      </div>
    </div>
  );
}

export function ProviderActions({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="client-cta">{label} →</Link>;
}

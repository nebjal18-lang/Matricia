import Image from "next/image";
import { safeReturnPath } from "@/modules/shared/lib/auth/return-path";
import Link from "next/link";
import { translateLocalPath } from "@/modules/shared/lib/auth/workspace-navigation";
import { Bell, Search } from "lucide-react";
import type { ReactNode } from "react";
import { clientDashboardCopy } from "@/modules/client/data/home/copy";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { ClientNavKey } from "@/modules/client/ui/client-nav";
import { buildClientNav } from "@/modules/client/ui/client-nav";
import { ClientWorkspaceNav } from "@/modules/client/ui/client-workspace-nav";
import { WorkspaceAccountMenu } from "@/modules/shared/ui/workspace-account-menu";
import "./client-experience.css";

export type { ClientNavKey };

function localeSwitchHref(locale: Locale, selectedQuery: string, active?: ClientNavKey) {
  const alternate: Locale = locale === "fr" ? "ar" : "fr";
  const items = buildClientNav({ locale: alternate, selectedQuery });
  const match = active ? items.find((item) => item.key === active) : null;
  return match?.href ?? `/${alternate}/tableau-de-bord${selectedQuery}`;
}

export function ClientAppShell({
  locale,
  selectedQuery,
  selectedOrganizationId,
  userEmail,
  organizationName,
  active,
  languagePath,
  searchAction,
  searchQuery = "",
  title,
  lead,
  kicker,
  actions,
  messagesUnread,
  theme = "default",
  children,
}: {
  locale: Locale;
  selectedQuery: string;
  selectedOrganizationId: string | null;
  userEmail: string | null;
  organizationName?: string | null;
  active?: ClientNavKey;
  messagesUnread?: boolean;
  languagePath?: string;
  searchAction?: string;
  searchQuery?: string;
  title?: string;
  lead?: string;
  kicker?: string;
  actions?: ReactNode;
  theme?: "default" | "follow";
  children: ReactNode;
}): ReactNode {
  const c = clientDashboardCopy[locale];
  const space = spaceCopy(locale);
  const alternate: Locale = locale === "fr" ? "ar" : "fr";
  const searchPath = searchAction ?? `/${locale}/client/recherche`;
  const accountLabel = organizationName?.trim() || space.space;
  const currentPath = safeReturnPath(languagePath,locale);
  const langHref = currentPath ? translateLocalPath(currentPath, locale, alternate) : localeSwitchHref(locale, selectedQuery, active);

  return (
    <div dir={locale === "ar" ? "rtl" : "ltr"} className="client-workspace" data-theme={theme}>
      <aside className="client-side" aria-label={c.navHome}>
        <Link href={`/${locale}/tableau-de-bord${selectedQuery}`} className="client-brand">
          <span className="client-brand-mark" aria-hidden>
            M
          </span>
          <span>
            <strong>Matricia</strong>
            <small>{c.brandTagline}</small>
          </span>
        </Link>
        <ClientWorkspaceNav locale={locale} selectedQuery={selectedQuery} messagesUnread={messagesUnread} active={active} />
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
        <div className="client-topbar client-shell-topbar">
          <form className="client-top-search client-shell-search" method="get" action={searchPath} role="search" aria-label={c.searchLabel}>
            {selectedOrganizationId ? <input type="hidden" name="organizationId" value={selectedOrganizationId} /> : null}
            <Search aria-hidden className="size-4" />
            <label className="sr-only" htmlFor="client-shell-search">
              {c.searchLabel}
            </label>
            <input id="client-shell-search" name="q" defaultValue={searchQuery} placeholder={c.searchSpace} />
          </form>
          <div className="client-top-actions">
            <Link href={`/${locale}/notifications${selectedQuery}`} className="client-icon-btn" aria-label={c.notifications}>
              <Bell className="size-4" />
            </Link>
            <Link href={langHref} hrefLang={alternate} lang={alternate} className="client-lang-pair">
              {c.languagePair}
            </Link>
            <WorkspaceAccountMenu
              workspace="client"
              locale={locale}
              userEmail={userEmail}
              returnTo={currentPath ?? `/${locale}/tableau-de-bord${selectedQuery}`}
              fallbackInitial="M"
              label={c.accountMenu}
              displayName={accountLabel}
              className="client-account client-account-named"
            />
          </div>
        </div>
        {title ? (
          <header className="client-mast">
            <div>
              <p className="client-space-label">{space.space}</p>
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

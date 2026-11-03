"use client";
import { Menu, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/modules/shared/ui/button";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { cn } from "@/modules/shared/lib/utils";
import { getPublicSiteCopy } from "./public-copy";
import type { WorkspaceNavigation } from "@/modules/shared/lib/auth/workspace-navigation";
import { selectWorkspace } from "@/modules/shared/lib/auth/select-workspace";
import { getPublicJourneyCopy } from "@/modules/public/data/journey/copy";

export function PublicNavigation({ locale, sessionNavigation }: { locale: Locale; sessionNavigation?: WorkspaceNavigation }) {
  const copy = getPublicSiteCopy(locale);
  const signedIn = sessionNavigation?.signedIn === true;
  const workspaceLabels = locale === "ar" ? { client: "عميل", provider: "مقدم خدمات", franchise: "امتياز", administration: "الإدارة" } : { client: "Client", provider: "Prestataire", franchise: "Franchisé", administration: "Administration" };
  const selected = sessionNavigation?.options.find(option => option.kind === sessionNavigation.landing);
  const spaceHref = selected?.href ?? `/${locale}/tableau-de-bord`;
  const spaceLabel = `${locale === "ar" ? "مساحتي" : "Mon espace"}${selected ? ` · ${workspaceLabels[selected.kind]}` : ""}`;
  const switchLabel = locale === "ar" ? "تغيير المساحة" : "Changer d’espace";
  const workspaceChoices = signedIn && (sessionNavigation?.options.length ?? 0) > 1 ? <details className="relative"><summary className="min-h-11 cursor-pointer rounded-md px-3 py-2 text-sm font-semibold">{switchLabel}</summary><div className="absolute end-0 z-50 min-w-48 rounded-lg border bg-white p-2 text-slate-950 shadow-lg">{sessionNavigation?.options.map(option => <form action={selectWorkspace} key={option.kind}><input type="hidden" name="locale" value={locale}/><input type="hidden" name="workspace" value={option.kind}/><button className="min-h-11 w-full rounded px-3 py-2 text-start hover:bg-slate-100" type="submit" aria-current={option.kind === sessionNavigation.landing ? "true" : undefined}>{workspaceLabels[option.kind]}</button></form>)}</div></details> : null;
  const journey = getPublicJourneyCopy(locale).nav;
  const alternate = locale === "fr" ? "ar" : "fr";
  const pathname = usePathname();
  const [menuState, setMenuState] = useState({ open: false, pathname });
  const menuOpen = menuState.open && menuState.pathname === pathname;
  const menuButton = useRef<HTMLButtonElement>(null);
  const mobileMenu = useRef<HTMLElement>(null);
  const alternatePath = pathname.replace(/^\/(fr|ar)(?=\/|$)/, `/${alternate}`);
  const links = [
    { label: journey.how, href: `/${locale}#comment-ca-marche` },
    { label: journey.companies, href: `/${locale}/entreprises` },
    { label: journey.providers, href: `/${locale}/fournisseur` },
    { label: journey.franchise, href: `/${locale}/franchise` },
    { label: journey.plans, href: `/${locale}/abonnements` },
    { label: journey.about, href: `/${locale}/a-propos` },
  ];

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => mobileMenu.current?.querySelector<HTMLElement>(focusableSelector)?.focus(), 0);
    return () => { window.clearTimeout(timer); document.body.style.overflow = previousOverflow; };
  }, [menuOpen]);

  const closeMenu = () => setMenuState({ open: false, pathname });
  const preserveLocaleContext = (event: React.MouseEvent<HTMLAnchorElement>) => {
    closeMenu();
    const suffix = window.location.search + window.location.hash;
    if (suffix) {
      event.preventDefault();
      window.location.assign(alternatePath + suffix);
    }
  };
  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") { event.preventDefault(); closeMenu(); menuButton.current?.focus(); return; }
    if (event.key !== "Tab") return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(focusableSelector));
    const index = nextMenuFocusIndex(focusable.indexOf(document.activeElement as HTMLElement), focusable.length, event.shiftKey);
    if (index === null) return;
    event.preventDefault();
    focusable[index]?.focus();
  };
  return <header dir={locale === "ar" ? "rtl" : "ltr"} className="premium-nav" onKeyDown={event => { if (event.key === "Escape" && menuOpen) { closeMenu(); menuButton.current?.focus(); } }}>
    <div className="premium-nav-inner">
      <div className="premium-mobile-cluster relative lg:hidden">
        <button ref={menuButton} type="button" aria-label={menuOpen ? journey.closeMenu : journey.openMenu} aria-expanded={menuOpen} aria-controls="public-mobile-navigation" onClick={() => setMenuState({ open: !menuOpen, pathname })} className={cn(buttonVariants({ variant: "outline", size: "icon" }), "premium-menu-trigger")}>{menuOpen ? <X aria-hidden="true"/> : <Menu aria-hidden="true"/>}</button>
        {menuOpen ? <nav ref={mobileMenu} id="public-mobile-navigation" aria-label={copy.navigationLabel} onKeyDown={handleMenuKeyDown} className="absolute start-0 z-50 mt-2 w-64 rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg">
          <ul className="space-y-1">
            {links.map(link => <li key={link.href}><Link href={link.href} onClick={closeMenu} aria-current={isPublicNavLinkActive(pathname, link.href) ? "page" : undefined} className="premium-mobile-nav-link">{link.label}</Link></li>)}
            <li><Link href={alternatePath} onClick={preserveLocaleContext} hrefLang={alternate} lang={alternate} className="flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent">{alternate === "ar" ? "العربية" : "Français"}</Link></li>
            {signedIn ? <><li><Link href={spaceHref} onClick={closeMenu} className="premium-mobile-nav-link">{spaceLabel}</Link></li>{workspaceChoices ? <li>{workspaceChoices}</li> : null}</> : <><li><Link href={`/${locale}/connexion`} onClick={closeMenu} className={cn(buttonVariants({ variant: "outline" }), "mt-1 min-h-11 w-full")}>{journey.login}</Link></li><li><Link href={`/${locale}/inscription`} onClick={closeMenu} className="premium-nav-action premium-nav-action-mobile">{journey.register}<ArrowRightIcon /></Link></li></>}
          </ul>
        </nav> : null}
      </div>
      <Link href={`/${locale}`} aria-label={copy.brandLabel} className="premium-nav-brand flex min-h-11 items-center gap-2 rounded-md font-semibold tracking-tight text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <svg aria-hidden="true" width="32" height="32" viewBox="0 0 40 40" fill="none"><path d="M8 28 20 8l12 20M14 28l6-12 6 12" stroke="#642bef" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="20" cy="30" r="2.2" fill="#e65290"/></svg>
        <span className="premium-nav-brand-text">
          <span className="text-xl text-[var(--mat-navy)]">Matricia</span>
          <small className="premium-nav-tagline">{copy.tagline}</small>
        </span>
      </Link>
      <nav aria-label={copy.navigationLabel} className="hidden items-center gap-1 lg:flex">
        {links.map(link => <Link key={link.href} href={link.href} aria-current={isPublicNavLinkActive(pathname, link.href) ? "page" : undefined} className="premium-nav-link">{link.label}</Link>)}
        <span className="premium-lang" aria-label={locale === "fr" ? "Langue" : "اللغة"}>
          <Link href={pathname} hrefLang={locale} lang={locale} aria-current="true" className="text-[var(--mat-navy)]">{locale.toUpperCase()}</Link>
          <span aria-hidden="true">|</span>
          <Link href={alternatePath} onClick={preserveLocaleContext} hrefLang={alternate} lang={alternate}>{alternate.toUpperCase()}</Link>
        </span>
        {signedIn ? <><Link href={spaceHref} className="premium-nav-login">{spaceLabel}</Link>{workspaceChoices}</> : <><Link href={`/${locale}/connexion`} className="premium-nav-login">{journey.login}</Link><Link href={`/${locale}/inscription`} className="premium-nav-action">{journey.register}<ArrowRightIcon /></Link></>}
      </nav>
      <Link href={signedIn ? spaceHref : `/${locale}/connexion`} className="premium-nav-account lg:hidden" aria-label={signedIn ? spaceLabel : journey.login}>
        <UserRound size={20} aria-hidden="true" />
      </Link>
    </div>
  </header>;
}

const focusableSelector = "a[href],button:not([disabled])";

export function nextMenuFocusIndex(currentIndex: number, count: number, backwards: boolean): number | null {
  if (count < 1) return null;
  if (currentIndex < 0) return backwards ? count - 1 : 0;
  return backwards ? (currentIndex - 1 + count) % count : (currentIndex + 1) % count;
}

export function isPublicNavLinkActive(pathname: string, href: string): boolean {
  const target = href.split("#", 1)[0] ?? href;
  if (/^\/(?:fr|ar)$/u.test(target)) return pathname === target;
  return pathname === target || pathname.startsWith(`${target}/`);
}

function ArrowRightIcon() { return <svg aria-hidden="true" className="rtl-mirror" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>; }

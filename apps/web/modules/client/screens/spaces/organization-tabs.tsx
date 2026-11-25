import { spaceCopy } from "@/modules/client/data/spaces/copy";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { HashAwareLink } from "@/modules/shared/ui/hash-nav";

export function OrganizationTabs({
  locale,
  query,
  active,
}: {
  locale: Locale;
  query: string;
  active: "profile" | "people" | "security";
}) {
  const c = spaceCopy(locale);
  return (
    <nav className="client-tabs" aria-label={c.orgTitle}>
      <HashAwareLink href={`/${locale}/organisation${query}`} aria-current={active === "profile" ? "page" : undefined}>{c.orgProfile}</HashAwareLink>
      <HashAwareLink href={`/${locale}/organisation${query}#sites`}>{c.sitesLocations}</HashAwareLink>
      <HashAwareLink href={`/${locale}/organisation/roles${query}`} aria-current={active === "people" ? "page" : undefined}>{c.people}</HashAwareLink>
      <HashAwareLink href={`/${locale}/organisation/roles${query}#invitations`}>{c.invitations}</HashAwareLink>
      <HashAwareLink href={`/${locale}/securite/compte${query}`} aria-current={active === "security" ? "page" : undefined}>{c.security}</HashAwareLink>
      <HashAwareLink href={`/${locale}/securite/sessions${query}`}>{c.sessions}</HashAwareLink>
    </nav>
  );
}

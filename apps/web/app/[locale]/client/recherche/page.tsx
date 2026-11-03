import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { clientDashboardCopy } from "@/modules/client/data/home/copy";
import { searchClientWorkspace } from "@/modules/client/data/search/workspace-search";
import { resolveClientSpace } from "@/modules/client/data/spaces/context";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { SearchResultsBoard } from "@/modules/client/screens/spaces/search-results-board";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function ClientSearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string; q?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveClientSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/client/recherche` }));
  const q = typeof query.q === "string" ? query.q : "";
  const result = await searchClientWorkspace({
    locale,
    organizationId: space.selectedOrganizationId,
    selectedQuery: space.selectedQuery,
    query: q,
  });
  const c = clientDashboardCopy[locale];
  return (
    <ClientAppShell
      languagePath={`/${locale}/client/recherche?${new URLSearchParams({organizationId:space.selectedOrganizationId,q})}`}
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail} organizationName={space.organizationName}
      searchQuery={q}
      title={c.searchResultsTitle}
      lead={c.searchResultsLead}
      kicker={spaceCopy(locale).kicker}
    >
      <SearchResultsBoard locale={locale} query={result.query} hits={result.hits} unavailable={result.unavailable} moreResults={result.moreResults} />
    </ClientAppShell>
  );
}

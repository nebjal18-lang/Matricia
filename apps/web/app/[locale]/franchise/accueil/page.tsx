import { notFound } from "next/navigation";
import { FranchiseAccessState, FranchiseOrganizationSelector } from "@/modules/franchise/ui/franchise-access-state";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { libraryCopy } from "@/modules/franchise/data/library/copy";
import { FranchiseLibraryHomeBoard } from "@/modules/franchise/screens/library/library-boards";
import { requireFranchiseLibrary } from "@/modules/franchise/screens/library/page-helper";
import { FranchiseAppShell } from "@/modules/franchise/ui/franchise-app-shell";

export default async function FranchiseHomePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string; franchiseId?:string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const { space, result } = await requireFranchiseLibrary({ returnPath: `/${locale}/franchise/accueil`, returnQuery: query, locale, organizationId: query.organizationId, franchiseId:query.franchiseId });
  const c = libraryCopy(locale);
  return (
    <FranchiseAppShell languagePath={space.currentPath} locale={locale} selectedQuery={space.selectedQuery} mandates={space.mandates} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="home" title={c.homeTitle} lead={c.homeLead} kicker={c.scope} mandateName={result.status === "success" ? result.workspace.mandate.libraryName : null}>
      <FranchiseOrganizationSelector locale={locale} organizations={space.organizations} selectedOrganizationId={space.selectedOrganizationId} returnPath={`/${locale}/franchise/accueil`} />
      {result.status === "error" ? (
        <FranchiseAccessState locale={locale} reason={result.reason} returnPath={`/${locale}/franchise/accueil${space.selectedQuery}`} />
      ) : (
        <FranchiseLibraryHomeBoard locale={locale} query={space.selectedQuery} workspace={result.workspace} />
      )}
    </FranchiseAppShell>
  );
}

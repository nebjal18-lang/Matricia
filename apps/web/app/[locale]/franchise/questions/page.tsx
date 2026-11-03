import { notFound } from "next/navigation";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { requireFranchiseLibrary } from "@/modules/franchise/screens/library/page-helper";
import { FranchiseQuestionsBoard } from "@/modules/franchise/screens/library/library-boards";
import { CatalogServerPagination } from "@/modules/franchise/screens/library/server-pagination";
import { FranchiseAppShell } from "@/modules/franchise/ui/franchise-app-shell";
import { FranchiseAccessState, FranchiseOrganizationSelector } from "@/modules/franchise/ui/franchise-access-state";

export default async function QuestionsPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string; franchiseId?: string; q?: string; page?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const { space, result } = await requireFranchiseLibrary({returnPath:`/${locale}/franchise/questions`,returnQuery:query, locale, organizationId: query.organizationId, franchiseId: query.franchiseId, catalog: { kind: "QUESTION", search: query.q, page: query.page } });
  const ar = locale === "ar", path = `/${locale}/franchise/questions`;
  const currentQuery = new URLSearchParams(space.selectedQuery.replace(/^\?/,""));
  if (query.q) currentQuery.set("q",query.q);
  if (query.page) currentQuery.set("page",query.page);
  const currentPath = `${path}${currentQuery.size ? `?${currentQuery}` : ""}`;
  return <FranchiseAppShell locale={locale} selectedQuery={space.selectedQuery} mandates={space.mandates} languagePath={currentPath} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="questionnaires" title={ar ? "بنك الأسئلة" : "Banque de questions"} mandateName={result.status === "success" ? result.workspace.mandate.libraryName : null}>
    <FranchiseOrganizationSelector locale={locale} organizations={space.organizations} selectedOrganizationId={space.selectedOrganizationId} returnPath={path} />
    {result.status === "error" ? <FranchiseAccessState locale={locale} reason={result.reason} returnPath={currentPath} /> : <main className="client-page">
      <form method="get" role="search">
        <input type="hidden" name="organizationId" value={result.workspace.mandate.operatorOrganizationId ?? ""} />
        <input type="hidden" name="franchiseId" value={result.workspace.mandate.franchiseId} />
        <label>{ar ? "بحث في جميع الأسئلة" : "Rechercher dans toutes les questions"}<input name="q" defaultValue={query.q ?? ""} maxLength={120} className="min-h-11 rounded border px-3" /></label>
        <button type="submit" className="franchise-tool">{ar ? "بحث" : "Rechercher"}</button>
      </form>
      <FranchiseQuestionsBoard query={space.selectedQuery} locale={locale} questions={result.workspace.questions} />
      <CatalogServerPagination page={result.workspace.serverPage} locale={locale} query={space.selectedQuery} />
    </main>}
  </FranchiseAppShell>;
}

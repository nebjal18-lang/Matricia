import { notFound } from "next/navigation";
import { FranchiseAccessState, FranchiseOrganizationSelector } from "@/modules/franchise/ui/franchise-access-state";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { libraryCopy } from "@/modules/franchise/data/library/copy";
import { franchiseCopy } from "@/modules/franchise/data/spaces/copy";
import { DocumentsBoard } from "@/modules/franchise/screens/spaces/boards";
import { franchiseMandateName, loadFranchiseSpaceFromLibrary, requireFranchiseLibrary } from "@/modules/franchise/screens/library/page-helper";
import { FranchiseAppShell } from "@/modules/franchise/ui/franchise-app-shell";

export default async function FranchiseDocumentsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string; franchiseId?:string; q?: string; page?: string; vue?: string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const { space, result } = await requireFranchiseLibrary({ returnPath: `/${locale}/franchise/documents`, returnQuery: query, locale, organizationId: query.organizationId, franchiseId:query.franchiseId });
  const c = libraryCopy(locale);
  const s = franchiseCopy(locale);
  const mandateName = franchiseMandateName(result);
  const board = result.status === "success" ? await loadFranchiseSpaceFromLibrary({ locale, query: space.selectedQuery, result }) : undefined;
  const view = query.vue === "verifier" ? "verifier" : null;
  return (
    <FranchiseAppShell languagePath={space.currentPath} locale={locale} selectedQuery={space.selectedQuery} mandates={space.mandates} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="documents" title={s.docsTitleRich} lead={s.docsLeadRich} kicker={c.scope} mandateName={mandateName}>
      <FranchiseOrganizationSelector locale={locale} organizations={space.organizations} selectedOrganizationId={space.selectedOrganizationId} returnPath={`/${locale}/franchise/documents`} />
      {result.status === "error" ? (
        <FranchiseAccessState locale={locale} reason={result.reason} returnPath={`/${locale}/franchise/documents${space.selectedQuery}`} />
      ) : (
        <DocumentsBoard locale={locale} query={space.selectedQuery} mandateName={mandateName} board={board} search={query.q} page={query.page} view={view} />
      )}
    </FranchiseAppShell>
  );
}

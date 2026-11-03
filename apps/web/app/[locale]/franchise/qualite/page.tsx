import { notFound } from "next/navigation";
import { franchiseCopy } from "@/modules/franchise/data/spaces/copy";
import { QualityBoard } from "@/modules/franchise/screens/spaces/boards";
import { franchiseCommandScope, franchiseMandateName, loadFranchiseSpaceFromLibrary, requireFranchiseLibrary } from "@/modules/franchise/screens/library/page-helper";
import { FranchiseAppShell } from "@/modules/franchise/ui/franchise-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function FranchiseQualityPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string; franchiseId?:string; q?: string; page?: string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const { space, result } = await requireFranchiseLibrary({ locale, organizationId: query.organizationId, franchiseId:query.franchiseId });
  const c = franchiseCopy(locale);
  const mandateName = franchiseMandateName(result);
  const board = await loadFranchiseSpaceFromLibrary({ locale, query: space.selectedQuery, result });
  const scope = franchiseCommandScope(result, space.selectedOrganizationId);
  return (
    <FranchiseAppShell locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="quality" title={c.qualTitleRich} lead={c.qualLeadRich} kicker={c.kicker} mandateName={mandateName}>
      <QualityBoard locale={locale} query={space.selectedQuery} mandateName={mandateName} board={board} search={query.q} page={query.page} libraryId={scope.libraryId} organizationId={scope.organizationId} services={scope.services} />
    </FranchiseAppShell>
  );
}

import { FranchiseAccessPage } from "@/modules/franchise/ui/franchise-access-page";
import { notFound } from "next/navigation";
import { franchiseCopy } from "@/modules/franchise/data/spaces/copy";
import { FranchiseFinanceBoard } from "@/modules/franchise/screens/spaces/boards";
import { loadFranchiseSpaceLive, requireFranchiseMandate } from "@/modules/franchise/screens/library/page-helper";
import { FranchiseAppShell } from "@/modules/franchise/ui/franchise-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function FranchiseFinancePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string; franchiseId?:string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const { space, mandate } = await requireFranchiseMandate({ returnPath: `/${locale}/franchise/finance`, returnQuery: query, locale, organizationId: query.organizationId, franchiseId:query.franchiseId });
  if (mandate.status === "error") return <FranchiseAccessPage locale={locale} space={space} reason={mandate.reason} active="finance" returnPath={space.currentPath} />;
  const c = franchiseCopy(locale);
  const mandateName = mandate.mandate.libraryName;
  const board = await loadFranchiseSpaceLive({ locale, query: space.selectedQuery, libraryName: mandateName, libraryId: mandate.mandate.libraryId, franchiseId: mandate.mandate.franchiseId, operatorOrganizationId: mandate.mandate.operatorOrganizationId });
  return (
    <FranchiseAppShell languagePath={space.currentPath} locale={locale} selectedQuery={space.selectedQuery} mandates={space.mandates} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="finance" title={c.finTitle} lead={c.finLead} kicker={c.kicker} mandateName={mandateName}>
      <FranchiseFinanceBoard locale={locale} query={space.selectedQuery} mandateName={mandateName} board={board} libraryId={mandate.mandate.libraryId} organizationId={mandate.mandate.operatorOrganizationId} />
    </FranchiseAppShell>
  );
}

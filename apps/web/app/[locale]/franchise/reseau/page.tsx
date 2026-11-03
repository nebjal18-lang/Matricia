import { FranchiseAccessPage } from "@/modules/franchise/ui/franchise-access-page";
import { notFound } from "next/navigation";
import { franchiseCopy } from "@/modules/franchise/data/spaces/copy";
import { NetworkBoard } from "@/modules/franchise/screens/spaces/boards";
import { franchiseCommandScope, franchiseMandateName, loadFranchiseSpaceFromLibrary, requireFranchiseLibrary } from "@/modules/franchise/screens/library/page-helper";
import { FranchiseActions, FranchiseAppShell } from "@/modules/franchise/ui/franchise-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function FranchiseNetworkPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string; franchiseId?:string; q?: string; page?: string;service?:string;status?:string;capacity?:string;zone?:string;docs?:string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const { space, result } = await requireFranchiseLibrary({ returnPath: `/${locale}/franchise/reseau`, returnQuery: query, locale, organizationId: query.organizationId, franchiseId:query.franchiseId });
  if (result.status === "error") return <FranchiseAccessPage locale={locale} space={space} reason={result.reason} active="network" returnPath={space.currentPath} />;
  const c = franchiseCopy(locale);
  const mandateName = franchiseMandateName(result);
  const board = await loadFranchiseSpaceFromLibrary({ locale, query: space.selectedQuery, result });
  const scope = franchiseCommandScope(result, space.selectedOrganizationId);
  return (
    <FranchiseAppShell languagePath={space.currentPath} locale={locale} selectedQuery={space.selectedQuery} mandates={space.mandates} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="network" title={c.netTitleRich} lead={c.netLeadRich} kicker={c.inviteHint} mandateName={mandateName} actions={<FranchiseActions href={`/${locale}/franchise/fournisseurs/inviter${space.selectedQuery}`} label={c.invite} />}>
      <NetworkBoard networkFilters={query} locale={locale} query={space.selectedQuery} mandateName={mandateName} board={board} search={query.q} page={query.page} organizationId={scope.organizationId} />
    </FranchiseAppShell>
  );
}

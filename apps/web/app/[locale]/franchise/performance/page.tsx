import { loadNativeFranchiseControl } from "@/modules/franchise/data/performance/native-control";
import { FranchiseNativePerformancePanel } from "@/modules/franchise/screens/performance/native-control-panel";
import { FranchiseAccessPage } from "@/modules/franchise/ui/franchise-access-page";
import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";
import { loadFranchiseGovernanceSignals } from "@/modules/franchise/data/governance-signals/repository";
import { FranchiseGovernanceSignalsPanel } from "@/modules/franchise/screens/performance/governance-signals-panel";
import { franchiseCopy } from "@/modules/franchise/data/spaces/copy";
import { loadFranchiseCrm } from "@/modules/franchise/data/crm/repository";
import { PerformanceBoard } from "@/modules/franchise/screens/spaces/boards";
import { FranchisePerformancePanel } from "@/modules/franchise/screens/performance/performance-panel";
import { getFranchiseCrmMessages } from "@/modules/franchise/screens/performance/messages";
import { franchiseMandateName, requireFranchiseLibrary, loadFranchiseSpaceFromLibrary } from "@/modules/franchise/screens/library/page-helper";
import { FranchiseAppShell } from "@/modules/franchise/ui/franchise-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function FranchisePerformancePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string; franchiseId?:string;before?:string;beforeId?:string;eventPlanId?:string;afterEventId?:string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const { space, result: library } = await requireFranchiseLibrary({ returnPath: `/${locale}/franchise/performance`, returnQuery: query, locale, organizationId: query.organizationId, franchiseId:query.franchiseId });
  if (library.status === "error") return <FranchiseAccessPage locale={locale} space={space} reason={library.reason} active="performance" returnPath={space.currentPath} />;
  const franchiseId = library.workspace.mandate.franchiseId;
  const [nativeControl, governanceSignals, r] = await Promise.all([
    loadNativeFranchiseControl(franchiseId, { before: query.before, id: query.beforeId, eventPlanId: query.eventPlanId, afterEventId: query.afterEventId }),
    loadFranchiseGovernanceSignals(franchiseId),
    loadFranchiseCrm(franchiseId),
  ]);
  if ([nativeControl, governanceSignals, r].some(result => result.status === "error" && result.reason === "UNAUTHENTICATED")) redirect(connexionHref(locale, { next: space.currentPath }));
  const m = getFranchiseCrmMessages(locale);
  const board=await loadFranchiseSpaceFromLibrary({locale,query:space.selectedQuery,result:library});
  const c = franchiseCopy(locale);
  const mandateName = franchiseMandateName(library);
  const keys: Record<string, string> = {};
  if (r.status === "success") {
    r.dashboard.franchises.forEach((f) => {
      keys[`create:${f.id}`] = randomUUID();
      keys[`snapshot:${f.id}`] = randomUUID();
    });
    r.dashboard.prospects.forEach((p) => {
      keys[`activity:${p.id}`] = randomUUID();
      keys[`advance:${p.id}`] = randomUUID();
    });
  }
  return (
    <FranchiseAppShell languagePath={space.currentPath} locale={locale} selectedQuery={space.selectedQuery} mandates={space.mandates} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="performance" title={c.perfTitleRich} lead={c.perfLeadRich} kicker={c.kicker} mandateName={mandateName}>
      <FranchiseNativePerformancePanel locale={locale} result={nativeControl} returnPath={space.currentPath} />
      <FranchiseGovernanceSignalsPanel locale={locale} result={governanceSignals} returnPath={space.currentPath} />
      <PerformanceBoard locale={locale} query={space.selectedQuery} mandateName={mandateName} board={board} />
      <details id="performance" className="client-ops">
        <summary>{c.opsPerf}</summary>
        {r.status === "error" ? (
          <WorkspaceFailure locale={locale} reason={r.reason} returnPath={space.currentPath} supportReference="FRANCHISE_PERFORMANCE_CRM" />
        ) : (
          <FranchisePerformancePanel dashboard={r.dashboard} locale={locale} m={m} keys={keys} />
        )}
      </details>
    </FranchiseAppShell>
  );
}

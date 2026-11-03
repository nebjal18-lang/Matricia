import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { franchiseCopy } from "@/modules/franchise/data/spaces/copy";
import { loadFranchiseCrm } from "@/modules/franchise/data/crm/repository";
import { PerformanceBoard } from "@/modules/franchise/screens/spaces/boards";
import { FranchisePerformancePanel } from "@/modules/franchise/screens/performance/performance-panel";
import { getFranchiseCrmMessages } from "@/modules/franchise/screens/performance/messages";
import { franchiseMandateName, requireFranchiseLibrary, loadFranchiseSpaceFromLibrary } from "@/modules/franchise/screens/library/page-helper";
import { FranchiseAppShell } from "@/modules/franchise/ui/franchise-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function FranchisePerformancePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string; franchiseId?:string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const { space, result: library } = await requireFranchiseLibrary({ locale, organizationId: query.organizationId, franchiseId:query.franchiseId });
  const m = getFranchiseCrmMessages(locale);
  const r = await loadFranchiseCrm(library.status === "success" ? library.workspace.mandate.franchiseId : "00000000-0000-4000-8000-000000000000");
  if (r.status === "error" && r.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/franchise/performance` }));
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
    <FranchiseAppShell locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="performance" title={c.perfTitleRich} lead={c.perfLeadRich} kicker={c.kicker} mandateName={mandateName}>
      <PerformanceBoard locale={locale} query={space.selectedQuery} mandateName={mandateName} board={board} />
      <details id="performance" className="client-ops">
        <summary>{c.opsPerf}</summary>
        {r.status === "error" ? (
          <Alert variant="destructive">
            <AlertTitle>{r.reason === "FORBIDDEN" ? m.accessDenied : m.queryFailed}</AlertTitle>
            <AlertDescription>{r.reason}</AlertDescription>
          </Alert>
        ) : (
          <FranchisePerformancePanel dashboard={r.dashboard} locale={locale} m={m} keys={keys} />
        )}
      </details>
    </FranchiseAppShell>
  );
}

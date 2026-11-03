import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { FranchiseAccessState, FranchiseOrganizationSelector } from "@/modules/franchise/ui/franchise-access-state";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";
import { franchiseCopy } from "@/modules/franchise/data/spaces/copy";
import { loadFranchiseDashboard } from "@/modules/franchise/data/governance/repository";
import { GovernanceBoard } from "@/modules/franchise/screens/spaces/boards";
import { GovernancePanel } from "@/modules/franchise/screens/gouvernance/governance-panel";
import { getFranchiseMessages } from "@/modules/franchise/screens/gouvernance/messages";
import { franchiseMandateName, loadFranchiseSpaceFromLibrary, requireFranchiseLibrary } from "@/modules/franchise/screens/library/page-helper";
import { FranchiseActions, FranchiseAppShell } from "@/modules/franchise/ui/franchise-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function FranchiseGovernancePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string; franchiseId?:string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const { space, result: library } = await requireFranchiseLibrary({ locale, organizationId: query.organizationId, franchiseId:query.franchiseId });
  const messages = getFranchiseMessages(locale);
  const result = library.status === "success" ? await loadFranchiseDashboard(locale, {
    franchiseId: library.workspace.mandate.franchiseId,
    organizationId: library.workspace.mandate.operatorOrganizationId ?? undefined,
    libraryId: library.workspace.mandate.libraryId,
  }) : null;
  if (result?.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/franchise/gouvernance` }));
  const c = franchiseCopy(locale);
  const mandateName = franchiseMandateName(library);
  const board=library.status==="success"&&result?.status==="success"?await loadFranchiseSpaceFromLibrary({locale,query:space.selectedQuery,result:library}):null;
  const keys: Record<string, string> = { invitation: randomUUID() };
  if (result?.status === "success") {
    result.dashboard.approvals.forEach((value) => {
      keys[`approval:${value.id}`] = randomUUID();
    });
    result.dashboard.books.forEach((value) => {
      keys[`fee:${value.id}`] = randomUUID();
      keys[`close:${value.id}`] = randomUUID();
      keys[`payout:${value.id}`] = randomUUID();
    });
  }
  return (
    <FranchiseAppShell locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="governance" title={c.govTitle} lead={c.govLead} kicker={c.govKicker} mandateName={mandateName} actions={result?.status === "success" ? <FranchiseActions href="#gouvernance" label={c.prepare} /> : null}>
      <FranchiseOrganizationSelector locale={locale} organizations={space.organizations} selectedOrganizationId={space.selectedOrganizationId} returnPath={`/${locale}/franchise/gouvernance`} />
      {library.status === "error" ? <FranchiseAccessState locale={locale} reason={library.reason} returnPath={`/${locale}/franchise/gouvernance${space.selectedQuery}`} />
        : result?.status === "error" ? <WorkspaceFailure locale={locale} reason={result.reason} returnPath={`/${locale}/franchise/gouvernance${space.selectedQuery}`} supportReference="FRANCHISE_GOVERNANCE" />
        : result?.status === "success" ? <>
          <GovernanceBoard locale={locale} query={space.selectedQuery} mandateName={mandateName} board={board ?? undefined} />
          <details id="gouvernance" className="client-ops" open>
            <summary>{c.opsGov}</summary>
            <GovernancePanel dashboard={result.dashboard} locale={locale} m={messages} keys={keys} />
          </details>
        </> : null}

    </FranchiseAppShell>
  );
}

import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { FranchiseAccessState, FranchiseOrganizationSelector } from "@/modules/franchise/ui/franchise-access-state";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { loadWorkspaceMarketingDashboard } from "@/modules/shared/lib/marketing-autopilot/repository";
import { loadMarketingDimensionLabels } from "@/modules/shared/lib/marketing-autopilot/dimension-labels";
import { loadMarketingBrandDefaults } from "@/modules/shared/lib/marketing-autopilot/brand-defaults";
import { marketingActionKeys } from "@/modules/admin/screens/marketing-autopilot/action-keys";
import { MarketingPanel } from "@/modules/admin/screens/marketing-autopilot/marketing-panel";
import { getMarketingMessages } from "@/modules/admin/screens/marketing-autopilot/messages";
import { franchiseCopy } from "@/modules/franchise/data/spaces/copy";
import { franchiseMandateName, requireFranchiseLibrary } from "@/modules/franchise/screens/library/page-helper";
import { FranchiseAppShell } from "@/modules/franchise/ui/franchise-app-shell";

export default async function FranchiseMarketingPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string; franchiseId?: string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const { space, result: library } = await requireFranchiseLibrary({ returnPath: `/${locale}/franchise/marketing`, returnQuery: query, locale, organizationId: query.organizationId, franchiseId: query.franchiseId });
  const m = getMarketingMessages(locale);
  const c = franchiseCopy(locale);
  const mandateName = franchiseMandateName(library);
  const returnPath = `/${locale}/franchise/marketing${space.selectedQuery}`;

  let body;
  if (library.status === "error") {
    body = <FranchiseAccessState locale={locale} reason={library.reason} returnPath={returnPath} />;
  } else {
    const result = space.errorReason
      ? { status: "error" as const, reason: space.errorReason }
      : await loadWorkspaceMarketingDashboard(space.selectedOrganizationId);
    if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: space.currentPath }));
    if (result.status === "error") {
      body = result.reason === "NO_ORGANIZATION"
        ? space.organizations.length > 1
          ? <FranchiseAccessState locale={locale} reason="ORGANIZATION_REQUIRED" returnPath={returnPath} />
          : <WorkspaceFailure locale={locale} reason="NO_ORGANIZATION" returnPath={returnPath} supportReference="FRANCHISE_MARKETING" />
        : <WorkspaceFailure locale={locale} reason={result.reason} returnPath={returnPath} supportReference="FRANCHISE_MARKETING" />;
    } else {
      const brandDefaults = space.selectedOrganizationId
        ? await loadMarketingBrandDefaults(space.selectedOrganizationId, locale, mandateName ? [mandateName] : [])
        : null;
      const dimensionLabels = await loadMarketingDimensionLabels(result.dashboard, locale);
      body = <MarketingPanel workspace dashboard={result.dashboard} brandDefaults={brandDefaults} dimensionLabels={dimensionLabels} locale={locale} m={m} keys={marketingActionKeys(result.dashboard)} />;
    }
  }

  return (
    <FranchiseAppShell languagePath={space.currentPath} locale={locale} selectedQuery={space.selectedQuery} mandates={space.mandates} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="marketing" title={m.workspaceTitle} lead={m.workspaceLead} kicker={c.kicker} mandateName={mandateName}>
      <FranchiseOrganizationSelector locale={locale} organizations={space.organizations} selectedOrganizationId={space.selectedOrganizationId} returnPath={`/${locale}/franchise/marketing`} />
      {body}
    </FranchiseAppShell>
  );
}

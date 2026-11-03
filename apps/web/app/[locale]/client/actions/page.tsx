import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { loadUserActionCenterWithinBudget } from "@/modules/shared/lib/action-center/repository";
import { filterDashboardActions } from "@/modules/shared/lib/action-center/dashboard-summary";
import { filterClientFacingActions } from "@/modules/client/data/home/view-model";
import { clientDashboardCopy } from "@/modules/client/data/home/copy";
import { resolveClientSpace } from "@/modules/client/data/spaces/context";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { RequiredActionsBoard } from "@/modules/client/screens/spaces/required-actions-board";
import { ClientApprovalsPanel } from "@/modules/client/screens/approbations/approval-panel";
import { getApprovalMessages } from "@/modules/client/screens/approbations/messages";
import { loadApprovalPolicyAccess, loadClientApprovalPolicies, loadClientApprovals } from "@/modules/client/screens/approbations/load";
import { ClientApprovalPoliciesPanel } from "@/modules/client/screens/approbations/policy-panel";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function ClientActionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string; approvalPage?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveClientSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/client/actions` }));
  const now = new Date().toISOString();
  const [result, approvals, policies, policyAccess] = await Promise.all([
    loadUserActionCenterWithinBudget(locale, now, space.selectedOrganizationId),
    loadClientApprovals(space.selectedOrganizationId, Number(query.approvalPage ?? "1")),
    loadClientApprovalPolicies(space.selectedOrganizationId),
    loadApprovalPolicyAccess(space.selectedOrganizationId),
  ]);
  const scoped = result.status === "success"
    ? filterClientFacingActions(filterDashboardActions(result.value.items, space.selectedOrganizationId), false)
    : [];
  const c = clientDashboardCopy[locale];
  const kicker = spaceCopy(locale).kicker;
  return (
    <ClientAppShell
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail} organizationName={space.organizationName}
      active="actions"
      title={c.actionsTitle}
      lead={c.actionsLead}
      kicker={kicker}
    >
      <RequiredActionsBoard
        locale={locale}
        items={scoped}
        organizationQuery={space.selectedQuery}
        error={result.status === "error"}
      />
      <ClientApprovalsPanel locale={locale} result={approvals} organizationId={space.selectedOrganizationId} messages={getApprovalMessages(locale)} />
      <ClientApprovalPoliciesPanel locale={locale} organizationId={space.selectedOrganizationId} userId={policyAccess?.userId ?? ""} canManage={policyAccess?.canManage ?? false} result={policyAccess ? policies : { status: "unavailable" }} messages={getApprovalMessages(locale)} />
    </ClientAppShell>
  );
}

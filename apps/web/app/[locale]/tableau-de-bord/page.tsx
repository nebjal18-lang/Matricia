import Link from "next/link";
import { Building2 } from "lucide-react";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { z } from "zod";
import { Alert, AlertDescription } from "@/modules/shared/ui/alert";
import { dashboardHomeCopy, isCatalogFixtureOrganizationName, resolveOrganizationContext } from "@/modules/shared/module-hub-copy";
import { filterDashboardActions, summarizeDashboardActions } from "@/modules/shared/lib/action-center/dashboard-summary";
import { loadUserActionCenterWithinBudget } from "@/modules/shared/lib/action-center/repository";
import { loadClientHomeSnapshot } from "@/modules/client/data/home/repository";
import { applyDemoClientHome } from "@/modules/client/data/home/demo-scenario";
import { filterClientFacingActions } from "@/modules/client/data/home/view-model";
import { loadProviderHomeSnapshot } from "@/modules/provider/data/home/repository";
import { filterProviderFacingActions } from "@/modules/provider/data/home/view-model";
import { isLocale, type Locale } from "@/modules/shared/lib/i18n/locale";
import { loadMyPlatformAccess } from "@/modules/shared/lib/account-security/platform-access";
import { resolveWorkspaceLanding, workspaceLandingPath } from "@/modules/shared/lib/connected-space/workspace-landing";
import { availableWorkspaces } from "@/modules/shared/lib/auth/workspace-navigation";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";
import { signOut } from "./actions";

const membershipRows = z.array(
  z.object({
    id: z.string().uuid(),
    organization_id: z.string().uuid(),
    organizations: z.object({ display_name: z.string().min(1), status: z.string() }),
  }),
);

const PROVIDER_ROLES = new Set(["PROVIDER_OWNER", "PROVIDER_MANAGER", "PROVIDER_SALES", "PROVIDER_TECHNICIAN", "PROVIDER_VIEWER", "PROVIDER_ACCOUNTING"]);

function OrganizationSwitcher({
  locale,
  m,
  organizationsUnavailable,
  memberships,
  selectedMembershipId,
  compact = false,
}: {
  locale: Locale;
  m: (typeof dashboardHomeCopy)[Locale];
  organizationsUnavailable: boolean;
  memberships: z.infer<typeof membershipRows> | null;
  selectedMembershipId: string | null;
  compact?: boolean;
}): ReactNode {
  const selected = memberships?.find((membership) => membership.id === selectedMembershipId);
  if (compact) {
    return (
      <details className="client-org-switch">
        <summary><Building2 aria-hidden className="size-4" />{selected?.organizations.display_name ?? m.organizationsTitle}</summary>
        {organizationsUnavailable ? (
          <p role="alert">{m.organizationError}</p>
        ) : !memberships || memberships.length === 0 ? (
          <p role="status">{m.organizationEmpty}</p>
        ) : (
          <ul>
            {memberships.map((membership) => {
              const current = membership.id === selectedMembershipId;
              return (
                <li key={membership.id}>
                  {current ? (
                    <span data-selected="true">{membership.organizations.display_name}</span>
                  ) : (
                    <Link href={`/${locale}/tableau-de-bord?organizationId=${encodeURIComponent(membership.organization_id)}`}>
                      {membership.organizations.display_name}
                    </Link>
                  )}
                </li>
              );
            })}
            <li><Link href={`/${locale}/organisation`}>{m.organizationCta}</Link></li>
          </ul>
        )}
      </details>
    );
  }
  return (
    <div className="admin-panel space-y-4">
      <h2 className="text-lg font-semibold">{m.organizationsTitle}</h2>
      <p className="text-sm text-[var(--ad-muted)]">{m.organizationsDescription}</p>
      {organizationsUnavailable ? (
        <p role="alert" className="text-sm text-destructive">{m.organizationError}</p>
      ) : !memberships || memberships.length === 0 ? (
        <p role="status" className="text-sm text-[var(--ad-muted)]">{m.organizationEmpty}</p>
      ) : (
        <ul className="space-y-3">
          {memberships.map((membership) => {
            const current = membership.id === selectedMembershipId;
            return (
              <li key={membership.id} className={`rounded-xl border p-4 ${current ? "border-[var(--ad-forest)] bg-[var(--mat-mint-soft)]" : "border-[var(--ad-border)]"}`}>
                <span className="block font-semibold">{membership.organizations.display_name}</span>
                <span className="mt-1 block text-sm text-[var(--ad-muted)]">{m.status[membership.organizations.status as keyof typeof m.status] ?? m.status.unknown}</span>
                {current ? (
                  <span className="admin-badge mt-3" data-tone="default">{m.selected}</span>
                ) : (
                  <Link href={`/${locale}/tableau-de-bord?organizationId=${encodeURIComponent(membership.organization_id)}`} className="admin-btn-outline mt-3 w-full">
                    {m.select} {membership.organizations.display_name}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Link href={`/${locale}/organisation`} className="admin-btn-outline w-full sm:w-auto">{m.organizationCta}</Link>
    </div>
  );
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ signout?: string; organizationId?: string; q?: string; workspace?: string; navigation?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();

  const access = await loadMyPlatformAccess();
  if (access.status === "error" && access.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/tableau-de-bord` }));
  if (access.status === "error") return <main dir={locale === "ar" ? "rtl" : "ltr"} className="mx-auto max-w-3xl p-6"><WorkspaceFailure locale={locale} reason={access.reason} returnPath={`/${locale}/tableau-de-bord`} /></main>;
  const supabase = access.client;
  const userId = access.userId;

  const now = new Date().toISOString();
  const membershipsQuery = await supabase
    .from("organization_memberships")
    .select("id,organization_id,organizations!inner(display_name,status)")
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .order("display_name", { ascending: true, referencedTable: "organizations" })
    .limit(25);

  const memberships = membershipRows.safeParse(membershipsQuery.data);
  const organizationsUnavailable = Boolean(membershipsQuery.error) || !memberships.success;
  if (organizationsUnavailable) return <main dir={locale === "ar" ? "rtl" : "ltr"} className="mx-auto max-w-3xl p-6"><WorkspaceFailure locale={locale} reason={membershipsQuery.error ? "QUERY_FAILED" : "INVALID_RESPONSE"} returnPath={`/${locale}/tableau-de-bord`} /></main>;
  const visibleMemberships = memberships.success
    ? (() => {
        const withoutFixtures = memberships.data.filter((membership) => !isCatalogFixtureOrganizationName(membership.organizations.display_name));
        return withoutFixtures.length > 0 ? withoutFixtures : memberships.data;
      })()
    : null;
  const requestedOrganizationId = typeof query.organizationId === "string" ? query.organizationId : null;
  const context = resolveOrganizationContext(
    visibleMemberships
      ? visibleMemberships.map((membership) => ({
          membershipId: membership.id,
          organizationId: membership.organization_id,
          displayName: membership.organizations.display_name,
        }))
      : [],
    requestedOrganizationId,
  );
  const selectedMembership = visibleMemberships?.find((membership) => membership.id === context.selected?.membershipId) ?? null;
  const m = dashboardHomeCopy[locale];
  const alternate = locale === "fr" ? "ar" : "fr";
  let selectedQuery = context.selected ? `?organizationId=${encodeURIComponent(context.selected.organizationId)}` : "";
  const hasPlatformRole = access.status === "ok" && access.requirementSatisfied && access.roles.size > 0;

  const [membershipRoles, actionCenter] = await Promise.all([
    context.selected
      ? supabase.from("organization_member_roles").select("role_code").eq("membership_id", context.selected.membershipId).is("revoked_at", null).limit(20)
      : Promise.resolve({ data: [] as Array<{ role_code: string }>, error: null }),
    loadUserActionCenterWithinBudget(locale, now, context.selected?.organizationId ?? null),
  ]);
  if (membershipRoles.error) return <main dir={locale === "ar" ? "rtl" : "ltr"} className="mx-auto max-w-3xl p-6"><WorkspaceFailure locale={locale} reason="QUERY_FAILED" returnPath={`/${locale}/tableau-de-bord${selectedQuery}`} /></main>;
  const roleCodes = new Set((membershipRoles.data ?? []).map((row) => String(row.role_code)));
  const defaultLanding = resolveWorkspaceLanding({
    membershipRoleCodes: roleCodes,
    platformRoleCodes: access.status === "ok" ? access.roles : [],
  });
  const allowed = availableWorkspaces(roleCodes, access.roles);
  const requestedWorkspace = allowed.find(kind => kind === query.workspace);
  const landing = requestedWorkspace ?? defaultLanding;
  if (requestedWorkspace) selectedQuery += `${selectedQuery ? "&" : "?"}workspace=${requestedWorkspace}`;
  const roleFallback = Boolean(query.workspace && !requestedWorkspace) || query.navigation === "role-fallback";
  if (landing === "administration" || landing === "franchise") redirect(workspaceLandingPath(locale, landing, `${selectedQuery}${roleFallback ? `${selectedQuery ? "&" : "?"}navigation=role-fallback` : ""}`));
  const navigationNotice = roleFallback ? <p role="status" className="mx-4 mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">{locale === "ar" ? "المساحة المطلوبة غير متاحة لحسابكم. تم فتح مساحتكم المسموح بها." : "L’espace demandé n’est pas habilité pour votre compte. Votre espace autorisé a été ouvert."}</p> : null;
  const isProviderSpace = [...roleCodes].some((role) => PROVIDER_ROLES.has(role));
  const preferProvider = landing === "provider" && isProviderSpace;

  const scopedRaw = actionCenter.status === "success" ? filterDashboardActions(actionCenter.value.items, context.selected?.organizationId ?? null) : [];
  const scopedItems = preferProvider ? filterProviderFacingActions(scopedRaw, hasPlatformRole) : filterClientFacingActions(scopedRaw, hasPlatformRole);
  const search = typeof query.q === "string" ? query.q.trim().toLowerCase() : "";
  const searchedItems = search ? scopedItems.filter((item) => `${item.title} ${item.detail} ${item.organizationName ?? ""}`.toLowerCase().includes(search)) : scopedItems;
  const summary = summarizeDashboardActions(searchedItems, now);

  const switcher = (compact: boolean) => (
    <OrganizationSwitcher
      locale={locale}
      m={m}
      organizationsUnavailable={organizationsUnavailable}
      memberships={visibleMemberships}
      selectedMembershipId={context.selected?.membershipId ?? null}
      compact={compact}
    />
  );

  if (preferProvider) {
    const snapshot = await loadProviderHomeSnapshot({
      organizationId: context.selected?.organizationId ?? null,
      locale,
      actionItems: searchedItems,
      now,
    });
    const { ProviderDashboardHome } = await import("@/modules/provider/screens/dashboard");
    return (
      <>
        {navigationNotice}
        {query.signout === "failed" || context.rejected ? (
          <div className="space-y-2 px-4 pt-4">
            {query.signout === "failed" ? <Alert variant="destructive"><AlertDescription>{m.signOutError}</AlertDescription></Alert> : null}
            {context.rejected ? <Alert variant="destructive"><AlertDescription>{m.contextRejected}</AlertDescription></Alert> : null}
          </div>
        ) : null}
        <ProviderDashboardHome
          locale={locale}
          userEmail={access.status === "ok" ? access.email : null}
          organizationName={selectedMembership?.organizations.display_name ?? (snapshot.status === "success" ? snapshot.organizationName : null)}
          selectedQuery={selectedQuery}
          alternate={alternate}
          search={typeof query.q === "string" ? query.q : ""}
          searchedItems={searchedItems}
          summary={summary}
          snapshot={snapshot}
          membershipSwitcher={switcher(false)}
          signOutAction={signOut}
        />
      </>
    );
  }

  const isTeamLead = [...roleCodes].some((role) => role === "CLIENT_OWNER" || role === "CLIENT_ADMIN");
  const snapshot = await loadClientHomeSnapshot({
    organizationId: context.selected?.organizationId ?? null,
    locale,
    actionItems: scopedItems,
    now,
    isTeamLead,
  });
  const demoHome = applyDemoClientHome({
    locale,
    organizationId: context.selected?.organizationId ?? null,
    organizationName: selectedMembership?.organizations.display_name ?? (snapshot.status === "success" ? snapshot.organizationName : null),
    selectedQuery,
    now,
    items: scopedItems,
    snapshot,
  });
  const visibleItems = search
    ? demoHome.items.filter((item) => `${item.title} ${item.detail} ${item.organizationName ?? ""}`.toLowerCase().includes(search))
    : demoHome.items;
  const demoSummary = summarizeDashboardActions(visibleItems, now);
  const { ClientDashboardHome } = await import("@/modules/client/screens/dashboard");

  return (
    <ClientDashboardHome
      locale={locale}
      userEmail={access.status === "ok" ? access.email : null}
      organizationName={selectedMembership?.organizations.display_name ?? null}
      selectedOrganizationId={context.selected?.organizationId ?? null}
      selectedQuery={selectedQuery}
      alternate={alternate}
      search={typeof query.q === "string" ? query.q : ""}
      searchedItems={visibleItems}
      summary={demoSummary}
      snapshot={demoHome.snapshot}
      membershipSwitcher={switcher(true)}
      actionCenterError={actionCenter.status === "error"}
      showSignoutError={query.signout === "failed"}
      contextRejected={context.rejected}
      signOutAction={signOut}
      now={now}
    />
  );
}

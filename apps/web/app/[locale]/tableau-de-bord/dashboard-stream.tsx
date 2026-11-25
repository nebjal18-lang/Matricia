import type { ReactNode } from "react";
import { Suspense } from "react";
import { Alert, AlertDescription } from "@/modules/shared/ui/alert";
import { dashboardHomeCopy } from "@/modules/shared/module-hub-copy";
import { filterDashboardActions, summarizeDashboardActions } from "@/modules/shared/lib/action-center/dashboard-summary";
import type { ActionCenterLoadResult } from "@/modules/shared/lib/action-center/repository";
import { applyDemoClientHome } from "@/modules/client/data/home/demo-scenario";
import type { ClientHomeSnapshot } from "@/modules/client/data/home/repository";
import { ClientDashboardHome } from "@/modules/client/screens/dashboard";
import { filterClientFacingActions } from "@/modules/client/data/home/view-model";
import type { ProviderHomeSnapshot } from "@/modules/provider/data/home/repository";
import { ProviderDashboardHome } from "@/modules/provider/screens/dashboard";
import { filterProviderFacingActions } from "@/modules/provider/data/home/view-model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { signOut } from "./actions";

type Shared = {
  locale: Locale;
  organizationId: string | null;
  organizationName: string | null;
  selectedQuery: string;
  alternate: "fr" | "ar";
  searchRaw: string;
  hasPlatformRole: boolean;
  now: string;
  userEmail: string | null;
  membershipSwitcher: ReactNode;
  showSignoutError: boolean;
  contextRejected: boolean;
  actionCenterPromise: Promise<ActionCenterLoadResult>;
};

function searchFilter<T extends { title: string; detail: string; organizationName?: string | null }>(items: readonly T[], searchRaw: string): T[] {
  const search = searchRaw.trim().toLowerCase();
  return search ? items.filter((item) => `${item.title} ${item.detail} ${item.organizationName ?? ""}`.toLowerCase().includes(search)) : [...items];
}

function ClientHomeView({
  snapshot,
  shared,
  items,
  actionCenterError,
  suppressAlerts,
}: {
  snapshot: ClientHomeSnapshot;
  shared: Shared;
  items: ReturnType<typeof filterClientFacingActions>;
  actionCenterError: boolean;
  suppressAlerts?: boolean;
}): ReactNode {
  const demoHome = applyDemoClientHome({
    locale: shared.locale,
    organizationId: shared.organizationId,
    organizationName: shared.organizationName ?? (snapshot.status === "success" ? snapshot.organizationName : null),
    selectedQuery: shared.selectedQuery,
    now: shared.now,
    items,
    snapshot,
  });
  const visibleItems = searchFilter(demoHome.items, shared.searchRaw);
  return (
    <ClientDashboardHome
      locale={shared.locale}
      userEmail={shared.userEmail}
      organizationName={shared.organizationName}
      selectedOrganizationId={shared.organizationId}
      selectedQuery={shared.selectedQuery}
      alternate={shared.alternate}
      search={shared.searchRaw}
      searchedItems={visibleItems}
      summary={summarizeDashboardActions(visibleItems, shared.now)}
      snapshot={demoHome.snapshot}
      membershipSwitcher={shared.membershipSwitcher}
      actionCenterError={actionCenterError}
      showSignoutError={suppressAlerts ? false : shared.showSignoutError}
      contextRejected={suppressAlerts ? false : shared.contextRejected}
      signOutAction={signOut}
      now={shared.now}
    />
  );
}

async function ClientDashboardResolved({ snapshot, shared }: { snapshot: ClientHomeSnapshot; shared: Shared }): Promise<ReactNode> {
  const actionCenter = await shared.actionCenterPromise;
  const scopedRaw = actionCenter.status === "success" ? filterDashboardActions(actionCenter.value.items, shared.organizationId) : [];
  return (
    <ClientHomeView
      snapshot={snapshot}
      shared={shared}
      items={filterClientFacingActions(scopedRaw, shared.hasPlatformRole)}
      actionCenterError={actionCenter.status === "error"}
    />
  );
}

async function ProviderDashboardResolved({ snapshot, shared }: { snapshot: ProviderHomeSnapshot; shared: Shared }): Promise<ReactNode> {
  const actionCenter = await shared.actionCenterPromise;
  const scopedRaw = actionCenter.status === "success" ? filterDashboardActions(actionCenter.value.items, shared.organizationId) : [];
  const searchedItems = searchFilter(filterProviderFacingActions(scopedRaw, shared.hasPlatformRole), shared.searchRaw);
  return (
    <ProviderDashboardHome
      locale={shared.locale}
      userEmail={shared.userEmail}
      organizationName={shared.organizationName ?? (snapshot.status === "success" ? snapshot.organizationName : null)}
      selectedQuery={shared.selectedQuery}
      alternate={shared.alternate}
      search={shared.searchRaw}
      searchedItems={searchedItems}
      summary={summarizeDashboardActions(searchedItems, shared.now)}
      snapshot={snapshot}
      membershipSwitcher={shared.membershipSwitcher}
      signOutAction={signOut}
    />
  );
}

export async function StreamedClientDashboard({
  snapshotPromise,
  shared,
}: {
  snapshotPromise: Promise<ClientHomeSnapshot>;
  shared: Shared;
}): Promise<ReactNode> {
  const snapshot = await snapshotPromise;
  const m = dashboardHomeCopy[shared.locale];
  return (
    <>
      {shared.showSignoutError || shared.contextRejected ? (
        <div className="space-y-2 px-4 pt-4">
          {shared.showSignoutError ? <Alert variant="destructive"><AlertDescription>{m.signOutError}</AlertDescription></Alert> : null}
          {shared.contextRejected ? <Alert variant="destructive"><AlertDescription>{m.contextRejected}</AlertDescription></Alert> : null}
        </div>
      ) : null}
      <Suspense fallback={<ClientHomeView snapshot={snapshot} shared={shared} items={[]} actionCenterError={false} suppressAlerts />}>
        <ClientDashboardResolved snapshot={snapshot} shared={shared} />
      </Suspense>
    </>
  );
}

export async function StreamedProviderDashboard({
  snapshotPromise,
  shared,
  navigationNotice,
}: {
  snapshotPromise: Promise<ProviderHomeSnapshot>;
  shared: Shared;
  navigationNotice: ReactNode;
}): Promise<ReactNode> {
  const snapshot = await snapshotPromise;
  const m = dashboardHomeCopy[shared.locale];
  const fallback = (
    <ProviderDashboardHome
      locale={shared.locale}
      userEmail={shared.userEmail}
      organizationName={shared.organizationName ?? (snapshot.status === "success" ? snapshot.organizationName : null)}
      selectedQuery={shared.selectedQuery}
      alternate={shared.alternate}
      search={shared.searchRaw}
      searchedItems={[]}
      summary={summarizeDashboardActions([], shared.now)}
      snapshot={snapshot}
      membershipSwitcher={shared.membershipSwitcher}
      signOutAction={signOut}
    />
  );
  return (
    <>
      {navigationNotice}
      {shared.showSignoutError || shared.contextRejected ? (
        <div className="space-y-2 px-4 pt-4">
          {shared.showSignoutError ? <Alert variant="destructive"><AlertDescription>{m.signOutError}</AlertDescription></Alert> : null}
          {shared.contextRejected ? <Alert variant="destructive"><AlertDescription>{m.contextRejected}</AlertDescription></Alert> : null}
        </div>
      ) : null}
      <Suspense fallback={fallback}>
        <ProviderDashboardResolved snapshot={snapshot} shared={shared} />
      </Suspense>
    </>
  );
}

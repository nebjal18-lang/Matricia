import type { ReactNode } from "react";
import type { DashboardActionSummary } from "@/modules/shared/lib/action-center/dashboard-summary";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { ProviderHomeSnapshot } from "@/modules/provider/data/home/repository";
import { providerCopy } from "@/modules/provider/data/spaces/copy";
import type { UserActionItem } from "@/modules/shared/lib/action-center/model";
import { ProviderHomeBoard } from "@/modules/provider/screens/spaces/boards";
import { ProviderAppShell } from "@/modules/provider/ui/provider-app-shell";

export function ProviderDashboardHome({
  locale,
  userEmail,
  organizationName,
  selectedQuery,
  searchedItems,
  snapshot,
}: {
  locale: Locale;
  userEmail: string | null;
  organizationName: string | null;
  selectedOrganizationId?: string | null;
  selectedQuery: string;
  alternate: "fr" | "ar";
  search: string;
  searchedItems: readonly UserActionItem[];
  summary: DashboardActionSummary;
  snapshot: ProviderHomeSnapshot;
  membershipSwitcher: ReactNode;
  signOutAction: (formData: FormData) => Promise<void>;
}): ReactNode {
  const c = providerCopy(locale);
  const selectedOrganizationId = selectedQuery.includes("organizationId=")
    ? decodeURIComponent(selectedQuery.split("organizationId=")[1] ?? "")
    : null;
  return (
    <ProviderAppShell
      locale={locale}
      selectedQuery={selectedQuery}
      selectedOrganizationId={selectedOrganizationId}
      userEmail={userEmail}
      active="home"
      title={c.homeTitle}
      lead={c.homeLead}
      kicker={organizationName ?? c.kicker}
    >
      <ProviderHomeBoard
        locale={locale}
        query={selectedQuery}
        actionItems={searchedItems}
        snapshot={snapshot}
        organizationName={organizationName}
      />
    </ProviderAppShell>
  );
}

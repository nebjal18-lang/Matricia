import type { ReactNode } from "react";
import { sensitivePageContext } from "./sensitive-page-context";
import type { AdminDirectoryGroup } from "@/modules/admin/data/spaces/directory";
import { buildHubMetrics } from "@/modules/admin/data/spaces/hub-metrics";
import { loadAdminSupervisionDashboard } from "@/modules/admin/data/supervision/repository";
import { AdminHubBoard } from "@/modules/admin/screens/spaces/boards";
import { type AdminNavKey } from "@/modules/admin/ui/admin-app-shell";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

export async function AdminModulePage({
  locale,
  active,
  path,
  title,
  lead,
  kicker,
  querySuffix,
  hubGroup,
  actorCurrent,
  parcoursCurrent,
  children,
}: {
  locale: Locale;
  active: AdminNavKey;
  path: string;
  title: string;
  lead?: string;
  kicker?: string;
  querySuffix?: string;
  hubGroup?: AdminDirectoryGroup["id"];
  actorCurrent?: string;
  parcoursCurrent?: string;
  children: ReactNode;
}) {
  const context = await sensitivePageContext({
    locale,
    active,
    path: `${path}${querySuffix ? `?${querySuffix}` : ""}`,
    title,
    lead,
    kicker,
    actorCurrent,
    parcoursCurrent,
  });
  if (context.status === "blocked") return context.view;
  const supervision = hubGroup ? await loadAdminSupervisionDashboard(80) : null;
  const metrics = hubGroup && supervision?.status === "success"
    ? buildHubMetrics(hubGroup, supervision.value, locale)
    : hubGroup
      ? buildHubMetrics(hubGroup, null, locale)
      : undefined;
  const query = querySuffix ? `?${querySuffix}` : "";
  return context.wrap(<>
    {hubGroup ? (
      <AdminHubBoard
        locale={locale}
        query={query}
        groupId={hubGroup}
        metrics={metrics}
        title={title}
      />
    ) : null}
    {children}
  </>);
}

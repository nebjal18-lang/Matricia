import type { ReactNode } from "react";
import { sensitivePageContext } from "./sensitive-page-context";
import type { AdminDirectoryGroup } from "@/modules/admin/data/spaces/directory";
import { buildHubMetrics } from "@/modules/admin/data/spaces/hub-metrics";
import { loadAdminSupervisionDashboard } from "@/modules/admin/data/supervision/repository";
import { adminDirectoryGroup } from "@/modules/admin/data/spaces/directory";
import { AdminHubBoard, AdminHubStrip } from "@/modules/admin/screens/spaces/boards";
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
  hubMode = "board",
  actorCurrent,
  parcoursCurrent,
  sceneHero = false,
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
  /** `board` = directory hub above the page; `strip` = compact related links after the workspace. */
  hubMode?: "board" | "strip";
  actorCurrent?: string;
  parcoursCurrent?: string;
  /** Photo hero mast — actor identity fiches only. */
  sceneHero?: boolean;
  children: ReactNode;
}) {
  const useBoard = Boolean(hubGroup) && hubMode === "board";
  const useStrip = Boolean(hubGroup) && hubMode === "strip";
  // One header recipe: hub board owns the title; otherwise the shell mast owns it.
  const context = await sensitivePageContext({
    locale,
    active,
    path: `${path}${querySuffix ? `?${querySuffix}` : ""}`,
    title: useBoard ? undefined : title,
    lead: useBoard ? undefined : lead,
    kicker: useBoard ? undefined : kicker,
    sceneHero: useBoard ? false : sceneHero,
    actorCurrent,
    parcoursCurrent,
  });
  if (context.status === "blocked") return context.view;
  const supervision = useBoard ? await loadAdminSupervisionDashboard(80) : null;
  const metrics = useBoard && supervision?.status === "success"
    ? buildHubMetrics(hubGroup!, supervision.value, locale)
    : useBoard
      ? buildHubMetrics(hubGroup!, null, locale)
      : undefined;
  const query = querySuffix ? `?${querySuffix}` : "";
  const stripGroup = useStrip && hubGroup ? adminDirectoryGroup(locale, query, hubGroup) : null;
  const relatedTitle = stripGroup
    ? locale === "ar"
      ? `صفحات مرتبطة — ${stripGroup.title}`
      : `Autres pages — ${stripGroup.title}`
    : locale === "ar"
      ? "صفحات مرتبطة"
      : "Autres pages";
  return context.wrap(<>
    {useBoard ? (
      <AdminHubBoard
        locale={locale}
        query={query}
        groupId={hubGroup!}
        metrics={metrics}
        title={title}
      />
    ) : null}
    {children}
    {useStrip ? (
      <section className="admin-hub-related mt-8 space-y-3" aria-label={relatedTitle}>
        <div className="admin-section-head">
          <div>
            <h2>{relatedTitle}</h2>
          </div>
        </div>
        <AdminHubStrip locale={locale} query={query} groupId={hubGroup!} />
      </section>
    ) : null}
  </>);
}

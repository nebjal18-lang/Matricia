import type { ReactNode } from "react";
import { sensitivePageContext } from "./sensitive-page-context";
import type { AdminDirectoryGroup } from "@/modules/admin/data/spaces/directory";
import { AdminHubStrip } from "@/modules/admin/screens/spaces/boards";
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
  children: ReactNode;
}) {
  const context = await sensitivePageContext({ locale, active, path: `${path}${querySuffix ? `?${querySuffix}` : ""}`, title, lead, kicker });
  if (context.status === "blocked") return context.view;
  return context.wrap(<>
    {hubGroup ? <div className="client-page admin-hub-wrap"><AdminHubStrip locale={locale} query="" groupId={hubGroup} /></div> : null}
    {children}
  </>);
}

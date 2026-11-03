import { readWorkspaceNavigation } from "@/modules/shared/lib/auth/workspace-navigation-server";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { WorkspaceLanding } from "./workspace-landing";

export type ConnectedWorkspaceShell = WorkspaceLanding;

export async function resolveWorkspaceShell(organizationId: string | null, locale: Locale = "fr", preferred?: string): Promise<ConnectedWorkspaceShell> {
  const result = await readWorkspaceNavigation(locale, organizationId, preferred);
  if (result.status === "error") throw new Error(`WORKSPACE_NAVIGATION_${result.reason}`);
  return result.navigation.landing ?? "client";
}

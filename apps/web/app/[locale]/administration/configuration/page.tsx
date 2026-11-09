import { randomUUID } from "node:crypto";
import { notFound, unstable_rethrow } from "next/navigation";
import { ConfigurationPanel } from "@/modules/admin/screens/configuration/panel";
import { configurationCopy } from "@/modules/admin/screens/configuration/copy";
import { sensitivePageContext } from "@/modules/admin/ui/sensitive-page-context";
import { loadConfigurationDashboard } from "@/modules/shared/lib/platform-configuration/repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { WorkspaceFailure, type WorkspaceFailureReason } from "@/modules/shared/ui/workspace-failure";

export const dynamic = "force-dynamic";
export default async function ConfigurationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = configurationCopy(locale), context = await sensitivePageContext({ locale, path: "configuration", active: "settings", title: c.title, lead: c.lead, roles: ["SUPER_ADMIN", "MATRICIA_ADMIN"], mainLandmark: true });
  if (context.status === "blocked") return context.view;
  let data: Awaited<ReturnType<typeof loadConfigurationDashboard>> | undefined;
  let failure: WorkspaceFailureReason = "QUERY_FAILED";
  try { data = await loadConfigurationDashboard(); }
  catch (error) {
    unstable_rethrow(error);
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    failure = /AAL2|MFA/u.test(code) ? "MFA_REQUIRED" : /FORBIDDEN|DENIED/u.test(code) ? "FORBIDDEN" : /CONFIGURATION|ENCRYPTION|MIGRATION/u.test(code) ? "CONFIGURATION" : "QUERY_FAILED";
  }
  if (!data) return context.wrap(<WorkspaceFailure locale={locale} reason={failure} returnPath={context.selfPath}/>);
  const keys: Record<string, string> = {};
  for (const section of data.sections) {
    keys[`save:${section.section}`] = randomUUID();
    for (const revision of section.revisions) keys[`revision:${revision.id}`] = randomUUID();
  }
  return context.wrap(<ConfigurationPanel locale={locale} data={data} keys={keys} observedAt={new Date().toISOString()}/>);
}

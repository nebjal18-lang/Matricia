import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound, unstable_rethrow } from "next/navigation";
import { ConfigurationPanel } from "@/modules/admin/screens/configuration/panel";
import { configurationCopy } from "@/modules/admin/screens/configuration/copy";
import { sensitivePageContext } from "@/modules/admin/ui/sensitive-page-context";
import { loadConfigurationDashboard } from "@/modules/shared/lib/platform-configuration/repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { WorkspaceFailure, type WorkspaceFailureReason } from "@/modules/shared/ui/workspace-failure";
import { AdminStep1Gate } from "@/modules/admin/ui/admin-step1-gate";

export const dynamic = "force-dynamic";
export default async function ConfigurationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = configurationCopy(locale);
  const fr = locale === "fr";
  const context = await sensitivePageContext({ locale, path: "configuration", active: "settings", title: c.title, lead: c.lead, roles: ["SUPER_ADMIN", "MATRICIA_ADMIN"] });
  if (context.status === "blocked") return context.view;
  let data: Awaited<ReturnType<typeof loadConfigurationDashboard>> | undefined;
  let failure: WorkspaceFailureReason = "QUERY_FAILED";
  try { data = await loadConfigurationDashboard(); }
  catch (error) {
    unstable_rethrow(error);
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    failure = /AAL2|MFA/u.test(code) ? "MFA_REQUIRED" : /FORBIDDEN|DENIED/u.test(code) ? "FORBIDDEN" : /CONFIGURATION|ENCRYPTION|MIGRATION/u.test(code) ? "CONFIGURATION" : "QUERY_FAILED";
  }
  const miseEnService = (
    <>
      <AdminStep1Gate locale={locale} current="configuration" />
      <details className="client-card p-4">
        <summary className="min-h-11 cursor-pointer font-semibold">{fr ? "Parcours de mise en service" : "مسار وضع المنصة في الخدمة"}</summary>
      <section className="admin-panel mt-4 space-y-4" data-tone="violet" aria-labelledby="settings-launch-title">
        <div className="admin-section-head">
          <div>
            <h2 id="settings-launch-title">{fr ? "Mise en service" : "وضع المنصة في الخدمة"}</h2>
            <p>{fr ? "Préparation (brouillons) → Configuration (versions approuvées) → Catalogue publié → Territoires." : "التحضير (مسودات) ← التكوين (نسخ معتمدة) ← الدليل المنشور ← الأقاليم."}</p>
          </div>
        </div>
        <nav className="client-tabs" aria-label={fr ? "Parcours de mise en service" : "مسار وضع المنصة في الخدمة"}>
          <Link href={`/${locale}/administration/preparation`}>{fr ? "Préparation" : "التحضير"}</Link>
          <Link href={`/${locale}/administration/catalogue`}>{fr ? "Catalogue" : "الدليل"}</Link>
          <Link href={`/${locale}/administration/notifications/modeles`}>{fr ? "Notifications" : "الإشعارات"}</Link>
          <Link href={`/${locale}/administration/signatures`}>{fr ? "Signatures" : "التوقيعات"}</Link>
          <Link href={`/${locale}/administration/operations`}>{fr ? "Opérations" : "العمليات"}</Link>
        </nav>
      </section>
      </details>
    </>
  );
  if (!data) {
    return context.wrap(<>
      {miseEnService}
      <WorkspaceFailure locale={locale} reason={failure} returnPath={context.selfPath}/>
    </>);
  }
  const keys: Record<string, string> = {};
  for (const section of data.sections) {
    keys[`save:${section.section}`] = randomUUID();
    for (const revision of section.revisions) keys[`revision:${revision.id}`] = randomUUID();
  }
  return context.wrap(<>
    {miseEnService}
    <ConfigurationPanel locale={locale} data={data} keys={keys} observedAt={new Date().toISOString()}/>
  </>);
}

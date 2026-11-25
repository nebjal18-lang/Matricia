import { AdminSearchResults } from "@/modules/admin/screens/command-center/search";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { loadAdminCommandCenter } from "@/modules/admin/data/command-center/repository";
import { resolveAdminSpace } from "@/modules/admin/data/spaces/context";
import { adminCopy } from "@/modules/admin/data/spaces/copy";
import { buildHubMetrics } from "@/modules/admin/data/spaces/hub-metrics";
import { loadAdminSupervisionDashboard } from "@/modules/admin/data/supervision/repository";
import { CommandCenterPanel } from "@/modules/admin/screens/command-center/command-center-panel";
import { getCommandCenterMessages } from "@/modules/admin/screens/command-center/messages";
import { AdminDirectoryBoard } from "@/modules/admin/screens/spaces/boards";
import { AdminAppShell } from "@/modules/admin/ui/admin-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function AdminCommandCenterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string; q?: string; actionPage?: string; actionStatus?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveAdminSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/administration/command-center` }));
  const m = getCommandCenterMessages(locale);
  const c = adminCopy(locale);
  const fr = locale === "fr";
  const [result, supervision] = await Promise.all([
    loadAdminCommandCenter(Number(query.actionPage ?? "1"), query.actionStatus),
    loadAdminSupervisionDashboard(50),
  ]);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") {
    redirect(connexionHref(locale, { next: `/${locale}/administration/command-center` }));
  }
  const currentParams = new URLSearchParams(space.selectedQuery);
  if (query.q?.trim()) currentParams.set("q", query.q.trim());
  if (query.actionPage) currentParams.set("actionPage", query.actionPage);
  if (query.actionStatus) currentParams.set("actionStatus", query.actionStatus);
  const currentQuery = currentParams.size ? `?${currentParams.toString()}` : "";
  const alternate = locale === "fr" ? "ar" : "fr";
  const keyCount = result.status === "success" ? result.dashboard.workItems.length * 2 + result.dashboard.actions.length + 1 : 1;
  const enrichment = supervision.status === "success" ? supervision.value.work_enrichment : {};
  const metrics = buildHubMetrics("home", supervision.status === "success" ? supervision.value : null, locale);

  return (
    <AdminAppShell
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail}
      active="home"
      alternateHref={`/${alternate}/administration/command-center${currentQuery}`}
      title={fr ? "Centre de pilotage" : "مركز القيادة"}
      lead={fr ? "Une file unifiée. Sélectionnez un dossier pour ouvrir son action." : "طابور موحّد. اختاروا ملفاً لفتح الإجراء الخاص به."}
      kicker={c.kicker}
    >
      {query.q?.trim() ? (
        <AdminSearchResults
          locale={locale}
          query={query.q.trim()}
          organizationQuery={space.selectedQuery}
          dashboard={result.status === "success" ? result.dashboard : null}
        />
      ) : null}

      <div className="client-page admin-command-home">
        {result.status === "error" ? (
          <section id="command-today" aria-label={fr ? "File du jour" : "طابور اليوم"}>
            <Alert variant="destructive">
              <AlertTitle>
                {result.reason === "FORBIDDEN" ? m.forbiddenPage : result.reason === "MFA_REQUIRED" ? m.mfaRequired : m.loadError}
              </AlertTitle>
              <AlertDescription>
                {fr
                  ? "La file n’a pas pu être chargée ; elle ne peut pas être considérée comme vide."
                  : "تعذر تحميل قائمة المعالجة. لا يمكن اعتبارها فارغة."}
              </AlertDescription>
            </Alert>
          </section>
        ) : (
          <CommandCenterPanel
            dashboard={result.dashboard}
            query={currentQuery}
            locale={locale}
            m={m}
            enrichment={enrichment}
            currentTime={new Date().toISOString()}
            keys={Array.from({ length: keyCount }, () => crypto.randomUUID())}
          />
        )}

        <details id="admin-directory" className="client-card admin-command-directory p-4">
          <summary className="min-h-11 cursor-pointer font-semibold">{fr ? "Répertoire plateforme" : "دليل المنصة"}</summary>
          <div className="mt-4">
            <AdminDirectoryBoard locale={locale} query={space.selectedQuery} metrics={metrics} embedded compact />
          </div>
        </details>
      </div>
    </AdminAppShell>
  );
}

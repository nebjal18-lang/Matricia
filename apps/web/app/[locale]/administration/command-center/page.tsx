import { AdminSearchResults } from "@/modules/admin/screens/command-center/search";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { loadAdminCommandCenter } from "@/modules/admin/data/command-center/repository";
import { resolveAdminSpace } from "@/modules/admin/data/spaces/context";
import { adminCopy } from "@/modules/admin/data/spaces/copy";
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
  searchParams: Promise<{ organizationId?: string; q?: string; actionPage?:string;actionStatus?:string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveAdminSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/administration/command-center` }));
  const m = getCommandCenterMessages(locale);
  const c = adminCopy(locale);
  const [result, supervision] = await Promise.all([loadAdminCommandCenter(Number(query.actionPage??"1"),query.actionStatus), loadAdminSupervisionDashboard(50)]);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/administration/command-center` }));
  const currentParams = new URLSearchParams(space.selectedQuery);
  if (query.q?.trim()) currentParams.set("q", query.q.trim());
  if (query.actionPage) currentParams.set("actionPage", query.actionPage);
  if (query.actionStatus) currentParams.set("actionStatus", query.actionStatus);
  const currentQuery = currentParams.size ? `?${currentParams.toString()}` : "";
  const alternate = locale === "fr" ? "ar" : "fr";
  const keyCount = result.status === "success" ? result.dashboard.workItems.length * 2 + result.dashboard.actions.length + 1 : 1;
  const enrichment = supervision.status === "success" ? supervision.value.work_enrichment : {};

  return (
    <AdminAppShell
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail}
      active="home"
      alternateHref={`/${alternate}/administration/command-center${currentQuery}`}
      title={c.space}
      lead={c.homeLead}
      kicker={c.kicker}
    >
      {query.q?.trim() ? <AdminSearchResults locale={locale} query={query.q.trim()} organizationQuery={space.selectedQuery} dashboard={result.status === "success" ? result.dashboard : null} /> : null}
      <AdminDirectoryBoard locale={locale} query={space.selectedQuery} />
      <details className="client-ops" id="command-today" open={Boolean(query.q?.trim())}>
        <summary>{m.today}</summary>
        {result.status === "error" ? (
          <Alert variant="destructive">
            <AlertTitle>{result.reason === "FORBIDDEN" ? m.forbiddenPage : result.reason === "MFA_REQUIRED" ? m.mfaRequired : m.loadError}</AlertTitle>
            <AlertDescription>{locale === "ar" ? "تعذر تحميل قائمة المعالجة. لا يمكن اعتبارها فارغة." : "La file n’a pas pu être chargée ; elle ne peut pas être considérée comme vide."}</AlertDescription>
          </Alert>
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
      </details>
    </AdminAppShell>
  );
}

import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { AdminReadError } from "@/modules/admin/ui/admin-read-error";
import { loadAdminCommandCenter } from "@/modules/admin/data/command-center/repository";
import { loadAdminSupervisionDashboard } from "@/modules/admin/data/supervision/repository";
import { OrganizationsBoard } from "@/modules/admin/screens/spaces/boards";
import { AdminAppShell, AdminCrumb } from "@/modules/admin/ui/admin-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { adminCopy } from "@/modules/admin/data/spaces/copy";
import { mapAdminOrgRows, mapAdminTreatQueue } from "@/modules/admin/data/spaces/view-model";
import { resolveAdminSpace } from "@/modules/admin/data/spaces/context";

export default async function AdminEntreprisesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string; q?: string; archives?: string; type?: string; status?: string; compliance?: string; plan?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const returnParams = new URLSearchParams();
  for (const key of ["organizationId", "q", "archives", "type", "status", "compliance", "plan"] as const) {
    if (query[key]) returnParams.set(key, query[key]!);
  }
  const returnHref = `/${locale}/administration/entreprises${returnParams.size ? `?${returnParams}` : ""}`;
  const space = await resolveAdminSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: returnHref }));
  const [result, command] = await Promise.all([
    loadAdminSupervisionDashboard(100),
    loadAdminCommandCenter().catch(error => { unstable_rethrow(error); return { status: "error", reason: "QUERY_FAILED" } as const; }),
  ]);
  const readError = result.status === "error" ? result.reason : null;
  if (readError === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: returnHref }));
  if (command.status === "error" && command.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: returnHref }));
  const uiParams=new URLSearchParams(space.selectedQuery);
  for(const key of ["q","archives","type","status","compliance","plan"]as const){if(query[key])uiParams.set(key,query[key]!);}
  const uiQuery=uiParams.size?`?${uiParams.toString()}`:"";
  const c = adminCopy(locale);
  const alternate = locale === "fr" ? "ar" : "fr";
  const rows = result.status === "success" ? mapAdminOrgRows(result.value.organizations, locale) : [];
  const treat = result.status === "success"
    ? mapAdminTreatQueue({
        locale,
        query: space.selectedQuery,
        organizations: result.value.organizations,
        requests: result.value.requests,
        workItems: command.status === "success" ? command.dashboard.workItems : [],
      })
    : mapAdminTreatQueue({
        locale,
        query: space.selectedQuery,
        organizations: [],
        requests: [],
        workItems: command.status === "success" ? command.dashboard.workItems : [],
      });

  return (
    <AdminAppShell
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail}
      active="actors"
      actorCurrent="orgs"
      searchAction={`/${locale}/administration/entreprises`}
      searchPlaceholder={c.searchOrgs}
      alternateHref={`/${alternate}/administration/entreprises${uiQuery}`}
      crumb={<AdminCrumb locale={locale} query={uiQuery} />}
      title={c.orgs}
      lead={c.orgsLead}
      actions={
        <>
          {result.status === "success" ? <a href={`/${locale}/administration/entreprises/export${uiQuery}`} className="admin-dir-action" data-tone="white"><Download className="size-4" aria-hidden />{c.export}</a> : null}
          {result.status === "success" || result.reason !== "FORBIDDEN" ? <Link href={`/${locale}/administration/entreprises/nouvelle${space.selectedQuery}`} className="admin-primary-cta"><Plus className="size-4" aria-hidden />{c.createOrg}</Link> : null}
        </>
      }
    >
      {readError ? (
        <main className="client-page">
          <AdminReadError locale={locale} reason={readError} retryHref={`/${locale}/administration/entreprises${uiQuery}`} />
        </main>
      ) : (
        <>
        {command.status === "error" ? <AdminReadError locale={locale}
          area="workQueue" reason={command.reason === "MFA_REQUIRED" || command.reason === "FORBIDDEN" ? "FORBIDDEN" : "UNAVAILABLE"}
          retryHref={`/${locale}/administration/entreprises${uiQuery}`} /> : null}
        <OrganizationsBoard
          locale={locale}
          query={uiQuery}
          rows={rows}
          treat={treat}
          search={query.q}
          archives={query.archives === "1"}
          filters={{ type: query.type, status: query.status, compliance: query.compliance, plan: query.plan }}
        />
        </>
      )}
    </AdminAppShell>
  );
}

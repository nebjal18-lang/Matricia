import {randomUUID} from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { resolveAdminSpace } from "@/modules/admin/data/spaces/context";
import { adminCopy } from "@/modules/admin/data/spaces/copy";
import { loadAdminOrganizationFiche } from "@/modules/admin/data/supervision/repository";
import { ArchiveOrganizationForm } from "@/modules/admin/screens/spaces/org-forms";
import { AdminAppShell, AdminCrumb } from "@/modules/admin/ui/admin-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function AdminEnterpriseArchivePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; organizationId: string }>;
  searchParams: Promise<{ organizationId?: string; mode?: string }>;
}) {
  const [{ locale, organizationId }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveAdminSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/administration/entreprises/${organizationId}/archiver` }));
  const result = await loadAdminOrganizationFiche(organizationId);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/administration/entreprises/${organizationId}/archiver` }));
  if (result.status === "error" && result.reason === "NOT_FOUND") notFound();
  const c = adminCopy(locale);
  const alternate = locale === "fr" ? "ar" : "fr";
  const org = result.status === "success" ? result.value.organization : null;
  const mode = query.mode === "disable" ? "disable" : "archive";

  return (
    <AdminAppShell
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail}
      active="actors"
      actorCurrent="orgs"
      searchAction={`/${locale}/administration/entreprises`}
      searchPlaceholder={c.searchList}
      alternateHref={`/${alternate}/administration/entreprises/${organizationId}/archiver${space.selectedQuery}`}
      crumb={<AdminCrumb locale={locale} query={space.selectedQuery} organizationName={org?.display_name} current={mode === "disable" ? c.disableTitle : c.archiveTitle} />}
      title={mode === "disable" ? c.disableTitle : c.archiveTitle}
      lead={mode === "disable" ? c.disableLead : c.archiveLead}
    >
      {result.status === "error" || !org ? (
        <main className="client-page">
          <Alert variant="destructive">
            <AlertTitle>{result.status === "error" && result.reason === "FORBIDDEN" ? (locale === "ar" ? "رفض الوصول" : "Accès refusé") : (locale === "ar" ? "تعذر التحميل" : "Chargement indisponible")}</AlertTitle>
            <AlertDescription>{result.status === "error" ? result.reason : "UNAVAILABLE"}</AlertDescription>
          </Alert>
        </main>
      ) : (
        <main className="client-page">
          <ArchiveOrganizationForm idempotencyKey={randomUUID()}
            locale={locale}
            query={space.selectedQuery}
            organizationId={org.id}
            displayName={org.display_name}
            status={org.status}
            mode={mode}
          />
        </main>
      )}
    </AdminAppShell>
  );
}

import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { resolveAdminSpace } from "@/modules/admin/data/spaces/context";
import { adminCopy } from "@/modules/admin/data/spaces/copy";
import { canApplyAdminDemo, demoOrganizationFiche } from "@/modules/admin/data/spaces/demo-overlay";
import { loadAdminOrganizationFiche } from "@/modules/admin/data/supervision/repository";
import { OrganizationFicheBoard } from "@/modules/admin/screens/spaces/boards";
import { AdminAppShell, AdminCrumb } from "@/modules/admin/ui/admin-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function AdminEnterpriseFichePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; organizationId: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale, organizationId }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveAdminSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/administration/entreprises/${organizationId}` }));
  const result = await loadAdminOrganizationFiche(organizationId);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/administration/entreprises/${organizationId}` }));
  if (result.status === "error" && result.reason === "NOT_FOUND" && !canApplyAdminDemo()) notFound();
  const demoFiche = result.status === "error" && canApplyAdminDemo() ? demoOrganizationFiche(organizationId) : null;
  const fiche = result.status === "success" ? result.value : demoFiche;
  if (!fiche && result.status === "error" && result.reason === "NOT_FOUND") notFound();
  const c = adminCopy(locale);
  const alternate = locale === "fr" ? "ar" : "fr";
  const name = fiche?.organization.display_name ?? c.orgTitle;

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
      alternateHref={`/${alternate}/administration/entreprises/${organizationId}${space.selectedQuery}`}
      crumb={<AdminCrumb locale={locale} query={space.selectedQuery} organizationName={name} />}
    >
      {!fiche ? (
        <div className="client-page">
          <Alert variant="destructive">
            <AlertTitle>{result.status === "error" && result.reason === "FORBIDDEN" ? (locale === "ar" ? "رفض الوصول" : "Accès refusé") : (locale === "ar" ? "تعذر التحميل" : "Chargement indisponible")}</AlertTitle>
            <AlertDescription>{result.status === "error" ? result.reason : ""}</AlertDescription>
          </Alert>
        </div>
      ) : (
        <OrganizationFicheBoard locale={locale} query={space.selectedQuery} fiche={fiche} />
      )}
    </AdminAppShell>
  );
}

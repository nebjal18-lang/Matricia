import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { resolveAdminSpace } from "@/modules/admin/data/spaces/context";
import { actorCopy } from "@/modules/admin/data/spaces/actors-copy";
import { adminCopy } from "@/modules/admin/data/spaces/copy";
import { canApplyAdminDemo, demoOrganizationFiche } from "@/modules/admin/data/spaces/demo-overlay";
import { loadAdminOrganizationFiche } from "@/modules/admin/data/supervision/repository";
import { ClientFicheBoard } from "@/modules/admin/screens/spaces/actor-boards";
import { AdminAppShell, AdminCrumb } from "@/modules/admin/ui/admin-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function AdminClientFichePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; organizationId: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale, organizationId }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveAdminSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/administration/clients/${organizationId}` }));
  const result = await loadAdminOrganizationFiche(organizationId);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/administration/clients/${organizationId}` }));
  if (result.status === "error" && result.reason === "NOT_FOUND" && !canApplyAdminDemo()) notFound();
  const demoFiche = result.status === "error" && canApplyAdminDemo() ? demoOrganizationFiche(organizationId) : null;
  const fiche = result.status === "success" ? result.value : demoFiche;
  if (!fiche && result.status === "error" && result.reason === "NOT_FOUND") notFound();
  const a = actorCopy(locale);
  const c = adminCopy(locale);
  const alternate = locale === "ar" ? "fr" : "ar";
  const name = fiche?.organization.display_name ?? a.clientsTitle;
  const status = fiche?.organization.status ?? "";

  return (
    <AdminAppShell
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail}
      active="actors"
      actorCurrent="clients"
      searchAction={`/${locale}/administration/clients`}
      searchPlaceholder={c.searchList}
      alternateHref={`/${alternate}/administration/clients/${organizationId}${space.selectedQuery}`}
      crumb={<AdminCrumb locale={locale} query={space.selectedQuery} items={[{ href: `/${locale}/administration/clients${space.selectedQuery}`, label: a.clientsTitle }, { label: name }]} />}
      title={name}
      lead={a.clientDossier}
      actions={
        fiche ? (
          <>
            <span className="admin-status">{status}</span>
            <Link href={`/${locale}/administration/entreprises/${organizationId}/modifier${space.selectedQuery}`} className="admin-primary-cta">{c.edit}</Link>
            <Link href={`/${locale}/administration/entreprises/${organizationId}/archiver${space.selectedQuery ? `${space.selectedQuery}&mode=disable` : "?mode=disable"}`} className="admin-danger-cta">{c.disable}</Link>
          </>
        ) : null
      }
    >
      {!fiche ? (
        <div className="client-page">
          <Alert variant="destructive">
            <AlertTitle>{result.status === "error" && result.reason === "FORBIDDEN" ? a.forbiddenSection : (locale === "ar" ? "تعذر التحميل" : "Chargement indisponible")}</AlertTitle>
            <AlertDescription>{result.status === "error" ? result.reason : ""}</AlertDescription>
          </Alert>
        </div>
      ) : (
        <ClientFicheBoard locale={locale} query={space.selectedQuery} fiche={fiche} />
      )}
    </AdminAppShell>
  );
}

import {randomUUID} from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { resolveAdminSpace } from "@/modules/admin/data/spaces/context";
import { adminCopy } from "@/modules/admin/data/spaces/copy";
import { CreateOrganizationForm } from "@/modules/admin/screens/spaces/org-forms";
import { AdminAppShell, AdminCrumb } from "@/modules/admin/ui/admin-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function AdminEnterpriseCreatePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveAdminSpace({ locale, organizationId: query.organizationId, returnPath: `/${locale}/administration/entreprises/nouvelle${query.organizationId ? `?organizationId=${encodeURIComponent(query.organizationId)}` : ""}` });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/administration/entreprises/nouvelle` }));
  const c = adminCopy(locale);
  const alternate = locale === "fr" ? "ar" : "fr";

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
      alternateHref={`/${alternate}/administration/entreprises/nouvelle${space.selectedQuery}`}
      crumb={<AdminCrumb locale={locale} query={space.selectedQuery} current={c.createOrg} />}
      title={c.createTitle}
      lead={c.createLead}
    >
      <main className="client-page">
        <CreateOrganizationForm idempotencyKey={randomUUID()} resourceId={randomUUID()} locale={locale} query={space.selectedQuery} />
      </main>
    </AdminAppShell>
  );
}

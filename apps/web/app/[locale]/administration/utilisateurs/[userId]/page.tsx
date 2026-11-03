import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { z } from "zod";
import { resolveAdminSpace } from "@/modules/admin/data/spaces/context";
import { actorCopy } from "@/modules/admin/data/spaces/actors-copy";
import { loadAdminActorUser } from "@/modules/admin/data/spaces/actors-repository";
import { UserFicheBoard } from "@/modules/admin/screens/spaces/actor-boards";
import { AdminActorLoadError } from "@/modules/admin/screens/spaces/actor-load-error";
import { AdminAppShell, AdminCrumb } from "@/modules/admin/ui/admin-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function AdminUserFichePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; userId: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale, userId }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale) || !z.string().uuid().safeParse(userId).success) notFound();
  const space = await resolveAdminSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/administration/utilisateurs/${userId}` }));
  const result = await loadAdminActorUser(userId,query.organizationId);
  if (result.status === "error") {
    if (result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/administration/utilisateurs/${userId}${space.selectedQuery}` }));
    if (result.reason === "NOT_FOUND") notFound();
    return <AdminActorLoadError locale={locale} userId={userId} reason={result.reason} space={space} />;
  }
  if (result.rows.length === 0) notFound();
  const a = actorCopy(locale);
  const alternate = locale === "ar" ? "fr" : "ar";
  const name = result.rows[0]?.displayName ?? result.rows[0]?.email ?? a.userFiche;

  return (
    <AdminAppShell
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail}
      active="actors"
      actorCurrent="users"
      searchAction={`/${locale}/administration/utilisateurs`}
      searchPlaceholder={a.searchUsers}
      alternateHref={`/${alternate}/administration/utilisateurs/${userId}${space.selectedQuery}`}
      crumb={<AdminCrumb locale={locale} query={space.selectedQuery} items={[{ href: `/${locale}/administration/entreprises${space.selectedQuery}`, label: locale === "ar" ? "الفاعلون" : "Acteurs" }, { href: `/${locale}/administration/utilisateurs${space.selectedQuery}`, label: a.usersTitle }, { label: name }]} />}
      title={`${a.userFiche} — ${name}`}
      lead={a.userFicheLead}
    >
      <UserFicheBoard locale={locale} query={space.selectedQuery} userId={userId} rows={result.rows} fiche={result.fiche} />
    </AdminAppShell>
  );
}

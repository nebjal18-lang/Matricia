import Link from "next/link";
import { Download, UserPlus } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { resolveAdminSpace } from "@/modules/admin/data/spaces/context";
import { actorCopy } from "@/modules/admin/data/spaces/actors-copy";
import { loadAdminActorDirectory } from "@/modules/admin/data/spaces/actors-repository";
import { UsersBoard } from "@/modules/admin/screens/spaces/actor-boards";
import { AdminAppShell, AdminCrumb } from "@/modules/admin/ui/admin-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string; q?: string; page?: string; org?: string; role?: string; status?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveAdminSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/administration/utilisateurs` }));
  const directory = await loadAdminActorDirectory();
  const a = actorCopy(locale);
  const alternate = locale === "ar" ? "fr" : "ar";
  const users = directory.users;
  const exportParams=new URLSearchParams(space.selectedQuery);for(const[key,value]of Object.entries(query))if(value&&key!=="page")exportParams.set(key,value);
  const exportQuery=exportParams.size?`?${exportParams.toString()}`:"";

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
      alternateHref={`/${alternate}/administration/utilisateurs${exportQuery}`}
      crumb={<AdminCrumb locale={locale} query={space.selectedQuery} items={[{ href: `/${locale}/administration/entreprises${space.selectedQuery}`, label: locale === "ar" ? "الفاعلون" : "Acteurs" }, { label: a.usersTitle }]} />}
      title={a.usersTitle}
      lead={a.usersLead}
      actions={
        <>
          <a href={`/${locale}/administration/utilisateurs/export${exportQuery}`} className="admin-dir-action" data-tone="white"><Download className="size-4" aria-hidden />{locale === "ar" ? "تصدير" : "Exporter"}</a>
          <Link href={`/${locale}/administration/utilisateurs/inviter${space.selectedQuery}`} className="admin-primary-cta"><UserPlus className="size-4" aria-hidden />{a.inviteUser}</Link>
        </>
      }
    >
      {directory.reason ? <p role="alert">{locale==="ar"?"بيانات المستخدمين غير متاحة. تحققوا من الصلاحيات والمصادقة.":"Annuaire indisponible. Vérifiez les habilitations et la MFA."}</p> : <UsersBoard page={Number(query.page??"1")} locale={locale} query={space.selectedQuery} users={users} invites={directory.invites} search={query.q} filters={{ org: query.org, role: query.role, status: query.status }} />}
    </AdminAppShell>
  );
}

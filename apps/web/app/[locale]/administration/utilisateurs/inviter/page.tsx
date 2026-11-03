import{createAdminInvitationFormDefaults}from"@/modules/admin/screens/spaces/invitation-defaults";
import {z}from"zod";
import {getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { resolveAdminSpace } from "@/modules/admin/data/spaces/context";
import { actorCopy } from "@/modules/admin/data/spaces/actors-copy";
import { loadAdminActorDirectory } from "@/modules/admin/data/spaces/actors-repository";
import { InviteUserForm } from "@/modules/admin/screens/spaces/actor-forms";
import { AdminAppShell, AdminCrumb } from "@/modules/admin/ui/admin-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function AdminInviteUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string; role?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveAdminSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/administration/utilisateurs/inviter` }));
  const directory = await loadAdminActorDirectory();
  const franchisesResult=await(await getSupabaseServerClient()).rpc("list_admin_assignable_franchises_v1");
  const franchises=z.array(z.object({id:z.string().uuid(),organizationId:z.string().uuid(),label:z.string()})).safeParse(franchisesResult.data);
  const a = actorCopy(locale);
  const alternate = locale === "ar" ? "fr" : "ar";
  const organizations = [
    ...directory.inviteOrganizations.map((item) => ({ id: item.id, displayName: item.displayName })),
    ...directory.organizations
      .filter((org) => !directory.inviteOrganizations.some((item) => item.id === org.id))
      .map((org) => ({ id: org.id, displayName: org.display_name })),
  ];

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
      alternateHref={`/${alternate}/administration/utilisateurs/inviter${space.selectedQuery}`}
      crumb={<AdminCrumb locale={locale} query={space.selectedQuery} items={[{ href: `/${locale}/administration/entreprises${space.selectedQuery}`, label: locale === "ar" ? "الفاعلون" : "Acteurs" }, { href: `/${locale}/administration/utilisateurs${space.selectedQuery}`, label: a.usersTitle }, { label: a.inviteTitle }]} />}
      title={a.inviteTitle}
      lead={a.inviteLead}
    >
      <main className="client-page">
        <InviteUserForm {...createAdminInvitationFormDefaults()}
          locale={locale}
          query={space.selectedQuery}
          organizations={organizations}
          eligibleIds={directory.inviteOrganizations.map((item) => item.id)}
          defaultOrganizationId={query.organizationId}
          defaultRole={query.role}
          franchises={!franchisesResult.error&&franchises.success?franchises.data:[]}
        />
      </main>
    </AdminAppShell>
  );
}

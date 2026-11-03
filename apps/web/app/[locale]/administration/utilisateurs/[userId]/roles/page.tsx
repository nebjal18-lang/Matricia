import{randomUUID}from"node:crypto";
import{accountAccessSchema}from"@/modules/admin/screens/account-access/model";
import{AccountAccessPanel}from"@/modules/admin/screens/account-access/panel";
import {getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { z } from "zod";
import { resolveAdminSpace } from "@/modules/admin/data/spaces/context";
import { actorCopy } from "@/modules/admin/data/spaces/actors-copy";
import { loadAdminActorUser } from "@/modules/admin/data/spaces/actors-repository";
import { EditUserRolesForm } from "@/modules/admin/screens/spaces/actor-forms";
import { AdminActorLoadError, AdminActorOrganizationPicker } from "@/modules/admin/screens/spaces/actor-load-error";
import { AdminAppShell, AdminCrumb } from "@/modules/admin/ui/admin-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function AdminUserRolesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; userId: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale, userId }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale) || !z.string().uuid().safeParse(userId).success) notFound();
  const space = await resolveAdminSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/administration/utilisateurs/${userId}/roles` }));
  const result = await loadAdminActorUser(userId,query.organizationId);
  if (result.status === "error") {
    if (result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/administration/utilisateurs/${userId}/roles${space.selectedQuery}` }));
    if (result.reason === "NOT_FOUND") notFound();
    return <AdminActorLoadError locale={locale} userId={userId} roles reason={result.reason} space={space} />;
  }
  if (query.organizationId === undefined) {
    const organizations = new Map<string, string>();
    for (const membership of result.rows) {
      if (membership.organizationId) organizations.set(membership.organizationId, membership.organizationName ?? membership.organizationId);
    }
    if (organizations.size > 1) {
      return <AdminActorOrganizationPicker locale={locale} userId={userId} space={space}
        organizations={[...organizations].map(([id, name]) => ({ id, name }))} />;
    }
  }
  const row = query.organizationId === undefined
    ? result.rows[0]
    : result.rows.find((item) => item.organizationId === query.organizationId);
  if (!row) notFound();
  const client=await getSupabaseServerClient();
  const contextResult=row.membershipId?await client.rpc("get_admin_role_editor_context_v1",{p_membership_id:row.membershipId}):{data:null,error:null};
  const accessResult=await client.rpc("get_admin_account_access_v1",{p_user_id:userId});
  const access=accountAccessSchema.safeParse(accessResult.data);
  const context=z.object({roles:z.array(z.object({roleCode:z.string(),franchiseId:z.string().uuid().nullable(),franchiseLabel:z.string().nullable()})),franchises:z.array(z.object({id:z.string().uuid(),label:z.string()}))}).safeParse(contextResult.data);
  const a = actorCopy(locale);
  const alternate = locale === "ar" ? "fr" : "ar";

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
      alternateHref={`/${alternate}/administration/utilisateurs/${userId}/roles${space.selectedQuery}`}
      crumb={<AdminCrumb locale={locale} query={space.selectedQuery} items={[{ href: `/${locale}/administration/entreprises${space.selectedQuery}`, label: locale === "ar" ? "الفاعلون" : "Acteurs" }, { href: `/${locale}/administration/utilisateurs${space.selectedQuery}`, label: a.usersTitle }, { href: `/${locale}/administration/utilisateurs/${userId}${space.selectedQuery}`, label: row.displayName??row.email??a.userFiche }, { label: a.editRoles }]} />}
      title={a.editRoles}
      lead={a.editRolesLead}
      kicker={locale === "ar" ? "وصول مضبوط لنظام أكثر أماناً" : "Des accès maîtrisés pour un écosystème plus sûr"}
    >
      <main className="client-page">
        {row.organizationId&&row.organizationName&&row.membershipId?(!contextResult.error&&context.success?<EditUserRolesForm
          locale={locale}
          query={space.selectedQuery}
          userId={userId}
          organizationId={row.organizationId}
          organizationName={row.organizationName}
          currentRole={row.roles[0] ?? ""}
          roleAssignments={!contextResult.error&&context.success?context.data.roles:[]}
          franchises={!contextResult.error&&context.success?context.data.franchises:[]}
        />:<p role="alert">{locale==="ar"?"تعذر تحميل الأدوار الحالية. حدّث الملف قبل التغيير.":"Les rôles actuels sont indisponibles. Actualisez la fiche avant tout changement."}</p>):<section className="client-card"><h2>{locale==="ar"?"حساب بدون مؤسسة":"Compte sans organisation"}</h2><p>{locale==="ar"?"ليس لهذا الحساب أي عضوية. أدوار المنصة والجلسات مستقلة عن أدوار المؤسسات.":"Ce compte n’a aucune adhésion. Ses rôles plateforme et ses sessions sont gérés séparément."}</p></section>}
        {!accessResult.error&&access.success?<AccountAccessPanel context={access.data}locale={locale}requestKey={randomUUID()}/>:<p role="alert">{locale==="ar"?"تعذر تحميل مراجعة وصول الحساب. يلزم تفويض وتحقق متعدد العوامل.":"La revue des accès du compte est indisponible. Vérifiez vos habilitations et votre MFA."}</p>}
      </main>
    </AdminAppShell>
  );
}

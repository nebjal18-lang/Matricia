import{randomUUID}from"node:crypto";
import{notFound,redirect}from"next/navigation";
import{z}from"zod";
import{isLocale}from"@/modules/shared/lib/i18n/locale";
import{connexionHref}from"@/modules/shared/lib/auth/connexion-href";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import{franchiseCopy}from"@/modules/franchise/data/spaces/copy";
import{resolveFranchiseSpace}from"@/modules/franchise/data/spaces/context";
import{previewFranchiseInvitation}from"@/modules/franchise/screens/gouvernance/invitation-activation-actions";
import{FranchiseInvitationActivationForm}from"@/modules/franchise/screens/gouvernance/invitation-activation-form";
import{FranchiseAppShell}from"@/modules/franchise/ui/franchise-app-shell";

export default async function FranchiseInvitationPage({params}:{params:Promise<{locale:string;invitationId:string}>}){
  const{locale,invitationId}=await params;
  if(!isLocale(locale)||!z.string().uuid().safeParse(invitationId).success)notFound();
  const client=await getSupabaseServerClient();
  const user=await client.auth.getUser();
  if(!user.data.user)redirect(connexionHref(locale,{next:`/${locale}/franchise/invitations/${invitationId}`}));
  const space=await resolveFranchiseSpace({locale});
  if(space.status==="unauthenticated")redirect(connexionHref(locale,{next:`/${locale}/franchise/invitations/${invitationId}`}));
  const preview=await previewFranchiseInvitation(invitationId);
  const c=franchiseCopy(locale);
  const ar=locale==="ar";
  return (
    <FranchiseAppShell languagePath={`/${locale}/franchise/invitations/${invitationId}`} locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="governance" title={ar?"تفعيل دعوة الامتياز":"Activation d’invitation franchise"} lead={c.kicker}>
      <main className="client-page" dir={ar?"rtl":"ltr"}>
        {preview
          ? <FranchiseInvitationActivationForm locale={locale} keyValue={randomUUID()} initialPreview={preview}/>
          : <p role="alert">{ar?"الدعوة غير متاحة لهذا الحساب أو المنظمة. تحققوا من حساب المستلم.":"Cette invitation est indisponible pour ce compte ou cette organisation. Vérifiez le compte du destinataire."}</p>}
      </main>
    </FranchiseAppShell>
  );
}

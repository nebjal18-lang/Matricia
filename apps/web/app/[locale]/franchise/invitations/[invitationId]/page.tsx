import{randomUUID}from"node:crypto";
import{notFound,redirect}from"next/navigation";
import{z}from"zod";
import{isLocale}from"@/modules/shared/lib/i18n/locale";
import{connexionHref}from"@/modules/shared/lib/auth/connexion-href";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import{previewFranchiseInvitation}from"@/modules/franchise/screens/gouvernance/invitation-activation-actions";
import{FranchiseInvitationActivationForm}from"@/modules/franchise/screens/gouvernance/invitation-activation-form";
export default async function FranchiseInvitationPage({params}:{params:Promise<{locale:string;invitationId:string}>}){const{locale,invitationId}=await params;if(!isLocale(locale)||!z.string().uuid().safeParse(invitationId).success)notFound();const client=await getSupabaseServerClient();const user=await client.auth.getUser();if(!user.data.user)redirect(connexionHref(locale,{next:`/${locale}/franchise/invitations/${invitationId}`}));const preview=await previewFranchiseInvitation(invitationId);return<main className="client-page" dir={locale==="ar"?"rtl":"ltr"}>{preview?<FranchiseInvitationActivationForm locale={locale} keyValue={randomUUID()} initialPreview={preview}/>:<p role="alert">{locale==="ar"?"الدعوة غير متاحة لهذا الحساب أو المنظمة. تحققوا من حساب المستلم.":"Cette invitation est indisponible pour ce compte ou cette organisation. Vérifiez le compte du destinataire."}</p>}</main>;}

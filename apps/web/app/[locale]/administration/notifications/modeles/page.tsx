import{randomUUID}from"node:crypto";
import{notFound,redirect}from"next/navigation";
import{isLocale}from"@/modules/shared/lib/i18n/locale";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import{AdminModulePage}from"@/modules/admin/ui/admin-module-page";
import{notificationEditorSchema,notificationReviewRequestsSchema}from"@/modules/admin/screens/notification-templates/model";
import{NotificationTemplateEditor}from"@/modules/admin/screens/notification-templates/panel";
export default async function NotificationTemplatesPage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{page?:string}>}){
 const[{locale},query]=await Promise.all([params,searchParams]);if(!isLocale(locale))notFound();const client=await getSupabaseServerClient();const{data:auth}=await client.auth.getUser();if(!auth.user)redirect(`/${locale}/connexion`);
 const number=Number(query.page??"1"),page=Number.isSafeInteger(number)&&number>0?number:1;const[result,reviewResult]=await Promise.all([client.rpc("get_notification_template_editor_v1",{p_page:page}),client.rpc("get_notification_template_review_requests_v1",{p_page:page})]);const reviews=notificationReviewRequestsSchema.safeParse(reviewResult.data),parsed=notificationEditorSchema.safeParse(result.data),ar=locale==="ar";const keys:Record<string,string>={};if(parsed.success){for(const pair of parsed.data.pairs)keys[pair.code]=randomUUID();for(const proposal of parsed.data.proposals)keys[proposal.id]=randomUUID();}if(reviews.success)for(const review of reviews.data.requests)keys[review.actionId]=randomUUID();
 return <AdminModulePage locale={locale}active="settings"path="notifications/modeles"querySuffix={`page=${page}`}title={ar?"قوالب الإشعارات بالفرنسية والعربية":"Modèles de notifications FR/AR"}lead={ar?"معاينة دون إرسال، نسخ محفوظة واعتماد مستقل قبل التفعيل.":"Prévisualisation sans envoi, versions conservées et approbation indépendante avant activation."}>{result.error||!parsed.success?<p role="alert">{ar?"البيانات غير متاحة أو الوصول مرفوض. تحققوا من المصادقة والصلاحيات.":"Données indisponibles ou accès refusé. Vérifiez la MFA et les habilitations."}</p>:<NotificationTemplateEditor locale={locale}data={parsed.data}actorId={auth.user.id}keys={keys}reviews={reviewResult.error||!reviews.success?null:reviews.data}/>}</AdminModulePage>;
}

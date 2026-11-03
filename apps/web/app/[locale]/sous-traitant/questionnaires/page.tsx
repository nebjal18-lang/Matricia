import{randomUUID}from"node:crypto";
import{notFound,redirect}from"next/navigation";
import{z}from"zod";
import{isLocale}from"@/modules/shared/lib/i18n/locale";
import{connexionHref}from"@/modules/shared/lib/auth/connexion-href";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import{createServerQuestionnaireSessionsRepository}from"@/modules/shared/lib/questionnaire-sessions/server-repository";
import{resolveProviderSpace}from"@/modules/provider/data/spaces/context";
import{providerContextReadState}from"@/modules/provider/data/spaces/organization-context";
import{ProviderAppShell}from"@/modules/provider/ui/provider-app-shell";
import{ProviderReadState}from"@/modules/provider/ui/provider-read-state";
import{ProviderQuestionnairePanel}from"@/modules/provider/screens/questionnaires/provider-questionnaire-panel";
export default async function ProviderQuestionnairesPage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{organizationId?:string;session?:string}>}){
 const[{locale},query]=await Promise.all([params,searchParams]);if(!isLocale(locale))notFound();
 const space=await resolveProviderSpace({locale,organizationId:query.organizationId});if(space.status==="unauthenticated")redirect(connexionHref(locale,{next:`/${locale}/sous-traitant/questionnaires`}));
 const contextState=providerContextReadState(space,query.organizationId);
 const result=contextState?null:await(await createServerQuestionnaireSessionsRepository("PROVIDER")).load(query.session,space.selectedOrganizationId??undefined);
 const client=await getSupabaseServerClient(),{data:auth}=await client.auth.getUser();
 const roleResult=space.selectedOrganizationId&&auth.user?await client.from("organization_memberships").select("organization_member_roles!inner(role_code,revoked_at)").eq("organization_id",space.selectedOrganizationId).eq("user_id",auth.user.id).eq("status","ACTIVE").is("organization_member_roles.revoked_at",null):{data:[],error:null};
 const roles=z.array(z.object({organization_member_roles:z.array(z.object({role_code:z.string(),revoked_at:z.string().nullable()}))})).safeParse(roleResult.data);
 const canEdit=!roleResult.error&&roles.success&&roles.data.some(member=>member.organization_member_roles.some(role=>role.revoked_at===null&&["PROVIDER_OWNER","PROVIDER_MANAGER","PROVIDER_SALES","PROVIDER_TECHNICIAN"].includes(role.role_code)));
 return <ProviderAppShell locale={locale}organizations={space.organizations}selectedQuery={space.selectedQuery}selectedOrganizationId={space.selectedOrganizationId}userEmail={space.userEmail}active="qualify"title={locale==="ar"?"استبيان التأهيل":"Questionnaire de qualification"}lead={locale==="ar"?"أكملوا الاستبيان المنشور. يراجع الفريق الأدلة قبل اتخاذ قرار التأهيل.":"Complétez le questionnaire publié. L’équipe examine les preuves avant toute décision de qualification."}><main className="client-page space-y-6"><a className="client-text-link" href={`/${locale}/sous-traitant/qualification${space.selectedQuery}`}>{locale==="ar"?"العودة إلى ملف التأهيل":"Revenir au dossier de qualification"}</a>{result?.status==="success"?<ProviderQuestionnairePanel locale={locale}dashboard={result.value}canEdit={canEdit}identities={{start:{idempotencyKey:randomUUID(),correlationId:randomUUID()},submit:{idempotencyKey:randomUUID(),correlationId:randomUUID()},answers:Object.fromEntries((result.value.selected?.sections??[]).flatMap(section=>section.questions.map(question=>[question.id,{idempotencyKey:randomUUID(),correlationId:randomUUID()}])))}}/>:<ProviderReadState locale={locale}state={contextState??(result?.reason==="FORBIDDEN"?"forbidden":"unavailable")}retryHref={`/${locale}/sous-traitant/questionnaires${space.selectedQuery}`}/>}</main></ProviderAppShell>;
}

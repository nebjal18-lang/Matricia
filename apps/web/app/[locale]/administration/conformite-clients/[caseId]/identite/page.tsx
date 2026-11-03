import{randomUUID}from"node:crypto";
import{z}from"zod";
import{notFound,redirect}from"next/navigation";
import{isLocale}from"@/modules/shared/lib/i18n/locale";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import{AdminModulePage}from"@/modules/admin/ui/admin-module-page";
import{clientIdentityContextSchema}from"@/modules/admin/screens/client-identity/model";
import{ClientIdentityPanel}from"@/modules/admin/screens/client-identity/panel";
export default async function ClientIdentityPage({params}:{params:Promise<{locale:string;caseId:string}>}){const{locale,caseId}=await params;if(!isLocale(locale)||!z.string().uuid().safeParse(caseId).success)notFound();const c=await getSupabaseServerClient();const{data:auth}=await c.auth.getUser();if(!auth.user)redirect(`/${locale}/connexion`);const r=await c.rpc("get_client_identity_review_context_v1",{p_compliance_case_id:caseId});const parsed=clientIdentityContextSchema.safeParse(r.data);const ar=locale==="ar";return <AdminModulePage locale={locale}active="actors"path={`conformite-clients/${caseId}/identite`}title={ar?"مراجعة المعرّفات القانونية للعميل":"Revue des identifiants légaux Client"}lead={ar?"مراجعة بشرية موثقة لهوية النسخة الحالية ووثائقها.":"Revue humaine documentée de l’identité et des pièces de la version courante."}>{r.error||!parsed.success?<p role="alert">{ar?"الوصول مرفوض أو الملف غير متاح.":"Accès refusé ou dossier indisponible."}</p>:<ClientIdentityPanel data={parsed.data}locale={locale}requestKey={randomUUID()}/>}</AdminModulePage>;}

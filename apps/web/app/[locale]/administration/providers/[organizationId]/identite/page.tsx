import{randomUUID}from"node:crypto";
import{notFound,redirect}from"next/navigation";
import{z}from"zod";
import{isLocale}from"@/modules/shared/lib/i18n/locale";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import{AdminModulePage}from"@/modules/admin/ui/admin-module-page";
import{providerIdentityReviewSchema}from"@/modules/admin/screens/provider-identity/model";
import{ProviderIdentityReviewPanel}from"@/modules/admin/screens/provider-identity/panel";
export default async function ProviderIdentityPage({params}:{params:Promise<{locale:string;organizationId:string}>}){const{locale,organizationId}=await params;if(!isLocale(locale)||!z.string().uuid().safeParse(organizationId).success)notFound();const c=await getSupabaseServerClient();const{data:auth}=await c.auth.getUser();if(!auth.user)redirect(`/${locale}/connexion`);const r=await c.rpc("get_provider_identity_review_context_v1",{p_provider_organization_id:organizationId});const parsed=providerIdentityReviewSchema.safeParse(r.data);const ar=locale==="ar";return <AdminModulePage locale={locale}active="actors"path={`providers/${organizationId}/identite`}title={ar?"مراجعة هوية مقدم الخدمة":"Revue d’identité du Prestataire"}lead={ar?"مراجعة صريحة للهوية الحالية ووثائقها. لا تعاد تهيئة أي سجل مالي.":"Revue explicite de l’identité courante et de ses pièces, avec historique conservé."}>{r.error||!parsed.success?<p role="alert">{ar?"الوصول مرفوض أو المراجعة غير متاحة.":"Accès refusé ou revue indisponible."}</p>:<ProviderIdentityReviewPanel data={parsed.data}locale={locale}requestKey={randomUUID()}/>}</AdminModulePage>;}

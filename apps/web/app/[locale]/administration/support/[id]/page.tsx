import { notFound } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { AdminModulePage } from "@/modules/admin/ui/admin-module-page";
import { SupportRevokeForm } from "@/modules/admin/screens/support/revoke-form";
export default async function SupportCasePage({params}:{params:Promise<{locale:string;id:string}>}){
 const{locale,id}=await params;if(!isLocale(locale)||!z.string().uuid().safeParse(id).success)notFound();
 const c=await getSupabaseServerClient();const r=await c.rpc("get_my_admin_support_case_v1",{p_work_item_id:id});
 const parsed=z.object({grantId:z.string().uuid(),expiresAt:z.string(),accessMode:z.string(),titleFr:z.string(),titleAr:z.string(),status:z.string(),organization:z.object({displayName:z.string(),status:z.string()}),resource:z.object({status:z.string()})}).safeParse(r.data);const ar=locale==="ar";
 return <AdminModulePage locale={locale} active="settings" path={`support/${id}`} title={ar?"ملف الدعم المحدد":"Dossier de support limité"} lead={ar?"قراءة محددة بالترخيص المؤقت.":"Lecture limitée à l’autorisation temporaire."}>{r.error||!parsed.success?<p role="alert">{ar?"الترخيص غير موجود أو منتهي أو ملغى.":"Autorisation absente, expirée ou révoquée."}</p>:<article className="client-card"><h2>{ar?parsed.data.titleAr:parsed.data.titleFr}</h2><p>{parsed.data.organization.displayName} · {parsed.data.resource.status}</p><p>{ar?"انتهاء الصلاحية":"Expiration"} : {parsed.data.expiresAt}</p><SupportRevokeForm locale={locale} grantId={parsed.data.grantId} workId={id}/></article>}</AdminModulePage>;
}

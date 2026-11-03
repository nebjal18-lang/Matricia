import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { AdminModulePage } from "@/modules/admin/ui/admin-module-page";
import { AssistanceReply } from "@/modules/admin/screens/assistance/reply";
export const dynamic="force-dynamic";
export default async function AssistancePage({params}:{params:Promise<{locale:string;id:string}>}){
 const{locale,id}=await params;if(!isLocale(locale)||!z.string().uuid().safeParse(id).success)notFound();
 const c=await getSupabaseServerClient();const{data:auth}=await c.auth.getUser();if(!auth.user)redirect(`/${locale}/connexion`);
 const [request,messages]=await Promise.all([c.from("client_assistance_requests").select("id,subject,body,status,document_ids,consented_at").eq("id",id).maybeSingle(),c.from("client_assistance_messages").select("id,body,created_at").eq("request_id",id).order("created_at")]);
 const parsed=z.object({id:z.string().uuid(),subject:z.string(),body:z.string(),status:z.string(),document_ids:z.array(z.string().uuid()),consented_at:z.string().nullable()}).safeParse(request.data);
 const feed=z.array(z.object({id:z.string().uuid(),body:z.string(),created_at:z.string()})).safeParse(messages.data);
 const ar=locale==="ar";
 return <AdminModulePage locale={locale} active="settings" path={`assistance/${id}`} title={ar?"المساعدة البشرية":"Assistance humaine"} lead={ar?"محادثة محددة بالطلب المرسل من العميل.":"Conversation limitée à la demande transmise par le client."}>{request.error||messages.error||!parsed.success||!feed.success?<p role="alert">{ar?"الملف غير متاح. تحققوا من الصلاحيات والمصادقة الثنائية.":"Dossier indisponible. Vérifiez les habilitations et la MFA."}</p>:<div className="client-stack"><article className="client-card"><h2>{parsed.data.subject}</h2><p className="whitespace-pre-wrap">{parsed.data.body}</p><p>{parsed.data.status}</p>{parsed.data.consented_at?parsed.data.document_ids.map((doc,index)=><a key={doc} href={`/api/client/assistance/${id}/documents/${doc}`} className="admin-soft-cta">{ar?"وثيقة مختارة":"Document sélectionné"} {index+1}</a>):null}</article><ol className="client-feed">{feed.data.map((m)=><li key={m.id}><article><time>{m.created_at}</time><p className="whitespace-pre-wrap">{m.body}</p></article></li>)}</ol>{parsed.data.status!=="CLOSED"?<AssistanceReply id={id} locale={locale} requestKey={randomUUID()}/>:null}</div>}</AdminModulePage>;
}

import{z}from"zod";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import{createServerDiagnosticsRepository}from"@/modules/shared/lib/diagnostics-opportunities/server-repository";
import{renderDiagnosticReport}from"@/modules/client/data/diagnostic-report/pdf";
import{connexionHref}from"@/modules/shared/lib/auth/connexion-href";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"cache-control":"private, no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};
export async function GET(request:Request,{params}:{params:Promise<{runId:string}>}){
 const{runId}=await params,url=new URL(request.url),locale=url.searchParams.get("locale")==="ar"?"ar":"fr",organizationId=url.searchParams.get("organizationId");
 if(!z.string().uuid().safeParse(runId).success||(organizationId!==null&&!z.string().uuid().safeParse(organizationId).success))return new Response(null,{status:404,headers});
 const client=await getSupabaseServerClient(),{data:{user},error}=await client.auth.getUser(),next=`/${locale}/client/diagnostics/${runId}${organizationId?`?${new URLSearchParams({organizationId})}`:""}`;
 if(error||!user)return new Response(null,{status:303,headers:{...headers,location:new URL(connexionHref(locale,{next}),url.origin).toString()}});
 const assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();if(assurance.error||assurance.data?.currentLevel!=="aal2")return new Response(null,{status:303,headers:{...headers,location:new URL(`/${locale}/securite/compte?${new URLSearchParams({next})}`,url.origin).toString()}});
 const result=await(await createServerDiagnosticsRepository(organizationId)).detail(runId);
 if(result.status==="error"&&(result.reason==="FORBIDDEN"||result.reason==="INVALID_INPUT"))return new Response(null,{status:404,headers});
 if(result.status==="error")return new Response(locale==="fr"?"Le rapport est momentanément indisponible. Réessayez depuis votre bilan.":"التقرير غير متاح مؤقتاً. حاولوا مجدداً من صفحة التشخيص.",{status:503,headers});
 if(!result.value||(organizationId&&result.value.organizationId!==organizationId))return new Response(null,{status:404,headers});
 const detail=result.value,version=z.string().uuid().safeParse(detail.explanation.questionnaire_version_id);
 const[organization,questionnaire]=await Promise.all([client.from("organizations").select("display_name").eq("id",detail.organizationId).maybeSingle(),version.success?client.from("questionnaire_versions").select("title_fr,title_ar").eq("id",version.data).eq("library_id",detail.libraryId).maybeSingle():Promise.resolve(null)]);
 if(organization.error||!organization.data||questionnaire?.error)return new Response(locale==="fr"?"Les informations du rapport sont indisponibles. Réessayez.":"معلومات التقرير غير متاحة. حاولوا مجدداً.",{status:503,headers});
 try{const bytes=await renderDiagnosticReport(detail,{organizationName:organization.data.display_name,questionnaireTitle:questionnaire?.data?(locale==="fr"?questionnaire.data.title_fr:questionnaire.data.title_ar):(locale==="fr"?"Questionnaire historique — titre non conservé":"استبيان تاريخي — العنوان غير محفوظ")},locale);return new Response(new Uint8Array(bytes),{headers:{...headers,"content-type":"application/pdf","content-length":String(bytes.length),"content-disposition":`attachment; filename="diagnostic-${runId}-${locale}.pdf"`}});}catch{return new Response(locale==="fr"?"La génération du rapport est momentanément indisponible. Réessayez depuis votre bilan.":"إنشاء التقرير غير متاح مؤقتاً. حاولوا مجدداً من صفحة التشخيص.",{status:503,headers});}
}

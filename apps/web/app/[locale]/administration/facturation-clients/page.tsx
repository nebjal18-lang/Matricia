import{randomUUID}from"node:crypto";
import{notFound,redirect}from"next/navigation";
import{isLocale}from"@/modules/shared/lib/i18n/locale";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import{AdminModulePage}from"@/modules/admin/ui/admin-module-page";
import{clientBillingConsoleSchema}from"@/modules/admin/screens/client-billing/model";
import{ClientBillingPanel}from"@/modules/admin/screens/client-billing/panel";
export default async function ClientBillingPage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{page?:string}>}){
 const[{locale},query]=await Promise.all([params,searchParams]);if(!isLocale(locale))notFound();const c=await getSupabaseServerClient();const{data:auth}=await c.auth.getUser();if(!auth.user)redirect(`/${locale}/connexion`);const page=Number(query.page??"1");const result=await c.rpc("get_client_billing_console_v1",{p_page:Number.isSafeInteger(page)&&page>0?page:1});const parsed=clientBillingConsoleSchema.safeParse(result.data);const ar=locale==="ar";
 const keys:Record<string,string>={create:randomUUID()};if(parsed.success){for(const policy of parsed.data.policies)keys[`policy:${policy.id}`]=randomUUID();for(const source of parsed.data.sources){keys[`source:${source.payment_event_id}`]=randomUUID();for(const a of source.adjustments)keys[`adjustment:${a.id}`]=randomUUID();}}
 return <AdminModulePage locale={locale}active="finance"path="facturation-clients"title={ar?"الفواتير والإشعارات الدائنة للعملاء":"Factures et avoirs Client"}lead={ar?"إصدار موثق من الدفع والتعديلات المؤكدة ضمن سياسة قانونية معتمدة.":"Émission traçable depuis les captures et corrections confirmées, sous politique juridique approuvée."}>{result.error||!parsed.success?<p role="alert">{ar?"الوصول المالي مرفوض أو البيانات غير متاحة. تحققوا من المصادقة الثنائية.":"Accès financier refusé ou données indisponibles. Vérifiez la MFA."}</p>:<ClientBillingPanel locale={locale}data={parsed.data}actorId={auth.user.id}keys={keys}/>}</AdminModulePage>;
}

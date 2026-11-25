import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import{randomUUID}from"node:crypto";
import{notFound,redirect}from"next/navigation";
import{isLocale}from"@/modules/shared/lib/i18n/locale";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import{AdminModulePage}from"@/modules/admin/ui/admin-module-page";
import{AdminStep11Gate}from"@/modules/admin/ui/admin-step11-gate";
import{clientBillingConsoleSchema}from"@/modules/admin/screens/client-billing/model";
import{ClientBillingPanel}from"@/modules/admin/screens/client-billing/panel";
export default async function ClientBillingPage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{page?:string}>}){
 const[{locale},query]=await Promise.all([params,searchParams]);if(!isLocale(locale))notFound();const c=await getSupabaseServerClient();const{data:auth}=await c.auth.getUser();if(!auth.user)redirect(connexionHref(locale,{next:`/${locale}/administration/facturation-clients`}));const page=Number(query.page??"1");const result=await c.rpc("get_client_billing_console_v1",{p_page:Number.isSafeInteger(page)&&page>0?page:1});const parsed=clientBillingConsoleSchema.safeParse(result.data);const ar=locale==="ar";
 const keys:Record<string,string>={create:randomUUID()};if(parsed.success){for(const policy of parsed.data.policies)keys[`policy:${policy.id}`]=randomUUID();for(const source of parsed.data.sources){keys[`source:${source.payment_event_id}`]=randomUUID();for(const a of source.adjustments)keys[`adjustment:${a.id}`]=randomUUID();}}
 const denied=/AAL2|MFA/i.test(result.error?.message??"")?(ar?"المصادقة الثنائية (AAL2) مطلوبة.":"MFA (AAL2) requise."):(ar?"الوصول المالي مرفوض أو البيانات غير متاحة.":"Accès financier refusé ou données indisponibles.");
 return <AdminModulePage locale={locale}active="finance"path="facturation-clients"title={ar?"الفواتير والإشعارات الدائنة للعملاء":"Factures et avoirs Client"}lead={ar?"الخطوة 11 — إصدار موثق دون تعديل رصيد يدوياً.":"Étape 11 — émission traçable, sans modifier un solde à la main."}><AdminStep11Gate locale={locale} current="facturation" />{result.error||!parsed.success?<p role="alert">{denied}</p>:<ClientBillingPanel locale={locale}data={parsed.data}actorId={auth.user.id}keys={keys}/>}</AdminModulePage>;
}

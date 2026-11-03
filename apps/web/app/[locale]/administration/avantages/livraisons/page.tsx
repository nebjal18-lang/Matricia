import{randomUUID}from"node:crypto";
import Link from"next/link";
import{notFound,redirect}from"next/navigation";
import{z}from"zod";
import{isLocale}from"@/modules/shared/lib/i18n/locale";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import{AdminModulePage}from"@/modules/admin/ui/admin-module-page";
import{loadBenefitFulfillment}from"@/modules/shared/lib/benefit-fulfillment/data";
import{BenefitFulfillmentCard}from"@/modules/shared/lib/benefit-fulfillment/panel";
export default async function BenefitOperations({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{page?:string;organizationId?:string}>}){
 const{locale}=await params,q=await searchParams;if(!isLocale(locale))notFound();
 const parsed=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),organizationId:z.string().uuid().optional()}).safeParse(q);if(!parsed.success)notFound();
 const client=await getSupabaseServerClient();const{data:auth}=await client.auth.getUser();if(!auth.user)redirect(`/${locale}/connexion`);
 const result=await loadBenefitFulfillment(locale,parsed.data.organizationId??null,parsed.data.page),ar=locale==="ar";
 const href=(page:number)=>`/${locale}/administration/avantages/livraisons?page=${page}${parsed.data.organizationId?`&organizationId=${parsed.data.organizationId}`:""}`;
 return <AdminModulePage locale={locale}active="finance"path="avantages/livraisons"title={ar?"تنفيذ المزايا واستلامها":"Exécution et réception des avantages"}lead={ar?"تنفيذ موثق، واستلام مستقل من العميل، ثم احتساب الرصيد المقبول.":"Exécution tracée, réception indépendante du client, puis consommation des crédits acceptés."}>
  <main className="client-page grid gap-4">{!result?<p role="alert">{ar?"الوصول مرفوض أو البيانات غير متاحة.":"Accès refusé ou données indisponibles."}</p>:<section className="grid gap-4">{result.rows.length===0?<p>{ar?"لا توجد حجوزات في هذا النطاق.":"Aucune réservation dans ce périmètre."}</p>:result.rows.map(row=><BenefitFulfillmentCard key={row.id}row={row}locale={locale}requestKey={randomUUID()}admin/>)}<nav aria-label={ar?"صفحات المزايا":"Pages des avantages"}className="flex gap-4">{result.page>1?<Link href={href(result.page-1)}>{ar?"السابق":"Précédent"}</Link>:null}{result.has_next?<Link href={href(result.page+1)}>{ar?"التالي":"Suivant"}</Link>:null}</nav></section>}
 </main></AdminModulePage>;
}

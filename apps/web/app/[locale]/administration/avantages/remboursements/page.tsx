import {randomUUID} from "node:crypto";
import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {z} from "zod";
import {isLocale} from "@/modules/shared/lib/i18n/locale";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
import {AdminModulePage} from "@/modules/admin/ui/admin-module-page";
import {loadBenefitRefunds} from "@/modules/client/screens/benefit-refunds/data";
import {BenefitRefundCard} from "@/modules/client/screens/benefit-refunds/panel";
export default async function BenefitRefundReview({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{page?:string;organizationId?:string}>}){
 const{locale}=await params,q=await searchParams;if(!isLocale(locale))notFound();
 const parsed=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),organizationId:z.string().uuid().optional()}).safeParse(q);if(!parsed.success)notFound();
 const c=await getSupabaseServerClient(),{data:auth}=await c.auth.getUser();if(!auth.user)redirect(`/${locale}/connexion`);
 const ar=locale==="ar",result=await loadBenefitRefunds(parsed.data.organizationId??null,parsed.data.page),href=(page:number)=>`/${locale}/administration/avantages/remboursements?page=${page}${parsed.data.organizationId?`&organizationId=${parsed.data.organizationId}`:""}`;
 return <AdminModulePage locale={locale}active="finance"path="avantages/remboursements"title={ar?"مراجعة استرجاع أرصدة المزايا":"Revue des retours de crédits des avantages"}lead={ar?"قرار مالي مستقل يعيد الدفعات الأصلية ويعكس الإيرادات المنسوبة.":"Une décision Finance indépendante restitue les lots d’origine et contrepasse les revenus attribués."}><main className="client-page grid gap-4">
  {!result?<p role="alert">{ar?"الوصول مرفوض أو البيانات غير متاحة.":"Accès refusé ou données indisponibles."}</p>:<>{result.rows.length===0?<p>{ar?"لا توجد طلبات في هذا النطاق.":"Aucune demande dans ce périmètre."}</p>:result.rows.map(row=><BenefitRefundCard key={row.id}row={row}locale={locale}requestKey={randomUUID()}finance/>)}<nav aria-label={ar?"صفحات المراجعة":"Pages de revue"}className="flex gap-4">{result.page>1?<Link href={href(result.page-1)}>{ar?"السابق":"Précédent"}</Link>:null}{result.has_next?<Link href={href(result.page+1)}>{ar?"التالي":"Suivant"}</Link>:null}</nav></>}
 </main></AdminModulePage>;
}

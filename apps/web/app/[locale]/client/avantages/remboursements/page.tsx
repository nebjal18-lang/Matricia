import {randomUUID} from "node:crypto";
import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {z} from "zod";
import {isLocale} from "@/modules/shared/lib/i18n/locale";
import {resolveClientSpace} from "@/modules/client/data/spaces/context";
import {ClientAppShell} from "@/modules/client/ui/client-app-shell";
import {loadBenefitRefunds} from "@/modules/client/screens/benefit-refunds/data";
import {BenefitRefundCard} from "@/modules/client/screens/benefit-refunds/panel";
export default async function BenefitRefunds({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{page?:string;organizationId?:string}>}){
 const{locale}=await params,q=await searchParams;if(!isLocale(locale))notFound();
 const parsed=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),organizationId:z.string().uuid().optional()}).safeParse(q);if(!parsed.success)notFound();
 const space=await resolveClientSpace({locale,organizationId:parsed.data.organizationId});if(space.status==="unauthenticated")redirect(`/${locale}/connexion`);
 const org=space.selectedOrganizationId,ar=locale==="ar",result=org?await loadBenefitRefunds(org,parsed.data.page):null;
 const href=(page:number)=>`/${locale}/client/avantages/remboursements?organizationId=${org}&page=${page}`;
 return <ClientAppShell locale={locale}selectedQuery={space.selectedQuery}selectedOrganizationId={org}userEmail={space.userEmail}organizationName={space.organizationName}active="finance"title={ar?"استرجاع أرصدة المزايا":"Retours de crédits des avantages"}lead={ar?"أرسل سبب الطلب وتابع المراجعة المالية المستقلة.":"Déposez un motif et suivez la revue Finance indépendante."}kicker="Matricia"><main className="client-page grid gap-4">
  <Link href={`/${locale}/client/boxes${org?`?organizationId=${org}`:""}`}>{ar?"صناديقي ومزاياي":"Mes Boxes et avantages"}</Link>
  {!org?<p>{ar?"اختر المؤسسة للاطلاع على الطلبات.":"Choisissez l’organisation pour consulter les demandes."}</p>:!result?<p role="alert">{ar?"تعذر تحميل الطلبات أو الوصول مرفوض.":"Demandes indisponibles ou accès refusé."}</p>:<>{result.rows.length===0?<p>{ar?"لا توجد مزايا مستهلكة قابلة للعرض.":"Aucun avantage consommé à afficher."}</p>:result.rows.map(row=><BenefitRefundCard key={row.id}row={row}locale={locale}requestKey={randomUUID()}/>)}<nav aria-label={ar?"صفحات الاسترجاع":"Pages des retours"}className="flex gap-4">{result.page>1?<Link href={href(result.page-1)}>{ar?"السابق":"Précédent"}</Link>:null}{result.has_next?<Link href={href(result.page+1)}>{ar?"التالي":"Suivant"}</Link>:null}</nav></>}
 </main></ClientAppShell>;
}

import{randomUUID}from"node:crypto";
import Link from"next/link";
import{notFound,redirect}from"next/navigation";
import{z}from"zod";
import{isLocale}from"@/modules/shared/lib/i18n/locale";
import{resolveClientSpace}from"@/modules/client/data/spaces/context";
import{ClientAppShell}from"@/modules/client/ui/client-app-shell";
import{loadBenefitFulfillment}from"@/modules/shared/lib/benefit-fulfillment/data";
import{BenefitFulfillmentCard}from"@/modules/shared/lib/benefit-fulfillment/panel";
export default async function BenefitReceipts({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{page?:string;organizationId?:string}>}){
 const{locale}=await params,q=await searchParams;if(!isLocale(locale))notFound();
 const parsed=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),organizationId:z.string().uuid().optional()}).safeParse(q);if(!parsed.success)notFound();
 const space=await resolveClientSpace({locale,organizationId:parsed.data.organizationId});if(space.status==="unauthenticated")redirect(`/${locale}/connexion`);
 const org=space.selectedOrganizationId,ar=locale==="ar",result=org?await loadBenefitFulfillment(locale,org,parsed.data.page):null;
 const title=ar?"استلام المزايا":"Réception des avantages",href=(page:number)=>`/${locale}/client/avantages/livraisons?organizationId=${org}&page=${page}`;
 return <ClientAppShell locale={locale}selectedQuery={space.selectedQuery}selectedOrganizationId={org}userEmail={space.userEmail}organizationName={space.organizationName}active="finance"title={title}lead={ar?"راجع الخدمة المسلمة ثم أكد الاستلام أو اطلب استكمالاً.":"Vérifiez la prestation remise, confirmez sa réception ou demandez un complément."}kicker="Matricia"><main className="client-page grid gap-4">
  <Link href={`/${locale}/client/credits${org?`?organizationId=${org}`:""}`}>{ar?"الرصيد والحجوزات":"Crédits et réservations"}</Link>
  {!org?<p>{ar?"اختر المؤسسة من صفحة الرصيد.":"Choisissez l’organisation depuis la page des crédits."}</p>:!result?<p role="alert">{ar?"البيانات غير متاحة أو الوصول مرفوض.":"Données indisponibles ou accès refusé."}</p>:<>{result.rows.length===0?<p>{ar?"لا توجد حجوزات بعد.":"Aucune réservation pour le moment."}</p>:result.rows.map(row=><BenefitFulfillmentCard key={row.id}row={row}locale={locale}requestKey={randomUUID()}/>)}<nav aria-label={ar?"صفحات الاستلام":"Pages des réceptions"}className="flex gap-4">{result.page>1?<Link href={href(result.page-1)}>{ar?"السابق":"Précédent"}</Link>:null}{result.has_next?<Link href={href(result.page+1)}>{ar?"التالي":"Suivant"}</Link>:null}</nav></>}
 </main></ClientAppShell>;
}

import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { resolveProviderSpace } from "@/modules/provider/data/spaces/context";
import { ProviderAppShell } from "@/modules/provider/ui/provider-app-shell";
import { ProviderListPagination } from "@/modules/provider/ui/list-pagination";
import { loadProviderContracts } from "@/modules/provider/data/missions/contracts";
import { loadProviderAmendments } from "@/modules/provider/data/missions/amendments";
import { ProviderAmendmentPanel } from "./amendment-panel";
import { ProviderContractDossiers } from "./contract-dossier";
export async function ProviderContractsPage({params,searchParams}:{params:Promise<{locale:string;contractId?:string}>;searchParams:Promise<{organizationId?:string;page?:string}>}){
 const[p,q]=await Promise.all([params,searchParams]);if(!isLocale(p.locale))notFound();const locale=p.locale,ar=locale==="ar",path=`/${locale}/sous-traitant/contrats${p.contractId?`/${p.contractId}`:""}`;
 const space=await resolveProviderSpace({locale,organizationId:q.organizationId});if(space.status==="unauthenticated")redirect(connexionHref(locale,{next:`${path}${q.organizationId?`?organizationId=${encodeURIComponent(q.organizationId)}`:""}`}));
 const [result,amendments]=await Promise.all([loadProviderContracts(q.organizationId,p.contractId,Number(q.page??1)),loadProviderAmendments(q.organizationId,p.contractId)]);
 if(result.status==="error"&&result.reason==="UNAUTHENTICATED")redirect(connexionHref(locale,{next:`${path}${q.organizationId?`?organizationId=${encodeURIComponent(q.organizationId)}`:""}`}));
 return <ProviderAppShell locale={locale} active="missions" organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} title={ar?"العقود والملاحق":"Contrats et avenants"} lead={ar?"اطلع على النسخة التعاقدية وشروطها وإثباتاتها قبل التوقيع وأثناء التنفيذ.":"Consultez la version contractuelle, ses conditions et ses preuves avant signature et pendant l’exécution."} kicker={ar?"المقاول من الباطن":"Sous-traitant"} languagePath={`${path}${space.selectedQuery}`}>
 {result.status==="error"?<section role="alert" className="rounded-xl border border-destructive p-5"><h2 className="font-semibold">{["FORBIDDEN","CONTEXT_REQUIRED"].includes(result.reason)?ar?"يلزم اختيار مؤسسة مخولة":"Organisation autorisée à sélectionner":ar?"تعذر تحميل العقود":"Chargement des contrats indisponible"}</h2><p className="my-3">{result.reason==="FORBIDDEN"?ar?"هذا الملف غير متاح ضمن صلاحياتك والمؤسسة المختارة.":"Ce dossier n’est pas accessible dans vos habilitations et l’organisation sélectionnée.":result.reason==="CONTEXT_REQUIRED"?ar?"اختر المؤسسة من محدد المؤسسة للمتابعة.":"Choisissez votre organisation dans le sélecteur pour poursuivre.":ar?"لم يتم تأكيد غياب العقود. أعد محاولة التحميل.":"L’absence de contrats n’est pas confirmée. Réessayez le chargement."}</p><Link href={`${path}${space.selectedQuery}`} className="underline">{ar?"إعادة المحاولة":"Réessayer"}</Link></section>:<><ProviderContractDossiers value={result.value} locale={locale}/>{!p.contractId?<ProviderListPagination locale={locale} path={path} query={space.selectedQuery} page={result.value.page} hasMore={result.value.hasMore}/>:null}{amendments.status==="success"?<ProviderAmendmentPanel d={amendments.value} locale={locale}/>:<p role="alert">{ar?"متابعة الملاحق غير متاحة؛ لم يتم تأكيد عدم وجودها.":"Le suivi des avenants est indisponible ; leur absence n’est pas confirmée."}</p>}</>}
 </ProviderAppShell>;
}

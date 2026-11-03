import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { resolveClientSpace } from "@/modules/client/data/spaces/context";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";
import { loadClientReceiptWorkspace } from "@/modules/provider/data/billing/workspace";
import { ProviderBillingWorkspace } from "@/modules/provider/screens/facturation/workspace-panel";
export default async function ProviderReceiptConfirmationPage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{organizationId?:string}>}){
 const [{locale},query]=await Promise.all([params,searchParams]);if(!isLocale(locale))notFound();
 const space=await resolveClientSpace({locale,organizationId:query.organizationId});
 const next=`/${locale}/client/finances/encaissements-prestataire${query.organizationId?`?organizationId=${encodeURIComponent(query.organizationId)}`:""}`;
 if(space.status==="unauthenticated")redirect(connexionHref(locale,{next}));
 const result=await loadClientReceiptWorkspace(space.selectedOrganizationId),ar=locale==="ar";
 const title=ar?"تأكيد التحصيلات المصرح بها من مقدمي الخدمات":"Confirmer les encaissements déclarés par vos prestataires";
 return <ClientAppShell languagePath={`/${locale}/client/finances/encaissements-prestataire${space.selectedQuery}`} locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} organizationName={space.organizationName} userEmail={space.userEmail} active="finance" title={title} lead={ar?"التأكيد لا ينشئ أي دفع؛ تحتفظ المالية بالتحقق المستقل.":"La confirmation ne réalise aucun paiement ; Finance conserve sa validation indépendante."}>
  <section className="client-card space-y-4"><Link className="underline" href={`/${locale}/client/finances${space.selectedQuery}`}>{ar?"المركز المالي":"Centre financier"}</Link>
  {result.status==="success"?<ProviderBillingWorkspace value={result.value} locale={locale} client/>:<div role="alert"><p>{result.reason==="FORBIDDEN"?(ar?"دوركم لا يسمح بتأكيد التحصيلات لهذه المؤسسة.":"Votre rôle ne permet pas de confirmer les encaissements de cette organisation."):(ar?"تعذرت قراءة التحصيلات. أعد المحاولة؛ لا يعني ذلك غيابها.":"Les encaissements n’ont pas pu être chargés. Réessayez ; cela ne signifie pas qu’il n’y en a aucun.")}</p><Link className="underline" href={next}>{ar?"إعادة المحاولة":"Réessayer"}</Link></div>}
  </section>
 </ClientAppShell>;
}

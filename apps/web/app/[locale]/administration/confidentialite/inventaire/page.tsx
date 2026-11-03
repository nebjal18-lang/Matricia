import {notFound,redirect} from "next/navigation";
import {connexionHref} from "@/modules/shared/lib/auth/connexion-href";
import {isLocale} from "@/modules/shared/lib/i18n/locale";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
import {AdminModulePage} from "@/modules/admin/ui/admin-module-page";
import {DsrAllWorkspace} from "@/modules/admin/screens/privacy/inventory/panel";
export default async function DsrAllInventoryPage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{draftId?:string;requestId?:string;packageId?:string}>}){
 const[{locale},query]=await Promise.all([params,searchParams]);if(!isLocale(locale))notFound();const client=await getSupabaseServerClient();const{data:auth}=await client.auth.getUser();if(!auth.user)redirect(connexionHref(locale,{next:`/${locale}/administration/confidentialite/inventaire`}));
 return <AdminModulePage locale={locale}active="settings"path="confidentialite/inventaire"title={locale==="ar"?"جرد ALL والإفصاح الشخصي":"Inventaire ALL et divulgation personnelle"}lead={locale==="ar"?"تصنيف المصادر والحقول ومراجعة الاستبعادات القانونية ثم تسليم استجابة خاصة متحقق منها.":"Classer les sources et les champs, revoir les exclusions juridiques, puis remettre une réponse privée vérifiable."}><DsrAllWorkspace locale={locale}initialDraftId={query.draftId}initialRequestId={query.requestId}initialPackageId={query.packageId}/></AdminModulePage>;
}

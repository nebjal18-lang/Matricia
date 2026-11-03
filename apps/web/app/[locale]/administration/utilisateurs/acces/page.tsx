import Link from "next/link";
import {notFound,redirect}from"next/navigation";
import{accountActionLabel,accountReviewQueueSchema}from"@/modules/admin/screens/account-access/model";
import{resolveAdminSpace}from"@/modules/admin/data/spaces/context";
import{AdminAppShell,AdminCrumb}from"@/modules/admin/ui/admin-app-shell";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import{connexionHref}from"@/modules/shared/lib/auth/connexion-href";
import{isLocale}from"@/modules/shared/lib/i18n/locale";
export default async function AccountAccessReviews({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{page?:string}>}){
 const[{locale},query]=await Promise.all([params,searchParams]);if(!isLocale(locale))notFound();
 const ar=locale==="ar",space=await resolveAdminSpace({locale});
 if(space.status==="unauthenticated")redirect(connexionHref(locale,{next:`/${locale}/administration/utilisateurs/acces`}));
 const page=/^[1-9][0-9]{0,5}$/u.test(query.page??"")?Math.min(100000,Number(query.page)):1;
 const result=await(await getSupabaseServerClient()).rpc("list_platform_account_change_reviews_v1",{p_page:page});
 const parsed=accountReviewQueueSchema.safeParse(result.data),data=!result.error&&parsed.success?parsed.data:null;
 const title=ar?"مراجعات وصول الحسابات":"Revues des accès aux comptes";
 return <AdminAppShell locale={locale}selectedQuery={space.selectedQuery}selectedOrganizationId={space.selectedOrganizationId}userEmail={space.userEmail}active="actors"actorCurrent="users"searchAction={`/${locale}/administration/utilisateurs`}searchPlaceholder={ar?"البحث عن حساب":"Rechercher un compte"}alternateHref={`/${ar?"fr":"ar"}/administration/utilisateurs/acces?page=${page}`}crumb={<AdminCrumb locale={locale}query={space.selectedQuery}items={[{href:`/${locale}/administration/utilisateurs`,label:ar?"المستخدمون":"Utilisateurs"},{label:title}]}/>}title={title}lead={ar?"طلبات حالية بانتظار قرار مستقل. الموافقة تطبق الأثر الحقيقي الموثق.":"Demandes en attente d’une décision indépendante. L’approbation applique l’effet réel et audité."}>
 <main className="client-page"><section className="client-stack">{!data?<p role="alert">{ar?"تعذر تحميل المراجعات. تحقق من الصلاحيات والتحقق متعدد العوامل.":"Revues indisponibles. Vérifiez les habilitations et le MFA."}</p>:<><p>{ar?"طلبات قيد المراجعة":"Demandes en attente"} : {data.total}</p>{data.rows.length===0?<p>{ar?"لا توجد طلبات حالية بانتظار المراجعة.":"Aucune demande en attente de revue."}</p>:data.rows.map(request=><article className="client-card"key={request.id}><h2>{accountActionLabel(request.action,ar)}</h2>{request.role_code?<p>{request.role_code}</p>:null}<p>{request.reason}</p><Link href={`/${locale}/administration/utilisateurs/${request.user_id}/roles#account-request-${request.id}`}>{ar?"مراجعة الحساب":"Examiner le compte"}</Link></article>)}<nav aria-label={ar?"صفحات المراجعة":"Pages des revues"}className="flex flex-wrap gap-4">{page>1?<Link href={`?page=${page-1}`}>{ar?"السابق":"Précédent"}</Link>:null}{data.has_next?<Link href={`?page=${page+1}`}>{ar?"التالي":"Suivant"}</Link>:null}</nav></>}</section></main></AdminAppShell>;
}

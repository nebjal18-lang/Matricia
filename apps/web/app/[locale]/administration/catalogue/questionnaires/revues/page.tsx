import{notFound}from"next/navigation";
import{isLocale}from"@/modules/shared/lib/i18n/locale";
import{AdminModulePage}from"@/modules/admin/ui/admin-module-page";
import{CentralQuestionnaireReviews}from"@/modules/franchise/screens/library/central-questionnaire-reviews";
export default async function CentralQuestionnaireReviewPage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{page?:string}>}){const[{locale},query]=await Promise.all([params,searchParams]);if(!isLocale(locale))notFound();const ar=locale==="ar";return <AdminModulePage locale={locale}active="catalog"path="catalogue/questionnaires/revues"title={ar?"المراجعة المركزية للاستبيانات":"Revue centrale des questionnaires"}lead={ar?"مراجعة النسخة الفرنسية والعربية وجميع محتوياتها قبل الموافقة المستقلة.":"Revue de la version FR/AR et de tous ses contenus avant décision indépendante."}><CentralQuestionnaireReviews locale={locale}page={query.page}/></AdminModulePage>;}

import{notFound}from"next/navigation";
import{isLocale}from"@/modules/shared/lib/i18n/locale";
import{AdminModulePage}from"@/modules/admin/ui/admin-module-page";
import{DsrRestrictionPanel}from"@/modules/admin/screens/privacy/restrictions/panel";
export default async function ProcessingRestrictionsPage({params}:{params:Promise<{locale:string}>}){const{locale}=await params;if(!isLocale(locale))notFound();return <AdminModulePage locale={locale} active="settings" path="confidentialite/restrictions" title={locale==="ar"?"قيود المعالجة وأدلة التسليم":"Restrictions de traitement et preuves de remise"}><DsrRestrictionPanel locale={locale} staff/></AdminModulePage>;}

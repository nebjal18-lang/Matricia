import{notFound}from"next/navigation";
import{isLocale}from"@/modules/shared/lib/i18n/locale";
import{AdminModulePage}from"@/modules/admin/ui/admin-module-page";
import{DsrErasurePanel}from"@/modules/admin/screens/privacy/erasure/panel";
export default async function ErasurePage({params}:{params:Promise<{locale:string}>}){const{locale}=await params;if(!isLocale(locale))notFound();return <AdminModulePage locale={locale} active="settings" path="confidentialite/effacement" title={locale==="ar"?"الحذف المحكوم والمراجعة القانونية":"Effacement gouverné et revue des conservations"}><DsrErasurePanel locale={locale} staff/></AdminModulePage>;}

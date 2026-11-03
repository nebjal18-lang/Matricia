import {notFound} from "next/navigation";
import {isLocale} from "@/modules/shared/lib/i18n/locale";
import {AdminModulePage} from "@/modules/admin/ui/admin-module-page";
import {DsrDeliveryScreen} from "@/modules/admin/screens/privacy/delivery/screen";
export default async function AdminDataDeliveryPage({params, searchParams}: {params: Promise<{locale: string}>; searchParams: Promise<{page?: string}>}) {
  const [{locale}, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  return <AdminModulePage locale={locale} active="settings" path="confidentialite/remise" title={locale === "ar" ? "نطاق طلبات البيانات وتسليمها" : "Périmètre et remise des demandes de données"}><DsrDeliveryScreen locale={locale} staff page={query.page}/></AdminModulePage>;
}

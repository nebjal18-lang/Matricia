import {notFound} from "next/navigation";
import {isLocale} from "@/modules/shared/lib/i18n/locale";
import {DsrErasurePanel} from "@/modules/admin/screens/privacy/erasure/panel";
import {DsrRestrictionPanel} from "@/modules/admin/screens/privacy/restrictions/panel";
import {DsrDeliveryScreen} from "@/modules/admin/screens/privacy/delivery/screen";
export default async function MyDataRequestsPage({params, searchParams}: {params: Promise<{locale: string}>; searchParams: Promise<{page?: string}>}) {
  const [{locale}, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  return <main className="client-page client-stack" dir={locale === "ar" ? "rtl" : "ltr"}><h1>{locale === "ar" ? "طلبات بياناتي وردودي الخاصة" : "Mes demandes de données et réponses privées"}</h1><DsrDeliveryScreen locale={locale} staff={false} page={query.page}/><DsrRestrictionPanel locale={locale}/><DsrErasurePanel locale={locale}/></main>;
}

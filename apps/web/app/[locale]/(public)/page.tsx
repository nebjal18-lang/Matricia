import { notFound } from "next/navigation";
import { HomePremium } from "@/modules/public/ui/home-premium/HomePremium";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { isPublicDemoAccessEnabled } from "../connexion/demo-policy";
import { DemoDashboardButtons } from "../connexion/demo-access";

export default async function PublicHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const demoAccess = isPublicDemoAccessEnabled() ? (
    <section className="mx-auto my-12 max-w-6xl rounded-2xl border border-blue-200 bg-blue-50 p-6" aria-labelledby="demo-dashboard-title">
      <h2 id="demo-dashboard-title" className="text-xl font-semibold text-blue-950">
        {locale === "ar" ? "استكشف لوحات التحكم التجريبية" : "Explorer les tableaux de bord démo"}
      </h2>
      <p className="mt-2 text-sm text-blue-900">
        {locale === "ar" ? "اختر مساحة للوصول إلى العرض التجريبي." : "Choisissez un espace pour accéder à la démonstration."}
      </p>
      <DemoDashboardButtons locale={locale} />
    </section>
  ) : undefined;
  return <HomePremium locale={locale} demoAccess={demoAccess} />;
}

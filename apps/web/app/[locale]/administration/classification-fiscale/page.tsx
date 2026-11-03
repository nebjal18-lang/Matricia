import { notFound } from "next/navigation";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { sensitivePageContext } from "@/modules/admin/ui/sensitive-page-context";
import { ServiceTaxConsole } from "@/modules/admin/screens/service-tax/service-tax-console";

export default async function ServiceTaxMappingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const context = await sensitivePageContext({ locale, path: "classification-fiscale", active: "finance", roles: ["SUPER_ADMIN", "FINANCE_MANAGER"], title: locale === "ar" ? "التصنيف الضريبي للخدمات" : "Classification fiscale des services", lead: locale === "ar" ? "ربط خدمة منشورة بفئة ضريبية معتمدة بقرار مستقل ومؤرخ، دون تغيير الطلبات أو العروض السابقة." : "Associer un service publié à une catégorie fiscale validée par une décision indépendante et datée, en conservant les demandes et devis antérieurs." });
  if (context.status === "blocked") return context.view;
  return context.wrap(<main className="client-page">
      <ServiceTaxConsole locale={locale} />
    </main>
  );
}

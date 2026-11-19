import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { loadMyPlatformAccess, hasPlatformRole, mfaRequiredMessage } from "@/modules/shared/lib/account-security/platform-access";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { AdminModulePage } from "@/modules/admin/ui/admin-module-page";
import { AdminOffFilmGate } from "@/modules/admin/ui/admin-off-film-gate";
import { BenefitAdmissionConsole } from "@/modules/admin/screens/benefit-admission/console";

export const dynamic = "force-dynamic";

export default async function BenefitAdmissionRulesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const access = await loadMyPlatformAccess();
  if (access.status === "error" && access.reason === "UNAUTHENTICATED") {
    redirect(connexionHref(locale, { next: `/${locale}/administration/avantages/regles` }));
  }
  return (
    <AdminModulePage
      locale={locale}
      active="finance"
      path="avantages/regles"
      title={locale === "ar" ? "قواعد حجز المزايا والباقات" : "Règles de réservation des avantages et Boxes"}
      lead={
        locale === "ar"
          ? "الحصص والسعة والشروط بإصدار ومراجعة مستقلين"
          : "Quotas, capacité et conditions versionnés sous revue indépendante"
      }
      hubGroup="finance"
      hubMode="strip"
    >
      <AdminOffFilmGate
        locale={locale}
        role={locale === "ar" ? "قواعد المزايا والباقات" : "Règles des avantages et Boxes"}
      />
      {access.status === "ok" && access.requirementSatisfied && hasPlatformRole(access.roles, ["SUPER_ADMIN", "MATRICIA_ADMIN", "FINANCE_MANAGER"]) ? (
        <BenefitAdmissionConsole locale={locale} />
      ) : (
        <p role="alert">
          {access.status === "ok" && !access.requirementSatisfied
            ? mfaRequiredMessage(locale)
            : locale === "ar"
              ? "الدخول محصور بالإدارة المالية أو المدير الأعلى."
              : "Accès réservé à l’administration financière ou au super administrateur."}
        </p>
      )}
    </AdminModulePage>
  );
}

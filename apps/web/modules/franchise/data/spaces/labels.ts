import type { Locale } from "@/modules/shared/lib/i18n/locale";

export function franchiseStageLabel(stage: string, locale: Locale) {
  const fr: Record<string, string> = {
    SENT: "Prospect enregistré",
    OPENED: "Ouverte",
    REGISTERED: "Enregistrée",
    PROFILE_STARTED: "Dossier ouvert",
    VERIFIED: "Vérifiée",
    DIAGNOSTIC_STARTED: "Diagnostic",
    OPPORTUNITY_CREATED: "Opportunité",
    RFQ_STARTED: "Consultation",
    CONTRACT_SIGNED: "Contrat",
  };
  const ar: Record<string, string> = {
    SENT: "تم تسجيل العميل المحتمل",
    OPENED: "مفتوحة",
    REGISTERED: "مسجَّلة",
    PROFILE_STARTED: "ملف مفتوح",
    VERIFIED: "موثَّقة",
    DIAGNOSTIC_STARTED: "تشخيص",
    OPPORTUNITY_CREATED: "فرصة",
    RFQ_STARTED: "استشارة",
    CONTRACT_SIGNED: "عقد",
  };
  return (locale === "ar" ? ar : fr)[stage] ?? stage;
}

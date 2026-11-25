import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { workflowStatusLabel } from "@/modules/shared/lib/i18n/workflow-statuses";

export function presentApprovalType(code: string, locale: Locale) {
  const known: Record<string, [string, string]> = {
    MANDATE_CHANGE: ["Changement de mandat", "تغيير التفويض"],
    TERRITORY_CHANGE: ["Changement de territoire", "تغيير الإقليم"],
    FINANCE_RELEASE: ["Libération financière", "تحرير مالي"],
    PROVIDER_EXCEPTION: ["Exception prestataire", "استثناء مقدم خدمة"],
    DOCUMENT_EXCEPTION: ["Exception documentaire", "استثناء وثائقي"],
    QUALITY_OVERRIDE: ["Dérogation qualité", "تجاوز جودة"],
    BOOK_BINDING: ["Rattachement du livre", "ربط الدفتر"],
  };
  const hit = known[code];
  if (hit) return locale === "ar" ? hit[1] : hit[0];
  return workflowStatusLabel(code, locale);
}

export function entryFeeModeLabel(mode: string, locale: Locale) {
  const labels: Record<string, [string, string]> = {
    EXEMPT: ["Exonération", "إعفاء"],
    UPFRONT: ["Comptant", "دفعة واحدة"],
    INSTALLMENT: ["Échelonnement", "أقساط"],
    REVENUE_WITHHOLDING: ["Retenue sur recettes", "اقتطاع من الإيرادات"],
  };
  return labels[mode]?.[locale === "ar" ? 1 : 0] ?? workflowStatusLabel(mode, locale);
}

export function franchiseBookTypeLabel(type: string, locale: Locale) {
  if (type === "IT") return locale === "ar" ? "تقنية المعلومات" : "Informatique";
  if (type === "STANDARD") return locale === "ar" ? "امتياز عام" : "Franchise standard";
  return workflowStatusLabel(type, locale);
}

export function beneficiaryCodeLabel(code: string, locale: Locale) {
  const known: Record<string, [string, string]> = {
    FRANCHISEE: ["Franchisé", "صاحب الامتياز"],
    HATIM_AHMITECH: ["Hatim Ahmitech", "حاتم أهميتيك"],
    NEOXA_JALIL: ["Jalil — NEOXA", "جليل — نِيوكسا"],
    ASMA_MATRICIA: ["Mme Asma — Matricia", "السيدة أسماء — ماتريسيا"],
    CORE: ["Pot Core plateforme", "وعاء المنصة الأساسي"],
    POOL: ["Pool de bénéfices", "مجمع المنافع"],
  };
  const hit = known[code];
  if (hit) return locale === "ar" ? hit[1] : hit[0];
  return workflowStatusLabel(code, locale);
}
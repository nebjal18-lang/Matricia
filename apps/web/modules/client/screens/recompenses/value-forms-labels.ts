import type { Locale } from "@/modules/shared/lib/i18n/locale";

const evidenceSources: Record<string, readonly [string, string]> = {
  INVOICE: ["Facture", "فاتورة"],
  CONTRACT: ["Contrat", "عقد"],
  ACCOUNTING_EXPORT: ["Export comptable", "تصدير محاسبي"],
  METER_READING: ["Relevé de compteur", "قراءة العداد"],
  SIGNED_REPORT: ["Rapport signé", "تقرير موقّع"],
  AUDITED_IMPORT: ["Import contrôlé", "بيانات مستوردة ومدققة"],
};

export function evidenceSourceLabel(locale: Locale, value: string): string {
  return evidenceSources[value]?.[locale === "ar" ? 1 : 0] ?? (locale === "ar" ? "مستند غير معروف" : "Justificatif non reconnu");
}

import{workflowStatusLabel}from"@/modules/shared/lib/i18n/workflow-statuses";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

const labels = {
  fr: { INVITED: "Invitée", VIEWED: "Consultée", ACCEPTED: "Acceptée", DECLINED: "Refusée", WITHDRAWN: "Retirée", SUSPENDED: "Suspendue", DRAFT: "Brouillon", REVISED: "Révisée", SUBMITTED: "Soumise", EXPIRED: "Expirée" },
  ar: { INVITED: "مدعو", VIEWED: "تم الاطلاع", ACCEPTED: "مقبول", DECLINED: "مرفوض", WITHDRAWN: "مسحوب", SUSPENDED: "معلق", DRAFT: "مسودة", REVISED: "مراجع", SUBMITTED: "مرسل", EXPIRED: "منتهي" },
} as const;

export function quoteStatusLabel(status: string, locale: Locale): string {
  return labels[locale][status as keyof typeof labels.fr] ?? workflowStatusLabel(status,locale);
}

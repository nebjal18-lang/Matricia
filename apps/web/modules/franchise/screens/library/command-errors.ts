import type { FranchiseLibraryLoadResult } from "@/modules/franchise/data/library/workspace-model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

export type EditorialFailureReason = "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "UNAVAILABLE" | "CONFLICT" | "LOCKED" | "MANDATE_REQUIRED";
export function editorialWorkspaceFailure(reason: Extract<FranchiseLibraryLoadResult, {status:"error"}>["reason"]): EditorialFailureReason {
  if (reason === "MANDATE_REQUIRED") return "MANDATE_REQUIRED";
  if (reason === "UNAUTHENTICATED") return "UNAUTHENTICATED";
  return reason === "FORBIDDEN" || reason === "NO_MANDATE" ? "FORBIDDEN" : "UNAVAILABLE";
}
export function editorialRpcFailure(error: {code?:string}): EditorialFailureReason {
  if (error.code === "42501") return "FORBIDDEN";
  if (error.code === "40001" || error.code === "23P01" || error.code === "22000") return "CONFLICT";
  if (error.code === "55000") return "LOCKED";
  if (error.code === "22023" || error.code === "23514" || error.code === "23505") return "VALIDATION";
  return "UNAVAILABLE";
}
export function editorialFailureMessage(reason: EditorialFailureReason, locale: Locale): string {
  const messages = {
    fr: {
      MANDATE_REQUIRED: "Choisissez votre mandat dans l’espace Franchisé avant de réessayer. Vos modifications restent ici.",
      VALIDATION: "Vérifiez les champs, conditions et références de cette version. Vos modifications sont conservées.",
      UNAUTHENTICATED: "Votre session doit être renouvelée. Reconnectez-vous avant de réessayer ; vos modifications restent ici.",
      FORBIDDEN: "Cette action n’est pas autorisée pour votre rôle ou votre mandat. Vérifiez le périmètre avec votre responsable.",
      UNAVAILABLE: "Le service est temporairement indisponible. Réessayez ; vos modifications sont conservées.",
      CONFLICT: "Cette version a changé. Rechargez sa dernière révision avant de réessayer.",
      LOCKED: "Cette version est figée ou son état ne permet pas cette action. Vérifiez son parcours de validation.",
    },
    ar: {
      MANDATE_REQUIRED: "اختاروا تفويضكم في فضاء الامتياز قبل إعادة المحاولة. بقيت تعديلاتكم هنا.",
      VALIDATION: "راجعوا الحقول والشروط والمراجع في هذا الإصدار. تم الاحتفاظ بتعديلاتكم.",
      UNAUTHENTICATED: "يجب تجديد الجلسة. سجلوا الدخول قبل إعادة المحاولة؛ بقيت تعديلاتكم هنا.",
      FORBIDDEN: "لا يسمح دوركم أو تفويضكم بهذا الإجراء. راجعوا النطاق مع المسؤول.",
      UNAVAILABLE: "الخدمة غير متاحة مؤقتاً. أعيدوا المحاولة؛ تم الاحتفاظ بتعديلاتكم.",
      CONFLICT: "تغير هذا الإصدار. أعيدوا تحميل آخر مراجعة قبل المحاولة مجدداً.",
      LOCKED: "هذا الإصدار ثابت أو لا تسمح حالته بهذا الإجراء. راجعوا مسار الاعتماد.",
    },
  };
  return messages[locale][reason];
}

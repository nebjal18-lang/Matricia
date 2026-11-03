import type { BookOpeningFailure } from "@/modules/franchise/data/governance/book-opening";
export function bookOpeningMessages(locale: "fr" | "ar") {
  return locale === "ar" ? {
    title: "فتح دفتر الامتياز أو مطابقته", intro: "اختاروا التفويض المعتمد والنطاق. تُراجَع الشروط المالية على الخادم، دون تغيير القيود أو الأرصدة السابقة.",
    select: "التفويض المعتمد والقاعدة المالية", version: "الإصدار", rule: "القاعدة المالية", territory: "النطاق", fee: "رسم الدخول المعتمد", currency: "عملة الدفتر", feeCurrency: "عملة رسم الدخول", existing: "دفتر موجود", submit: "فتح الدفتر أو تأكيد مطابقته", pending: "جارٍ التحقق…", success: "تم ربط الدفتر بالتفويض المعتمد. يمكن متابعة مراجعة تكاليفه وإقفاله وفق الشروط المطلوبة.",
    review: "تتطلب بعض الدفاتر مطابقة التفويض. يمكن ربط دفتر متّسق عبر هذا النموذج. وتبقى الدفاتر المتعارضة أو الملتبسة محجوبة لحين مراجعة أدلتها، دون إعادة كتابة تاريخها.",
    empty: "لا يوجد تفويض معتمد بقاعدة مالية متوافقة في هذا النطاق. يجب استكمال اقتراح التفويض واعتماده المستقل قبل فتح الدفتر.", retry: "إعادة تحميل الاختيارات", mfa: "إعداد العامل الثاني أو التحقق منه", login: "تسجيل الدخول", back: "العودة إلى حوكمة الامتياز", finance: "متابعة الحوكمة والمالية", period: "بدء التفويض", until: "نهاية التفويض", noEnd: "دون نهاية محددة", currencyNote: "تظل رسوم الدخول بعملة العقد المعتمد. لا تُجرى أي عملية تحويل عملة.",
  } : {
    title: "Ouvrir ou rapprocher un livre de franchise", intro: "Sélectionnez le mandat approuvé et son périmètre. Le serveur vérifie les conditions financières, sans modifier les écritures ni les soldes existants.",
    select: "Mandat approuvé et règle financière", version: "Version", rule: "Règle financière", territory: "Territoire", fee: "Droit d’entrée approuvé", currency: "Devise du livre", feeCurrency: "Devise du droit d’entrée", existing: "Livre existant", submit: "Ouvrir le livre ou confirmer son rattachement", pending: "Vérification…", success: "Le livre est rattaché au mandat approuvé. Sa revue des coûts et sa clôture peuvent continuer selon leurs prérequis.",
    review: "Certains livres nécessitent un rapprochement du mandat. Ce formulaire peut rattacher un livre cohérent. Les livres incompatibles ou ambigus restent bloqués jusqu’à examen des preuves, sans réécrire leur historique.",
    empty: "Aucun mandat approuvé avec une règle financière compatible n’est disponible dans ce périmètre. Terminez la proposition et sa validation indépendante avant d’ouvrir le livre.", retry: "Recharger les choix", mfa: "Configurer ou vérifier mon second facteur", login: "Me connecter", back: "Retour à la gouvernance des franchises", finance: "Continuer vers la gouvernance et la finance", period: "Début du mandat", until: "Fin du mandat", noEnd: "Sans terme défini", currencyNote: "Le droit d’entrée reste libellé dans la devise contractuelle approuvée. Aucune conversion de devise n’est effectuée.",
  };
}
export function bookOpeningError(reason: BookOpeningFailure, locale: "fr" | "ar") {
  const fr: Record<BookOpeningFailure, string> = {
    VALIDATION: "Sélectionnez un mandat et une règle disponibles, puis réessayez.", UNAUTHENTICATED: "Votre session a expiré. Reconnectez-vous pour continuer.", FORBIDDEN: "L’ouverture des livres est réservée au responsable financier ou au super administrateur habilité.", MFA_REQUIRED: "Vérifiez votre second facteur pour accéder à cette opération financière.", CHANGED: "Le mandat ou son contexte financier a changé. Rechargez les choix avant une nouvelle demande.", RECONCILIATION: "Le livre existant est incompatible ou ambigu. Une revue de son mandat et de ses preuves est nécessaire ; aucune écriture n’a été modifiée.", SCOPE_REQUIRED: "Le périmètre contient trop de versions. Ouvrez ce parcours depuis une franchise précise.", UNAVAILABLE: "Le contexte financier n’a pas pu être vérifié. Réessayez ; aucun succès n’est confirmé.",
  };
  const ar: Record<BookOpeningFailure, string> = {
    VALIDATION: "اختاروا تفويضاً وقاعدة متاحين ثم أعيدوا المحاولة.", UNAUTHENTICATED: "انتهت الجلسة. سجّلوا الدخول للمتابعة.", FORBIDDEN: "فتح الدفاتر متاح فقط للمسؤول المالي أو المسؤول الأعلى المخوّل.", MFA_REQUIRED: "تحقّقوا من العامل الثاني للوصول إلى هذه العملية المالية.", CHANGED: "تغيّر التفويض أو سياقه المالي. أعيدوا تحميل الاختيارات قبل طلب جديد.", RECONCILIATION: "الدفتر الموجود متعارض أو ملتبس. يجب مراجعة التفويض وأدلته؛ لم يُعدّل أي قيد.", SCOPE_REQUIRED: "يحتوي النطاق على إصدارات كثيرة. افتحوا المسار من امتياز محدد.", UNAVAILABLE: "تعذر التحقق من السياق المالي. أعيدوا المحاولة؛ لم يُؤكّد أي نجاح.",
  };
  return (locale === "ar" ? ar : fr)[reason];
}

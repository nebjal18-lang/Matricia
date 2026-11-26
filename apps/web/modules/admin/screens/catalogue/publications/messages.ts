import type { Locale } from "@/modules/shared/lib/i18n/locale";

const fr = {
  nav: "Navigation des publications", back: "Retour au catalogue", language: "العربية", eyebrow: "Catalogue gouverné", title: "Publications et versions",
  description: "Consultez l’historique borné des releases et préparez un retour arrière reproductible. Aucun contenu de question n’est chargé sur cet écran.",
  unavailable: "Publications indisponibles. Vérifiez la bibliothèque, vos droits de revue et la MFA (AAL2) si exigée.", forbidden: "Ce module est réservé aux gestionnaires du catalogue.", retry: "Réessayer", noLibraries: "Aucune bibliothèque accessible.",
  releases: "releases visibles", current: "Version active", history: "Historique des versions", noReleases: "Aucune release visible pour cette bibliothèque.",
  truncated: "L’historique est limité aux 200 releases les plus récentes. Affinez par bibliothèque si nécessaire.", snapshot: "Empreinte", effective: "Prise d’effet", approval: "Approbation centrale",
  rollbackTitle: "Planifier un retour arrière", rollbackDescription: "Cette commande crée une nouvelle release planifiée depuis un snapshot publié ou retiré. Elle ne modifie jamais l’historique.",
  target: "Snapshot cible", releaseKey: "Clé de la nouvelle release", confirm: "Je confirme le snapshot cible et la création d’une nouvelle version gouvernée.", rollback: "Planifier le rollback", rollingBack: "Planification…",
  aal2: "Une authentification renforcée AAL2 est obligatoire pour le rollback.", noRollback: "Aucun snapshot antérieur éligible.", success: "Rollback planifié et audité.", result: "Nouvelle release",
  errors: { VALIDATION: "Vérifiez la cible, la clé de release et la confirmation.", UNAUTHENTICATED: "Votre session a expiré.", FORBIDDEN: "Vous n’avez pas la capacité serveur requise.", AAL2_REQUIRED: "Activez une session AAL2 avant cette action.", CONFLICT: "La version a changé ou cette commande existe déjà. Actualisez la page.", FAILED: "La commande n’a pas abouti." },
  statuses: { DRAFT: "Brouillon", IN_REVIEW: "En revue", APPROVED: "Approuvée", SCHEDULED: "Planifiée", PUBLISHING: "Publication", PUBLISHED: "Publiée", FAILED: "Échec", DEAD_LETTER: "Intervention requise", CANCELLED: "Annulée", RETIRED: "Retirée", ARCHIVED: "Archivée" },
};
const ar: typeof fr = {
  nav: "التنقل في الإصدارات", back: "العودة إلى الدليل", language: "Français", eyebrow: "دليل محكوم", title: "النشر والإصدارات",
  description: "اعرض سجلاً محدوداً للإصدارات وجهّز رجوعاً قابلاً لإعادة الإنتاج. لا يتم تحميل أي محتوى للأسئلة في هذه الشاشة.",
  unavailable: "الإصدارات غير متاحة. تحققوا من المكتبة وصلاحيات المراجعة والتحقق القوي (AAL2) عند اللزوم.", forbidden: "هذه الوحدة مخصصة لمسؤولي الدليل.", retry: "إعادة المحاولة", noLibraries: "لا توجد مكتبة متاحة.",
  releases: "إصدارات ظاهرة", current: "الإصدار النشط", history: "سجل الإصدارات", noReleases: "لا يوجد إصدار ظاهر لهذه المكتبة.",
  truncated: "السجل محدود بأحدث 200 إصدار. صفِّ حسب المكتبة عند الحاجة.", snapshot: "البصمة", effective: "بدء السريان", approval: "اعتماد مركزي",
  rollbackTitle: "جدولة الرجوع", rollbackDescription: "ينشئ هذا الأمر إصداراً جديداً مجدولاً من لقطة منشورة أو مسحوبة، ولا يغيّر السجل أبداً.",
  target: "اللقطة المستهدفة", releaseKey: "مفتاح الإصدار الجديد", confirm: "أؤكد اللقطة المستهدفة وإنشاء إصدار جديد محكوم.", rollback: "جدولة الرجوع", rollingBack: "جارٍ الجدولة…",
  aal2: "يلزم تحقق قوي AAL2 لتنفيذ الرجوع.", noRollback: "لا توجد لقطة سابقة مؤهلة.", success: "تمت جدولة الرجوع وتدقيقه.", result: "الإصدار الجديد",
  errors: { VALIDATION: "تحقق من الهدف ومفتاح الإصدار والتأكيد.", UNAUTHENTICATED: "انتهت الجلسة.", FORBIDDEN: "ليست لديك قدرة الخادم المطلوبة.", AAL2_REQUIRED: "فعّل جلسة AAL2 قبل هذا الإجراء.", CONFLICT: "تغير الإصدار أو سبق تسجيل الأمر. حدّث الصفحة.", FAILED: "تعذر تنفيذ الأمر." },
  statuses: { DRAFT: "مسودة", IN_REVIEW: "قيد المراجعة", APPROVED: "معتمد", SCHEDULED: "مجدول", PUBLISHING: "قيد النشر", PUBLISHED: "منشور", FAILED: "فشل", DEAD_LETTER: "يتطلب تدخلاً", CANCELLED: "ملغى", RETIRED: "مسحوب", ARCHIVED: "مؤرشف" },
};
export type PublicationMessages = typeof fr;
export function getPublicationMessages(locale: Locale): PublicationMessages { return locale === "ar" ? ar : fr; }

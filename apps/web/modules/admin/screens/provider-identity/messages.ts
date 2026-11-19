import type { Locale } from "@/modules/shared/lib/i18n/locale";

const fr = {
  title: "Revue d’identité du Prestataire",
  lead: "Revue explicite de l’identité courante et de ses pièces, avec historique conservé.",
  verified: "Identité courante vérifiée",
  revalidation: "Revérification requise",
  fingerprint: "Empreinte d’identité",
  documents: "Pièces vérifiées",
  openDocument: "Ouvrir la pièce vérifiée",
  missingDocs: "Trois pièces légale, fiscale et assurance actuelles, vérifiées et analysées sont requises.",
  confirm: "J’ai examiné les trois pièces et confirmé leur concordance avec l’identité affichée.",
  reason: "Motif et référence de vérification",
  submit: "Vérifier l’identité courante",
  submitting: "Enregistrement…",
  success: "Identité courante vérifiée et preuve de revue conservée.",
  declarations: "La version contient les déclarations d’exactitude et d’autorisation de représentation.",
  backProviders: "Retour aux prestataires",
  errors: {
    STALE: "Le dossier a changé. Rechargez puis vérifiez l’identité courante.",
    FORBIDDEN: "Opération refusée. Vérifiez les pièces, la MFA et vos droits.",
    DOCUMENTS_REQUIRED: "Trois pièces vérifiées et analysées sont requises.",
    VALIDATION: "Vérifiez la confirmation et le motif (10 caractères minimum).",
    FAILED: "La revue n’a pas pu être enregistrée. Réessayez.",
  },
} as const;

const ar = {
  title: "مراجعة هوية مقدم الخدمة",
  lead: "مراجعة صريحة للهوية الحالية ووثائقها مع حفظ السجل.",
  verified: "الهوية الحالية موثقة",
  revalidation: "إعادة التحقق مطلوبة",
  fingerprint: "بصمة الهوية",
  documents: "الوثائق المتحققة",
  openDocument: "فتح الوثيقة المتحققة",
  missingDocs: "يلزم ثلاث وثائق قانونية وضريبية وتأمينية حالية ومفحوصة.",
  confirm: "راجعت الوثائق الثلاث وأؤكد تطابقها مع الهوية المعروضة.",
  reason: "التعليل ومرجع التحقق",
  submit: "توثيق الهوية الحالية",
  submitting: "جارٍ التسجيل…",
  success: "تم توثيق الهوية الحالية وحفظ دليل المراجعة.",
  declarations: "تتضمن النسخة إقرار صحة البيانات والإذن بالتمثيل.",
  backProviders: "العودة إلى مقدمي الخدمة",
  errors: {
    STALE: "تغير الملف. أعيدوا التحميل ثم راجعوا الهوية.",
    FORBIDDEN: "رفضت العملية. تحققوا من الوثائق والمصادقة والصلاحيات.",
    DOCUMENTS_REQUIRED: "يلزم ثلاث وثائق متحققة ومفحوصة.",
    VALIDATION: "تحققوا من التأكيد والتعليل (10 أحرف على الأقل).",
    FAILED: "تعذر تسجيل المراجعة. أعيدوا المحاولة.",
  },
} as const;

export type ProviderIdentityMessages = { readonly [K in keyof typeof fr]: (typeof fr)[K] extends string ? string : { readonly [P in keyof (typeof fr)[K]]: string } };

export function getProviderIdentityMessages(locale: Locale): ProviderIdentityMessages {
  return locale === "ar" ? ar : fr;
}

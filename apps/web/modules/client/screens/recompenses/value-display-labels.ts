import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { workflowStatusLabel } from "@/modules/shared/lib/i18n/workflow-statuses";

const pair = (fr: string, ar: string) => [fr, ar] as const;

const conversionStages: Record<string, readonly [string, string]> = {
  REGISTERED: pair("Inscrit", "مسجّل"),
  PROFILE_STARTED: pair("Dossier en préparation", "الملف قيد الإعداد"),
  VERIFIED: pair("Vérifié", "تم التحقق"),
  ACTIVE: pair("Activé", "مفعّل"),
  REJECTED: pair("Refusé", "مرفوض"),
  CANCELLED: pair("Annulé", "ملغى"),
};

const subjectTypes: Record<string, readonly [string, string]> = {
  RECOMMENDATION: pair("Recommandation", "توصية"),
  OPPORTUNITY: pair("Opportunité", "فرصة"),
  SERVICE: pair("Service", "خدمة"),
  PROJECT: pair("Projet", "مشروع"),
  CONTRACT: pair("Contrat", "عقد"),
  ORGANIZATION: pair("Organisation", "مؤسسة"),
};

const audienceTypes: Record<string, readonly [string, string]> = {
  CLIENT: pair("Client", "عميل"),
  PROVIDER: pair("Prestataire", "مقدم خدمة"),
  REFERRED_CLIENT: pair("Client parrainé", "عميل مُحال"),
  REFERRED_PROVIDER: pair("Prestataire parrainé", "مقدم مُحال"),
  CLIENT_ORGANIZATION: pair("Organisation client", "مؤسسة عميل"),
};

const ruleStatuses: Record<string, readonly [string, string]> = {
  DRAFT: pair("Brouillon", "مسودة"),
  ACTIVE: pair("Active", "نشطة"),
  PAUSED: pair("En pause", "موقوفة"),
  RETIRED: pair("Retirée", "مُوقفة نهائياً"),
};

const linkStatuses: Record<string, readonly [string, string]> = {
  ACTIVE: pair("Active", "نشطة"),
  PAUSED: pair("En pause", "موقوفة"),
  EXPIRED: pair("Expirée", "منتهية"),
  REVOKED: pair("Révoquée", "ملغاة"),
};

const triggerEvents: Record<string, readonly [string, string]> = {
  REFERRAL_VERIFIED: pair("Parrainage vérifié", "إحالة تم التحقق منها"),
  REFERRAL_REGISTERED: pair("Parrainage inscrit", "إحالة مسجّلة"),
  REFERRAL_ACTIVE: pair("Parrainage activé", "إحالة مفعّلة"),
  PROJECT_COMPLETED: pair("Projet terminé", "مشروع مكتمل"),
  MISSION_ACCEPTED: pair("Mission acceptée", "مهمة مقبولة"),
  CONTRACT_SIGNED: pair("Contrat signé", "عقد موقّع"),
};

const decisions: Record<string, readonly [string, string]> = {
  APPROVED: pair("Approuvé", "معتمد"),
  REJECTED: pair("Refusé", "مرفوض"),
};

function fromMap(locale: Locale, map: Record<string, readonly [string, string]>, value: string) {
  const labels = map[value];
  if (!labels) {
    return locale === "ar" ? "رمز غير معروف" : "Code non reconnu";
  }
  return locale === "ar" ? labels[1] : labels[0];
}

export function conversionStageLabel(locale: Locale, value: string) {
  return fromMap(locale, conversionStages, value);
}

export function conversionTransitionLabel(locale: Locale, from: string | null, to: string) {
  const start = from ? conversionStageLabel(locale, from) : locale === "ar" ? "بداية" : "Départ";
  const end = conversionStageLabel(locale, to);
  return `${start} → ${end}`;
}

export function subjectTypeLabel(locale: Locale, value: string) {
  return fromMap(locale, subjectTypes, value);
}

export function audienceTypeLabel(locale: Locale, value: string) {
  return fromMap(locale, audienceTypes, value);
}

export function ruleStatusLabel(locale: Locale, value: string) {
  return fromMap(locale, ruleStatuses, value);
}

export function linkStatusLabel(locale: Locale, value: string) {
  return fromMap(locale, linkStatuses, value);
}

export function triggerEventLabel(locale: Locale, value: string) {
  return fromMap(locale, triggerEvents, value);
}

export function baselineDecisionLabel(locale: Locale, value: string) {
  return fromMap(locale, decisions, value);
}

export function rewardReferenceTypeLabel(locale: Locale, value: string) {
  const known = subjectTypes[value] ?? audienceTypes[value];
  if (known) return locale === "ar" ? known[1] : known[0];
  return workflowStatusLabel(value, locale);
}
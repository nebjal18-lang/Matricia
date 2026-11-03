import type { AdminWorkItem } from "./model";

export type AdminWorkSummary = {
  ordered: AdminWorkItem[];
  critical: number;
  overdue: number;
  dueToday: number;
  humanReview: number;
  exceptions: number;
};

const priorityRank: Record<AdminWorkItem["priority"], number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function dayInMorocco(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

export function summarizeAdminWork(items: AdminWorkItem[], currentTime: string): AdminWorkSummary {
  const now = new Date(currentTime).getTime();
  const today = dayInMorocco(currentTime);
  const ordered = [...items].sort(
    (left, right) =>
      Number(dayInMorocco(left.dueAt) !== today) - Number(dayInMorocco(right.dueAt) !== today) ||
      priorityRank[left.priority] - priorityRank[right.priority] ||
      new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime(),
  );
  return {
    ordered,
    critical: items.filter((item) => item.priority === "CRITICAL").length,
    overdue: items.filter((item) => new Date(item.dueAt).getTime() < now).length,
    dueToday: items.filter((item) => dayInMorocco(item.dueAt) === today).length,
    humanReview: items.filter((item) => item.sourceKind === "RISK_FLAG" || item.sourceKind === "MANUAL_REVIEW").length,
    exceptions: items.filter((item) => item.sourceKind === "EXCEPTION").length,
  };
}

const motifFr: Record<string, string> = {
  RISK_FLAG: "Signal de risque à revue humaine",
  EXCEPTION: "Exception opérationnelle",
  MANUAL_REVIEW: "Revue manuelle requise",
  APPROVAL: "Approbation en attente",
  SLA: "Échéance ou SLA dépassé",
  COMPLIANCE: "Conformité à traiter",
  QUALIFICATION: "Qualification prestataire",
};

const motifAr: Record<string, string> = {
  RISK_FLAG: "إشارة مخاطر تحتاج مراجعة بشرية",
  EXCEPTION: "استثناء تشغيلي",
  MANUAL_REVIEW: "مراجعة يدوية مطلوبة",
  APPROVAL: "موافقة معلّقة",
  SLA: "تجاوز الموعد أو اتفاقية الخدمة",
  COMPLIANCE: "امتثال يجب معالجته",
  QUALIFICATION: "تأهيل مقدم الخدمة",
};

const nextFr: Record<string, string> = {
  OPEN: "Prendre en charge",
  CLAIMED: "Résoudre ou demander un complément",
  WAITING_INFORMATION: "Examiner le complément reçu",
};

const nextAr: Record<string, string> = {
  OPEN: "تولي المعالجة",
  CLAIMED: "حل المهمة أو طلب تكملة",
  WAITING_INFORMATION: "مراجعة التكملة المستلمة",
};

export function workItemMotif(item: AdminWorkItem, locale: "fr" | "ar") {
  const map = locale === "ar" ? motifAr : motifFr;
  return map[item.sourceKind] ?? (locale === "ar" ? "متابعة مطلوبة" : "Suivi requis");
}

export function workItemNextAction(item: AdminWorkItem, locale: "fr" | "ar") {
  const map = locale === "ar" ? nextAr : nextFr;
  return map[item.status] ?? (locale === "ar" ? "مراجعة الملف" : "Examiner le dossier");
}

export const RESOLUTION_CODES = [
  { code: "COMPLETED", fr: "Traité et clos", ar: "تمت المعالجة والإغلاق" },
  { code: "INFO_REQUESTED", fr: "Complément demandé", ar: "طلب تكملة" },
  { code: "ESCALATED", fr: "Escaladé", ar: "تم التصعيد" },
  { code: "NO_ACTION", fr: "Aucune action supplémentaire", ar: "لا إجراء إضافي" },
  { code: "FALSE_POSITIVE", fr: "Fausse alerte", ar: "إنذار كاذب" },
] as const;

export function dossierHref(locale: "fr" | "ar", item: AdminWorkItem) {
  const type = item.resourceType.toLowerCase();
  const id = item.resourceId;
  if (type === "notification_template_review") return `/${locale}/administration/messagerie/preferences`;
  if (type === "membership_capability_review") return `/${locale}/administration/revues-capacites`;
  if (type === "privacy_retention_action") return `/${locale}/administration/confidentialite`;
  if (type === "client_assistance_request") return `/${locale}/administration/assistance/${id}`;
  if (type.includes("dispute") || item.sourceKind === "DISPUTE") return `/${locale}/administration/litiges/${id}`;
  if (type.includes("compliance")) return `/${locale}/administration/conformite-clients`;
  if (type.includes("provider") || type.includes("qualification")) return `/${locale}/administration/providers`;
  if (type.includes("document")) return `/${locale}/administration/documents/${id}`;
  if (type.includes("mission") || type.includes("deliverable") || type.includes("milestone")) {
    return `/${locale}/administration/missions/${id}`;
  }
  if (type.includes("contract") || type.includes("amendment")) return `/${locale}/administration/contrats/${id}`;
  if (type.includes("quote") || type.includes("rfq") || type.includes("request") || type.includes("matching")) {
    return `/${locale}/administration/demandes/${id}`;
  }
  if (type.includes("diagnostic")) return `/${locale}/administration/diagnostics/${id}`;
  if (type.includes("payment") || type.includes("finance") || type.includes("invoice") || item.sourceKind === "FINANCE") {
    return `/${locale}/administration/finance`;
  }
  if (type.includes("pool") || item.sourceKind === "POOL") return `/${locale}/administration/achats-groupes`;
  if (item.organizationId) return `/${locale}/administration/entreprises/${item.organizationId}`;
  return `/${locale}/administration/command-center`;
}

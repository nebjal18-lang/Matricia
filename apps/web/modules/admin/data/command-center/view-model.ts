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

// A resource ID is not its parent's ID. Only routes backed by a projection
// keyed by this exact resource type may receive it as a detail segment.
const detailSpaces: Record<string, string> = {
  dispute: "litiges", dispute_case: "litiges", mission_dispute: "litiges",
  service_request: "demandes",
  quote: "devis", matching_run: "matching",
  milestone: "jalons", mission_milestone: "jalons",
  amendment: "avenants", contract_amendment: "avenants",
  mission: "missions", contract: "contrats",
  diagnostic: "diagnostics", diagnostic_run: "diagnostics",
  provider_document_version: "documents", client_compliance_document: "documents",
};
const queueSpaces: Record<string, string> = {
  rfq: "matching", rfq_provider: "matching",
  deliverable: "missions", mission_deliverable: "missions",
  quote_version: "devis", contract_version: "contrats",
  provider_document: "documents", document: "documents",
};

export function dossierHref(locale: "fr" | "ar", item: AdminWorkItem, query = "") {
  const type = item.resourceType.trim().toLowerCase();
  const id = encodeURIComponent(item.resourceId);
  const base = `/${locale}/administration`;
  let path: string;
  if (["", ".", ".."].includes(item.resourceId)) path = `${base}/command-center`;
  else if (type === "franchise_governance_signal_review") path = `${base}/gouvernance-franchise/signalements/${id}`;
  else if (type === "franchise_control_plan_owner") path = `${base}/gouvernance-franchise/plans/${id}/responsable`;
  else if (type === "notification_template_review") path = `${base}/messagerie/preferences`;
  else if (type === "membership_capability_review") path = `${base}/revues-capacites`;
  else if (type === "privacy_retention_action") path = `${base}/confidentialite`;
  else if (type === "client_assistance_request") path = `${base}/assistance/${id}`;
  else if (Object.hasOwn(detailSpaces, type)) path = `${base}/${detailSpaces[type]}/${id}`;
  else if (Object.hasOwn(queueSpaces, type)) path = `${base}/${queueSpaces[type]}`;
  else if (type.includes("compliance")) path = `${base}/conformite-clients`;
  else if (type.includes("provider") || type.includes("qualification")) path = `${base}/providers`;
  else if (type.includes("document")) path = `${base}/documents`;
  else if (type.includes("payment") || type.includes("finance") || type.includes("invoice") || item.sourceKind === "FINANCE") path = `${base}/finance`;
  else if (type.includes("pool") || item.sourceKind === "POOL") path = `${base}/achats-groupes`;
  else if (item.organizationId) path = `${base}/entreprises/${encodeURIComponent(item.organizationId)}`;
  else path = `${base}/command-center`;
  // Search and approval pagination belong to the command center. Only the
  // organization context follows a link into another business module.
  const organizationId = new URLSearchParams(query).get("organizationId");
  return organizationId ? `${path}?${new URLSearchParams({ organizationId })}` : path;
}

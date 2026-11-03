import type { UserActionItem } from "@/modules/shared/lib/action-center/model";

export type ProviderHomeCounts = {
  consultationsDue: number | null;
  quotesInProgress: number | null;
  activeMissions: number | null;
  deliverablesDue: number | null;
  invoicesOutstanding: number | null;
};

export type ProviderHomeStage = "new" | "qualified" | "blocked";

export type ProviderPrioritySituation =
  | "CONSULTATION"
  | "QUOTE_DUE"
  | "QUOTE_DRAFT"
  | "MESSAGE"
  | "CONTRACT"
  | "MILESTONE"
  | "DELIVERABLE_REJECTED"
  | "DOCUMENT"
  | "INVOICE"
  | "GENERIC";

export type ProviderBlocker = {
  scope: "organization" | "service";
  serviceLabel: string | null;
  reasonCodes: string[];
  nextAction: string;
};

export type ProviderPriorityRow = {
  id: string;
  situation: ProviderPrioritySituation;
  title: string;
  dossier: string;
  dueAt: string | null;
  nextAction: string;
  href: string;
  priority: UserActionItem["priority"];
};

const INVITE_OPEN = new Set(["INVITED", "VIEWED", "ACCEPTED"]);
const QUOTE_DRAFT = new Set(["DRAFT", "IN_PROGRESS", "CLARIFICATION_REQUESTED"]);
const QUOTE_ACTIVE = new Set(["DRAFT", "SUBMITTED", "REVISED", "CLARIFICATION_REQUESTED"]);
const BLOCKED_OVERALL = new Set(["SUSPENDED", "TERMINATED", "FINANCIAL_RESTRICTED", "QUALITY_RESTRICTED", "COMPLIANCE_RESTRICTED"]);
const QUALIFIED_OVERALL = new Set(["APPROVED", "CONDITIONAL", "PARTIALLY_QUALIFIED", "DECIDED", "ACTIVE"]);

export function computeProviderHomeCounts(input: {
  invitations?: Array<{ status: string; deadline: string; quote: { status: string } | null }> | null;
  missions?: Array<{ status: string; scopeReconciliationRequired?:boolean; milestones: Array<{ status: string; dueAt: string | null; retired?: boolean }>; deliverables: Array<{ status: string; retirement?: unknown }> }> | null;
  invoices?: Array<{ paymentStatus: string; outstandingMinor: string }> | null;
  actionItems: readonly UserActionItem[];
  now: string;
  snapshotUnavailable?: boolean;
}): ProviderHomeCounts {
  if (input.snapshotUnavailable) {
    return { consultationsDue: null, quotesInProgress: null, activeMissions: null, deliverablesDue: null, invoicesOutstanding: null };
  }
  const invitations = input.invitations ?? [];
  const missions = input.missions ?? [];
  const invoices = input.invoices ?? [];
  const now = Date.parse(input.now);

  const consultationsDue = invitations.filter((item) => INVITE_OPEN.has(item.status) && (!item.quote || QUOTE_DRAFT.has(item.quote.status))).length;
  const quotesInProgress = invitations.filter((item) => item.quote && QUOTE_ACTIVE.has(item.quote.status) && item.quote.status !== "SELECTED").length;
  const activeMissions = missions.filter((item) => !["COMPLETED", "CANCELLED", "CLOSED"].includes(item.status)).length;
  const deliverablesDue = missions.some(mission=>mission.scopeReconciliationRequired===true)?null:missions.filter(item => !["COMPLETED", "CANCELLED", "CLOSED"].includes(item.status)).reduce(
    (sum, mission) =>
      sum +
      mission.deliverables.filter((item) => !item.retirement && ["PENDING", "REJECTED", "CORRECTION_REQUIRED", "IN_PROGRESS"].includes(item.status)).length +
      mission.milestones.filter((item) => !item.retired && item.dueAt && !["DONE", "COMPLETED", "ACCEPTED"].includes(item.status) && Date.parse(item.dueAt) <= now + 7 * 86_400_000).length,
    0,
  );
  const invoicesOutstanding = invoices.filter((item) => item.paymentStatus !== "PAID" && item.outstandingMinor !== "0").length;

  return { consultationsDue, quotesInProgress, activeMissions, deliverablesDue, invoicesOutstanding };
}

export function resolveProviderHomeStage(input: {
  profileOverallStatus: string | null;
  hasServices: boolean;
  blockedServices: number;
  qualifiedServices: number;
}): ProviderHomeStage {
  if (input.profileOverallStatus && BLOCKED_OVERALL.has(input.profileOverallStatus)) return "blocked";
  if (input.blockedServices > 0 && input.qualifiedServices === 0) return "blocked";
  if (input.qualifiedServices > 0 || (input.profileOverallStatus && QUALIFIED_OVERALL.has(input.profileOverallStatus))) return "qualified";
  if (!input.hasServices || !input.profileOverallStatus || input.profileOverallStatus === "PROFILE_INCOMPLETE") return "new";
  return "new";
}

export function buildProviderBlockers(input: {
  profileOverallStatus: string | null;
  services: Array<{ label: string; eligible: boolean; reasons: string[]; qualificationStatus: string }>;
  locale: "fr" | "ar";
}): ProviderBlocker[] {
  const blockers: ProviderBlocker[] = [];
  if (input.profileOverallStatus && BLOCKED_OVERALL.has(input.profileOverallStatus)) {
    blockers.push({
      scope: "organization",
      serviceLabel: null,
      reasonCodes: [input.profileOverallStatus],
      nextAction: input.locale === "ar" ? "افتح التأهيل لتجديد الملف" : "Ouvrir la qualification pour régulariser le dossier",
    });
  }
  for (const service of input.services) {
    const restricted = !service.eligible || ["REJECTED", "SUSPENDED", "EXPIRED", "QUALIFICATION_REJECTED", "QUALIFICATION_SUSPENDED"].includes(service.qualificationStatus);
    if (!restricted) continue;
    blockers.push({
      scope: "service",
      serviceLabel: service.label,
      reasonCodes: service.reasons.length > 0 ? service.reasons : [service.qualificationStatus],
      nextAction: input.locale === "ar" ? "أكمل القطع أو اطلب إعادة الفحص" : "Compléter les pièces ou demander un réexamen",
    });
  }
  return blockers;
}

export function inferProviderSituation(item: UserActionItem): ProviderPrioritySituation {
  const hay = `${item.title} ${item.detail} ${item.href}`.toLowerCase();
  if (item.kind === "MESSAGE" || hay.includes("messagerie")) return "MESSAGE";
  if (hay.includes("refus") || hay.includes("reject") || hay.includes("correction") || hay.includes("رفض")) return "DELIVERABLE_REJECTED";
  if (hay.includes("document") || hay.includes("expir") || hay.includes("مستند")) return "DOCUMENT";
  if (hay.includes("facture") || hay.includes("invoice") || hay.includes("فاتور") || hay.includes("facturation")) return "INVOICE";
  if (hay.includes("jalon") || hay.includes("milestone") || hay.includes("علام")) return "MILESTONE";
  if (hay.includes("contrat") || hay.includes("sign") || hay.includes("عقد")) return "CONTRACT";
  if (hay.includes("consultation") || hay.includes("invitation") || hay.includes("rfq") || hay.includes("استشار") || hay.includes("besoin")) return "CONSULTATION";
  if (hay.includes("brouillon") || hay.includes("draft") || hay.includes("مسود")) return "QUOTE_DRAFT";
  if (hay.includes("devis") || hay.includes("quote") || hay.includes("عرض")) return "QUOTE_DUE";
  return "GENERIC";
}

export function proposedProviderAction(situation: ProviderPrioritySituation, locale: "fr" | "ar"): string {
  const fr: Record<ProviderPrioritySituation, string> = {
    CONSULTATION: "Examiner le besoin",
    QUOTE_DUE: "Préparer mon devis",
    QUOTE_DRAFT: "Reprendre le brouillon",
    MESSAGE: "Répondre",
    CONTRACT: "Examiner et signer",
    MILESTONE: "Préparer la livraison",
    DELIVERABLE_REJECTED: "Consulter les corrections demandées",
    DOCUMENT: "Renouveler la pièce",
    INVOICE: "Ouvrir le dossier de facturation",
    GENERIC: "Ouvrir",
  };
  const ar: Record<ProviderPrioritySituation, string> = {
    CONSULTATION: "مراجعة الاحتياج",
    QUOTE_DUE: "إعداد عرضي",
    QUOTE_DRAFT: "استئناف المسودة",
    MESSAGE: "الرد",
    CONTRACT: "مراجعة والتوقيع",
    MILESTONE: "تجهيز التسليم",
    DELIVERABLE_REJECTED: "مراجعة التصحيحات المطلوبة",
    DOCUMENT: "تجديد الوثيقة",
    INVOICE: "فتح ملف الفوترة",
    GENERIC: "فتح",
  };
  return locale === "ar" ? ar[situation] : fr[situation];
}

export function toProviderPriorityRows(items: readonly UserActionItem[], locale: "fr" | "ar", organizationQuery: string): ProviderPriorityRow[] {
  return items.map((item) => {
    const situation = inferProviderSituation(item);
    const href = organizationQuery
      ? `${item.href}${item.href.includes("?") ? "&" : "?"}${organizationQuery.replace(/^\?/, "")}`
      : item.href;
    return {
      id: item.id,
      situation,
      title: proposedProviderAction(situation, locale),
      dossier: item.organizationName ? `${item.title} · ${item.organizationName}` : item.title,
      dueAt: item.dueAt,
      nextAction: proposedProviderAction(situation, locale),
      href,
      priority: item.priority,
    };
  });
}

export function filterProviderFacingActions(items: readonly UserActionItem[], hasPlatformRole: boolean): UserActionItem[] {
  if (hasPlatformRole) return [...items];
  return items.filter((item) => !item.href.includes("/administration/") && !item.href.includes("/client/"));
}

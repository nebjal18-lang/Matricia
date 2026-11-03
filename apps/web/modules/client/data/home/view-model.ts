import type { UserActionItem } from "@/modules/shared/lib/action-center/model";

export type ClientHomeCounts = {
  openRequests: number | null;
  quotesToReview: number | null;
  activeMissions: number | null;
  pendingDecisions: number | null;
  upcomingDue: number | null;
};

export type ClientHomeStage = "new" | "active" | "team";

export type ClientPrioritySituation =
  | "DIAGNOSTIC"
  | "DOCUMENT"
  | "QUOTES"
  | "CONTRACT"
  | "DELIVERABLE"
  | "INVOICE"
  | "MESSAGE"
  | "APPROVAL"
  | "GENERIC";

export type ClientActionTone = "violet" | "mint" | "rose" | "peach";

export type ClientPriorityRow = {
  id: string;
  situation: ClientPrioritySituation;
  title: string;
  dossier: string;
  cta: string;
  tone: ClientActionTone;
  dueAt: string | null;
  owner: string;
  href: string;
  priority: UserActionItem["priority"];
};

export type ClientFeedRow = {
  id: string;
  title: string;
  href: string;
  dueAt: string | null;
};

const OPEN_REQUEST = new Set([
  "DRAFT",
  "INFORMATION_REQUIRED",
  "READY",
  "MATCHING",
  "RFQ_OPEN",
  "QUOTES_RECEIVED",
  "CLIENT_REVIEW",
  "PROVIDER_SELECTED",
  "CONTRACT_PENDING",
]);


export function computeClientHomeCounts(input: {
  requests?: Array<{ status: string; quoteCount: number }> | null;
  missions?: Array<{ status: string; milestones: Array<{ status: string; dueAt: string | null }>; deliverables: Array<{ status: string }> }> | null;
  contracts?: Array<{ status: string; signatureCount: number }> | null;
  actionItems: readonly UserActionItem[];
  now: string;
  snapshotUnavailable?: boolean;
}): ClientHomeCounts {
  if (input.snapshotUnavailable) {
    return { openRequests: null, quotesToReview: null, activeMissions: null, pendingDecisions: null, upcomingDue: null };
  }
  const requests = input.requests ?? [];
  const missions = input.missions ?? [];
  const contracts = input.contracts ?? [];
  const now = Date.parse(input.now);
  const week = now + 7 * 86_400_000;

  const openRequests = requests.filter((item) => OPEN_REQUEST.has(item.status)).length;
  const quotesToReview = requests.reduce((sum, item) => sum + (item.quoteCount > 0 && ["RFQ_OPEN", "QUOTES_RECEIVED", "CLIENT_REVIEW"].includes(item.status) ? item.quoteCount : 0), 0);
  const activeMissions = missions.filter((item) => !["COMPLETED", "CANCELLED", "CLOSED"].includes(item.status)).length;
  const pendingSignatures = contracts.filter((item) => item.status !== "SIGNED" && item.status !== "ACTIVE" && item.signatureCount === 0).length;
  const pendingDeliverables = missions.reduce((sum, mission) => sum + mission.deliverables.filter((item) => ["SUBMITTED", "IN_REVIEW"].includes(item.status)).length, 0);
  const pendingDecisions = pendingSignatures + pendingDeliverables + input.actionItems.filter((item) => item.requiresHumanReview || item.kind === "APPROVAL").length;
  const upcomingDue = [
    ...input.actionItems.filter((item) => item.dueAt && Date.parse(item.dueAt) >= now && Date.parse(item.dueAt) <= week),
    ...missions.flatMap((mission) => mission.milestones.filter((item) => item.dueAt && !["DONE", "COMPLETED"].includes(item.status) && Date.parse(item.dueAt) >= now && Date.parse(item.dueAt) <= week)),
  ].length;

  return { openRequests, quotesToReview, activeMissions, pendingDecisions, upcomingDue };
}

export function resolveClientHomeStage(input: {
  hasOrganization: boolean;
  openRequests: number | null;
  activeMissions: number | null;
  isTeamLead: boolean;
}): ClientHomeStage {
  if (input.isTeamLead && ((input.openRequests ?? 0) > 0 || (input.activeMissions ?? 0) > 0)) return "team";
  if ((input.openRequests ?? 0) > 0 || (input.activeMissions ?? 0) > 0) return "active";
  return input.hasOrganization ? "new" : "new";
}

export function inferClientSituation(item: UserActionItem): ClientPrioritySituation {
  const hay = `${item.title} ${item.detail} ${item.href}`.toLowerCase();
  if (item.kind === "MESSAGE" || hay.includes("messagerie")) return "MESSAGE";
  if (item.kind === "APPROVAL" || hay.includes("approb")) return "APPROVAL";
  if (hay.includes("diagnostic") || hay.includes("bilan") || hay.includes("تشخيص")) return "DIAGNOSTIC";
  if (hay.includes("document") || hay.includes("conform") || hay.includes("pièce") || hay.includes("مستند")) return "DOCUMENT";
  if (hay.includes("devis") || hay.includes("quote") || hay.includes("عرض") || hay.includes("compar")) return "QUOTES";
  if (hay.includes("contrat") || hay.includes("sign") || hay.includes("عقد")) return "CONTRACT";
  if (hay.includes("livrable") || hay.includes("deliver") || hay.includes("تسليم")) return "DELIVERABLE";
  if (hay.includes("facture") || hay.includes("invoice") || hay.includes("فاتور")) return "INVOICE";
  return "GENERIC";
}

export function proposedActionLabel(situation: ClientPrioritySituation, locale: "fr" | "ar"): string {
  const fr: Record<ClientPrioritySituation, string> = {
    DIAGNOSTIC: "Reprendre un bilan",
    DOCUMENT: "Compléter une pièce",
    QUOTES: "Comparer les offres reçues",
    CONTRACT: "Examiner le contrat",
    DELIVERABLE: "Examiner un livrable",
    INVOICE: "Consulter la facture",
    MESSAGE: "Répondre à un message",
    APPROVAL: "Décider",
    GENERIC: "Ouvrir",
  };
  const ar: Record<ClientPrioritySituation, string> = {
    DIAGNOSTIC: "استئناف تحليل",
    DOCUMENT: "استكمال مستند",
    QUOTES: "مقارنة العروض المستلمة",
    CONTRACT: "مراجعة العقد",
    DELIVERABLE: "مراجعة تسليم",
    INVOICE: "عرض الفاتورة",
    MESSAGE: "الرد على رسالة",
    APPROVAL: "اتخاذ قرار",
    GENERIC: "فتح",
  };
  return locale === "ar" ? ar[situation] : fr[situation];
}

export function actionCtaLabel(situation: ClientPrioritySituation, locale: "fr" | "ar"): string {
  const fr: Record<ClientPrioritySituation, string> = {
    DIAGNOSTIC: "Voir le bilan",
    DOCUMENT: "Ajouter la pièce",
    QUOTES: "Comparer",
    CONTRACT: "Voir le contrat",
    DELIVERABLE: "Voir le livrable",
    INVOICE: "Voir la facture",
    MESSAGE: "Répondre",
    APPROVAL: "Décider",
    GENERIC: "Ouvrir",
  };
  const ar: Record<ClientPrioritySituation, string> = {
    DIAGNOSTIC: "عرض التحليل",
    DOCUMENT: "إضافة المستند",
    QUOTES: "مقارنة",
    CONTRACT: "عرض العقد",
    DELIVERABLE: "عرض التسليم",
    INVOICE: "عرض الفاتورة",
    MESSAGE: "الرد",
    APPROVAL: "اتخاذ قرار",
    GENERIC: "فتح",
  };
  return locale === "ar" ? ar[situation] : fr[situation];
}

export function actionTone(situation: ClientPrioritySituation): ClientActionTone {
  if (situation === "QUOTES") return "mint";
  if (situation === "DELIVERABLE") return "rose";
  if (situation === "DOCUMENT") return "peach";
  return "violet";
}

export function toClientPriorityRows(items: readonly UserActionItem[], locale: "fr" | "ar", organizationQuery: string): ClientPriorityRow[] {
  return items.map((item) => {
    const situation = inferClientSituation(item);
    const href = organizationQuery
      ? `${item.href}${item.href.includes("?") ? "&" : "?"}${organizationQuery.replace(/^\?/, "")}`
      : item.href;
    return {
      id: item.id,
      situation,
      title: proposedActionLabel(situation, locale),
      dossier: item.detail || item.title,
      cta: actionCtaLabel(situation, locale),
      tone: actionTone(situation),
      dueAt: item.dueAt,
      owner: item.kind === "APPROVAL" ? (locale === "ar" ? "مسؤول مخوّل" : "Responsable habilité") : (locale === "ar" ? "أنت" : "Vous"),
      href,
      priority: item.priority,
    };
  });
}

export function filterClientFacingActions(items: readonly UserActionItem[], hasPlatformRole: boolean): UserActionItem[] {
  if (hasPlatformRole) return [...items];
  return items.filter((item) => !item.href.includes("/administration/"));
}

export type ClientJourneyStepId = "need" | "consultation" | "quotes" | "contract" | "mission" | "delivery";

export function toClientInboxRows(items: readonly UserActionItem[], situation: ClientPrioritySituation, organizationQuery: string, limit = 3): ClientFeedRow[] {
  return items
    .filter((item) => inferClientSituation(item) === situation)
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      title: item.title,
      href: organizationQuery ? `${item.href}${item.href.includes("?") ? "&" : "?"}${organizationQuery.replace(/^\?/, "")}` : item.href,
      dueAt: item.dueAt,
    }));
}

export function toClientDeadlineRows(input: {
  items: readonly UserActionItem[];
  milestone: { title: string; dueAt: string | null } | null;
  missionsHref: string;
  now: string;
  organizationQuery: string;
  limit?: number;
}): ClientFeedRow[] {
  const limit = input.limit ?? 3;
  const fromActions = input.items
    .filter((item) => item.dueAt && Date.parse(item.dueAt) >= Date.parse(input.now))
    .map((item) => ({
      id: item.id,
      title: item.title,
      href: input.organizationQuery ? `${item.href}${item.href.includes("?") ? "&" : "?"}${input.organizationQuery.replace(/^\?/, "")}` : item.href,
      dueAt: item.dueAt,
    }));
  const extra = input.milestone?.title && input.milestone.dueAt && !fromActions.some((row) => row.title === input.milestone?.title)
    ? [{ id: "milestone", title: input.milestone.title, href: input.missionsHref, dueAt: input.milestone.dueAt }]
    : [];
  return [...fromActions, ...extra]
    .sort((left, right) => Date.parse(left.dueAt ?? "9999-12-31") - Date.parse(right.dueAt ?? "9999-12-31"))
    .slice(0, limit);
}

export type ClientFeaturedProject = {
  requestId: string;
  title: string;
  status: string;
  createdAt: string;
  quoteCount: number;
  href: string;
  steps: Array<{ id: ClientJourneyStepId; current: boolean; done: boolean }>;
};

export type ClientComparisonColumn = {
  quoteId: string;
  label: string;
  durationDays: number;
  deliverablesCount: number;
  totalMinor: string;
  currency: string;
  priceRank: number;
  exclusions?: string;
};

export type ClientHomeComparison = {
  requestId: string;
  href: string;
  description: string;
  columns: ClientComparisonColumn[];
};

export type ClientHomeInsights = {
  documentsToReview: number | null;
  nextMilestoneTitle: string | null;
  nextMilestoneDue: string | null;
  messagesToHandle: number | null;
};

export function pickFeaturedRequest<T extends { status: string; quoteCount: number }>(requests: readonly T[]): T | null {
  return requests.find((item) => item.quoteCount > 0 && ["RFQ_OPEN", "QUOTES_RECEIVED", "CLIENT_REVIEW"].includes(item.status))
    ?? requests.find((item) => OPEN_REQUEST.has(item.status))
    ?? null;
}

export function clientJourneySteps(status: string): Array<{ id: ClientJourneyStepId; current: boolean; done: boolean }> {
  const order: ClientJourneyStepId[] = ["need", "consultation", "quotes", "contract", "mission", "delivery"];
  const current: ClientJourneyStepId =
    ["COMPLETED", "CLOSED"].includes(status) ? "delivery"
      : status === "CONTRACTED" ? "mission"
        : ["CONTRACT_PENDING", "PROVIDER_SELECTED"].includes(status) ? "contract"
          : ["RFQ_OPEN", "QUOTES_RECEIVED", "CLIENT_REVIEW"].includes(status) ? "quotes"
            : ["MATCHING", "READY"].includes(status) ? "consultation"
              : "need";
  const index = order.indexOf(current);
  return order.map((id, stepIndex) => ({ id, current: stepIndex === index, done: stepIndex < index }));
}

export function toClientHomeInsights(input: {
  actionItems: readonly UserActionItem[];
  milestones: Array<{ title: string; status: string; dueAt: string | null }>;
  now: string;
  snapshotUnavailable?: boolean;
}): ClientHomeInsights {
  if (input.snapshotUnavailable) {
    return { documentsToReview: null, nextMilestoneTitle: null, nextMilestoneDue: null, messagesToHandle: null };
  }
  const now = Date.parse(input.now);
  const next = [...input.milestones]
    .filter((item) => !["DONE", "COMPLETED", "CANCELLED"].includes(item.status))
    .sort((left, right) => Date.parse(left.dueAt ?? "9999-12-31") - Date.parse(right.dueAt ?? "9999-12-31"))[0] ?? null;
  return {
    documentsToReview: input.actionItems.filter((item) => inferClientSituation(item) === "DOCUMENT").length,
    nextMilestoneTitle: next?.title ?? null,
    nextMilestoneDue: next?.dueAt && Date.parse(next.dueAt) >= now ? next.dueAt : next?.dueAt ?? null,
    messagesToHandle: input.actionItems.filter((item) => inferClientSituation(item) === "MESSAGE").length,
  };
}

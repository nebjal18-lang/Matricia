import { createServerClientRfqRepository } from "@/modules/client/data/rfq/server-repository";
import { loadContractMissions } from "@/modules/shared/lib/contracts-missions/repository";
import type { QuoteComparison } from "@/modules/client/data/rfq/model";
import {
  clientJourneySteps,
  computeClientHomeCounts,
  pickFeaturedRequest,
  resolveClientHomeStage,
  toClientHomeInsights,
  type ClientFeaturedProject,
  type ClientHomeComparison,
  type ClientHomeCounts,
  type ClientHomeInsights,
  type ClientHomeStage,
} from "./view-model";
import type { UserActionItem } from "@/modules/shared/lib/action-center/model";

export type ClientHomeSnapshot =
  | {
      status: "success";
      stage: ClientHomeStage;
      counts: ClientHomeCounts;
      lastRequestId: string | null;
      organizationName: string | null;
      featuredProject: ClientFeaturedProject | null;
      comparison: ClientHomeComparison | null;
      insights: ClientHomeInsights;
      partialSources?: Array<{ source: "requests" | "missions"; reason: "FORBIDDEN" | "UNAVAILABLE" }>;
    }
  | { status: "error"; reason: "UNAUTHENTICATED" | "FORBIDDEN" | "UNAVAILABLE"; counts: ClientHomeCounts; insights: ClientHomeInsights };

const emptyInsights: ClientHomeInsights = {
  documentsToReview: null,
  nextMilestoneTitle: null,
  nextMilestoneDue: null,
  messagesToHandle: null,
};

export async function loadClientHomeSnapshot(input: {
  organizationId: string | null;
  locale: "fr" | "ar";
  actionItems: readonly UserActionItem[];
  now: string;
  isTeamLead: boolean;
}): Promise<ClientHomeSnapshot> {
  const emptyUnavailable: ClientHomeCounts = {
    openRequests: null,
    quotesToReview: null,
    activeMissions: null,
    pendingDecisions: null,
    upcomingDue: null,
  };

  if (!input.organizationId) {
    return {
      status: "success",
      stage: "new",
      counts: computeClientHomeCounts({ actionItems: input.actionItems, now: input.now, requests: [], missions: [], contracts: [] }),
      lastRequestId: null,
      organizationName: null,
      featuredProject: null,
      comparison: null,
      insights: toClientHomeInsights({ actionItems: input.actionItems, milestones: [], now: input.now }),
    };
  }

  try {
    const repo = await createServerClientRfqRepository({ organizationId: input.organizationId, allForOrganization: true });
    const [rfq, missions] = await Promise.all([repo.list(), loadContractMissions(input.locale, input.organizationId)]);

    if ((rfq.status === "error" && rfq.reason === "UNAUTHENTICATED") || (missions.status === "error" && missions.reason === "UNAUTHENTICATED")) {
      return { status: "error", reason: "UNAUTHENTICATED", counts: emptyUnavailable, insights: emptyInsights };
    }

    const partialSources: Array<{ source: "requests" | "missions"; reason: "FORBIDDEN" | "UNAVAILABLE" }> = [];
    if (rfq.status === "error") partialSources.push({ source: "requests", reason: ["FORBIDDEN", "NO_CLIENT_ORGANIZATION", "ORGANIZATION_SELECTION_REQUIRED"].includes(rfq.reason) ? "FORBIDDEN" : "UNAVAILABLE" });
    if (missions.status === "error") partialSources.push({ source: "missions", reason: ["FORBIDDEN_ORGANIZATION", "NO_CLIENT_ORGANIZATION", "ORGANIZATION_SELECTION_REQUIRED"].includes(missions.reason) ? "FORBIDDEN" : "UNAVAILABLE" });
    if (partialSources.length === 2) return { status: "error", reason: partialSources.every((item) => item.reason === "FORBIDDEN") ? "FORBIDDEN" : "UNAVAILABLE", counts: emptyUnavailable, insights: emptyInsights };
    const missionDashboard = missions.status === "success" ? missions.dashboard : null;
    const orgRequests = rfq.status === "success" ? rfq.value.requests.filter((item) => item.organizationId === input.organizationId) : [];
    const counts = computeClientHomeCounts({
      requests: orgRequests.map((item) => ({ status: item.status, quoteCount: item.quoteCount })),
      missions: (missionDashboard?.missions ?? []).map((mission) => ({
        status: mission.status,
        milestones: mission.milestones.map((item) => ({ status: item.status, dueAt: item.dueAt })),
        deliverables: mission.deliverables.map((item) => ({ status: item.status })),
      })),
      contracts: (missionDashboard?.contracts ?? []).map((item) => ({ status: item.status, signatureCount: item.signatureCount })),
      actionItems: input.actionItems,
      now: input.now,
    });

    if (rfq.status === "error") { counts.openRequests = null; counts.quotesToReview = null; }
    if (missions.status === "error") { counts.activeMissions = null; counts.pendingDecisions = null; counts.upcomingDue = null; }

    const featured = pickFeaturedRequest(orgRequests);
    let comparisonSnapshot: QuoteComparison | null = null;
    if (featured?.rfqId) {
      const compared = await repo.comparison(featured.rfqId);
      comparisonSnapshot = compared.status === "success" ? compared.value : null;
    }
    const featuredProject: ClientFeaturedProject | null = featured
      ? {
          requestId: featured.id,
          title: featured.description,
          status: featured.status,
          createdAt: featured.createdAt,
          quoteCount: featured.quoteCount,
          href: `/${input.locale}/client/demandes/${featured.id}`,
          steps: clientJourneySteps(featured.status),
        }
      : null;
    const comparison: ClientHomeComparison | null = featured && comparisonSnapshot && comparisonSnapshot.rows.length > 0
      ? {
          requestId: featured.id,
          href: `/${input.locale}/client/demandes/${featured.id}`,
          description: featured.description,
          columns: comparisonSnapshot.rows.slice(0, 2).map((row, index) => ({
            quoteId: row.quoteId,
            label: index === 0 ? (input.locale === "ar" ? "العرض أ" : "Offre A") : (input.locale === "ar" ? "العرض ب" : "Offre B"),
            durationDays: row.durationDays,
            deliverablesCount: row.deliverablesCount,
            totalMinor: row.totalMinor,
            currency: row.currency,
            priceRank: row.priceRank,
          })),
        }
      : null;

    return {
      status: "success",
      stage: resolveClientHomeStage({
        hasOrganization: true,
        openRequests: counts.openRequests,
        activeMissions: counts.activeMissions,
        isTeamLead: input.isTeamLead,
      }),
      counts,
      lastRequestId: featured?.id ?? orgRequests[0]?.id ?? null,
      organizationName: missionDashboard?.organizationName ?? null,
      ...(partialSources.length ? { partialSources } : {}),
      featuredProject,
      comparison,
      insights: toClientHomeInsights({
        actionItems: input.actionItems,
        milestones: (missionDashboard?.missions ?? []).flatMap((mission) => mission.milestones),
        now: input.now,
      }),
    };
  } catch {
    return { status: "error", reason: "UNAVAILABLE", counts: emptyUnavailable, insights: emptyInsights };
  }
}

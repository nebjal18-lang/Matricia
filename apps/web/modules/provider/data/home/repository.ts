import {capacitySummaryStatus} from "@/modules/provider/data/qualification/capacity-summary";
import {interventionModeLabel} from "@/modules/provider/data/qualification/intervention-modes";
import { moroccoRegionLabel } from "@/modules/shared/lib/geo/morocco-regions";
import { loadProviderQuotes } from "@/modules/provider/data/quotes/repository";
import { loadProviderMissions } from "@/modules/provider/data/missions/repository";
import { loadProviderDashboard } from "@/modules/provider/data/qualification/repository";
import { loadProviderBilling } from "@/modules/provider/data/billing/repository";
import { loadProviderReputation } from "@/modules/provider/data/reputation/repository";
import { consultationRowsFromInvitations } from "@/modules/provider/data/spaces/list-rows";
import type { UserActionItem } from "@/modules/shared/lib/action-center/model";
import {
  buildProviderBlockers,
  computeProviderHomeCounts,
  resolveProviderHomeStage,
  type ProviderBlocker,
  type ProviderHomeCounts,
  type ProviderHomeStage,
} from "./view-model";

export type ProviderHomeSnapshot =
  | {
      status: "success";
      stage: ProviderHomeStage;
      counts: ProviderHomeCounts;
      blockers: ProviderBlocker[];
      organizationName: string | null;
      organizationId: string | null;
      consultations: Array<{ id: string; title: string; status: string; href: string; tone: "sky" | "peach" | "mint" | "violet" }>;
      capacity: { status: string; domains: string; zones: string; modalities?:string };
      reputation: { published: number; latest: string | null };
    }
  | { status: "error"; reason: "UNAUTHENTICATED" | "UNAVAILABLE" | "NO_PROVIDER_ORGANIZATION"; counts: ProviderHomeCounts; blockers: ProviderBlocker[] };

const emptyUnavailable: ProviderHomeCounts = {
  consultationsDue: null,
  quotesInProgress: null,
  activeMissions: null,
  deliverablesDue: null,
  invoicesOutstanding: null,
};

export async function loadProviderHomeSnapshot(input: {
  organizationId: string | null;
  locale: "fr" | "ar";
  actionItems: readonly UserActionItem[];
  now: string;
}): Promise<ProviderHomeSnapshot> {
  try {
    const [quotes, qualification, missions, billing, reputation] = await Promise.all([
      loadProviderQuotes(input.organizationId ?? undefined),
      loadProviderDashboard(input.organizationId ?? undefined),
      loadProviderMissions(input.locale, input.organizationId ?? undefined),
      loadProviderBilling(input.organizationId ?? undefined),
      loadProviderReputation(input.organizationId ?? undefined),
    ]);

    if (quotes.status === "error" && quotes.reason === "UNAUTHENTICATED") {
      return { status: "error", reason: "UNAUTHENTICATED", counts: emptyUnavailable, blockers: [] };
    }
    if (quotes.status === "error" && quotes.reason === "NO_ORGANIZATION") {
      return { status: "error", reason: "NO_PROVIDER_ORGANIZATION", counts: emptyUnavailable, blockers: [] };
    }

    const quotesOk = quotes.status === "success";
    const qualOk = qualification.status === "success" && (!input.organizationId || qualification.dashboard.organizationId === input.organizationId);
    const missionsOk = missions.status === "success" && (!input.organizationId || missions.dashboard.organizationId === input.organizationId || (quotesOk && missions.dashboard.organizationId === quotes.dashboard.organizationId));
    const billingOk = billing.status === "success" && (!input.organizationId || billing.dashboard.organizationId === input.organizationId || (quotesOk && billing.dashboard.organizationId === quotes.dashboard.organizationId));

    if (!quotesOk && !qualOk) {
      return { status: "error", reason: "UNAVAILABLE", counts: emptyUnavailable, blockers: [] };
    }

    const orgId = quotesOk ? quotes.dashboard.organizationId : qualOk ? qualification.dashboard.organizationId : null;
    const orgName = quotesOk ? quotes.dashboard.organizationName : qualOk ? qualification.dashboard.organizationName : null;

    const counts = computeProviderHomeCounts({
      invitations: quotesOk ? quotes.dashboard.invitations.map((item) => ({ status: item.status, deadline: item.deadline, quote: item.quote ? { status: item.quote.status } : null })) : null,
      missions: missionsOk
        ? missions.dashboard.missions.map((mission) => ({
            status: mission.status,
            milestones: mission.milestones.map((item) => ({ status: item.status, dueAt: item.dueAt })),
            deliverables: mission.deliverables.map((item) => ({ status: item.status })),
          }))
        : null,
      invoices: billingOk
        ? billing.dashboard.invoices.map((item) => ({ paymentStatus: item.paymentStatus, outstandingMinor: item.outstandingMinor }))
        : null,
      actionItems: input.actionItems,
      now: input.now,
      snapshotUnavailable: !quotesOk && !missionsOk,
    });

    // If a slice failed, null those counters rather than inventing zeros from empty arrays
    const safeCounts: ProviderHomeCounts = {
      consultationsDue: quotesOk ? counts.consultationsDue : null,
      quotesInProgress: quotesOk ? counts.quotesInProgress : null,
      activeMissions: missionsOk ? counts.activeMissions : null,
      deliverablesDue: missionsOk ? counts.deliverablesDue : null,
      invoicesOutstanding: billingOk ? counts.invoicesOutstanding : null,
    };

    const services = qualOk
      ? qualification.dashboard.services.map((service) => ({
          label: input.locale === "ar" ? service.label.ar : service.label.fr,
          eligible: service.eligibility.eligible,
          reasons: service.eligibility.reasons,
          qualificationStatus: service.qualificationStatus,
        }))
      : [];

    const stage = resolveProviderHomeStage({
      profileOverallStatus: qualOk ? qualification.dashboard.profile?.overallStatus ?? null : null,
      hasServices: services.length > 0,
      blockedServices: services.filter((service) => !service.eligible).length,
      qualifiedServices: services.filter((service) => service.eligible).length,
    });

    const blockers = buildProviderBlockers({
      profileOverallStatus: qualOk ? qualification.dashboard.profile?.overallStatus ?? null : null,
      services,
      locale: input.locale,
    });

    const consultations = quotesOk
      ? consultationRowsFromInvitations(quotes.dashboard.invitations, input.locale, input.organizationId ? `?organizationId=${encodeURIComponent(input.organizationId)}` : "").slice(0, 4).map((row) => ({
          id: row.id,
          title: row.title,
          status: row.status,
          href: row.href,
          tone: row.tone,
        }))
      : [];
    const capacityServices = qualOk ? qualification.dashboard.services : [];
    const capacity = {
      status: capacitySummaryStatus(capacityServices),
      modalities:qualOk?qualification.dashboard.interventionModes?.map(mode=>interventionModeLabel(mode,input.locale)).join(" · ")||"—":"—",
      domains: [...new Set(capacityServices.map((service) => input.locale === "ar" ? service.libraryLabel.ar : service.libraryLabel.fr))].filter(Boolean).join(" · ") || "—",
      zones: qualOk ? qualification.dashboard.regionCodes?.map((code) => moroccoRegionLabel(code, input.locale)).join(" · ") || "—" : "—",
    };
    const publishedFeedback = reputation.status === "success" ? reputation.dashboard.feedback : [];
    const latestFeedback = publishedFeedback[0];
    const reputationPreview = {
      published: publishedFeedback.length,
      latest: latestFeedback
        ? (input.locale === "ar" ? (latestFeedback.axes[0]?.messageAr ?? null) : (latestFeedback.axes[0]?.messageFr ?? null))
        : null,
    };

    return {
      status: "success",
      stage,
      counts: safeCounts,
      blockers,
      organizationName: orgName,
      organizationId: orgId,
      consultations,
      capacity,
      reputation: reputationPreview,
    };
  } catch {
    return { status: "error", reason: "UNAVAILABLE", counts: emptyUnavailable, blockers: [] };
  }
}

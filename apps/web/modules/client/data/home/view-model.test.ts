import { describe, expect, it } from "vitest";
import {
  clientJourneySteps,
  computeClientHomeCounts,
  filterClientFacingActions,
  inferClientSituation,
  pickFeaturedRequest,
  proposedActionLabel,
  resolveClientHomeStage,
  toClientHomeInsights,
  toClientPriorityRows,
} from "./view-model";

type Item = {
  id: string;
  kind: "NOTIFICATION" | "MESSAGE" | "APPROVAL" | "EXCEPTION" | "RISK_REVIEW" | "WORK_ITEM";
  title: string;
  detail: string;
  organizationName: string | null;
  organizationId: string | null;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  mandatory: boolean;
  href: string;
  occurredAt: string;
  dueAt: string | null;
  requiresHumanReview: boolean;
};

const base: Item = {
  id: "1",
  kind: "NOTIFICATION",
  title: "Devis reçus",
  detail: "2 offres",
  organizationName: "Acme",
  organizationId: "11111111-1111-4111-8111-111111111111",
  priority: "HIGH",
  mandatory: false,
  href: "/fr/client/demandes/aaaa",
  occurredAt: "2026-09-16T08:00:00Z",
  dueAt: "2026-09-17T12:00:00Z",
  requiresHumanReview: false,
};

describe("client-home view-model", () => {
  it("n’invente pas de zéro lorsque le snapshot est indisponible", () => {
    const counts = computeClientHomeCounts({ actionItems: [], now: "2026-09-16T10:00:00Z", snapshotUnavailable: true });
    expect(counts.openRequests).toBeNull();
    expect(counts.quotesToReview).toBeNull();
  });

  it("agrège demandes, devis et missions réels", () => {
    const counts = computeClientHomeCounts({
      now: "2026-09-16T10:00:00Z",
      actionItems: [{ ...base, requiresHumanReview: true, kind: "APPROVAL" }],
      requests: [
        { status: "RFQ_OPEN", quoteCount: 2 },
        { status: "CLOSED", quoteCount: 0 },
      ],
      missions: [
        {
          status: "ACTIVE",
          milestones: [{ status: "OPEN", dueAt: "2026-09-18T00:00:00Z" }],
          deliverables: [{ status: "SUBMITTED" }],
        },
      ],
      contracts: [{ status: "PENDING_SIGNATURE", signatureCount: 0 }],
    });
    expect(counts.openRequests).toBe(1);
    expect(counts.quotesToReview).toBe(2);
    expect(counts.activeMissions).toBe(1);
    expect(counts.pendingDecisions).toBeGreaterThanOrEqual(2);
  });

  it("détecte les situations et filtre le pilotage Admin hors plateforme", () => {
    expect(inferClientSituation(base)).toBe("QUOTES");
    expect(proposedActionLabel("QUOTES", "fr")).toContain("Comparer");
    const rows = toClientPriorityRows([base], "fr", "?organizationId=11111111-1111-4111-8111-111111111111");
    expect(rows[0]?.href).toContain("organizationId=");
    expect(rows[0]?.title).toContain("Comparer");
    expect(rows[0]?.dossier).toBe("2 offres");
    expect(rows[0]?.cta).toBe("Comparer");
    const adminItem = { ...base, id: "2", href: "/fr/administration/command-center" };
    expect(filterClientFacingActions([base, adminItem], false)).toHaveLength(1);
    expect(filterClientFacingActions([base, adminItem], true)).toHaveLength(2);
  });

  it("choisit le mode d’accueil", () => {
    expect(resolveClientHomeStage({ hasOrganization: true, openRequests: 0, activeMissions: 0, isTeamLead: false })).toBe("new");
    expect(resolveClientHomeStage({ hasOrganization: true, openRequests: 2, activeMissions: 0, isTeamLead: false })).toBe("active");
    expect(resolveClientHomeStage({ hasOrganization: true, openRequests: 1, activeMissions: 1, isTeamLead: true })).toBe("team");
  });

  it("sélectionne le projet à devis et calcule le parcours sans inventer d’étape", () => {
    const featured = pickFeaturedRequest([
      { status: "DRAFT", quoteCount: 0 },
      { status: "QUOTES_RECEIVED", quoteCount: 2 },
    ]);
    expect(featured?.status).toBe("QUOTES_RECEIVED");
    expect(clientJourneySteps("QUOTES_RECEIVED")).toEqual([
      { id: "need", current: false, done: true },
      { id: "consultation", current: false, done: true },
      { id: "quotes", current: true, done: false },
      { id: "contract", current: false, done: false },
      { id: "mission", current: false, done: false },
      { id: "delivery", current: false, done: false },
    ]);
  });

  it("ne transforme pas une demande terminée ou inconnue en projet courant", () => {
    expect(pickFeaturedRequest([{status:"CANCELLED",quoteCount:2},{status:"EXPIRED",quoteCount:1},{status:"COMPLETED",quoteCount:3},{status:"UNKNOWN",quoteCount:0}])).toBeNull();
  });

  it("expose les insights réels et reste nul si le snapshot manque", () => {
    expect(toClientHomeInsights({ actionItems: [], milestones: [], now: "2026-09-16T10:00:00Z", snapshotUnavailable: true }).documentsToReview).toBeNull();
    const insights = toClientHomeInsights({
      now: "2026-09-16T10:00:00Z",
      actionItems: [
        { ...base, id: "d", title: "Document à relire", href: "/fr/client/documents" },
        { ...base, id: "m", kind: "MESSAGE", title: "Message client", href: "/fr/messagerie" },
      ],
      milestones: [{ title: "Choisir un prestataire", status: "OPEN", dueAt: "2026-09-20T00:00:00Z" }],
    });
    expect(insights.documentsToReview).toBe(1);
    expect(insights.messagesToHandle).toBe(1);
    expect(insights.nextMilestoneTitle).toBe("Choisir un prestataire");
  });
});

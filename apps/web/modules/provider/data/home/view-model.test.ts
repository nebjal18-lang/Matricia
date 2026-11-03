import { describe, expect, it } from "vitest";
import {
  buildProviderBlockers,
  computeProviderHomeCounts,
  filterProviderFacingActions,
  inferProviderSituation,
  proposedProviderAction,
  resolveProviderHomeStage,
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
  title: "Consultation reçue",
  detail: "RFQ",
  organizationName: "Studio",
  organizationId: "11111111-1111-4111-8111-111111111111",
  priority: "HIGH",
  mandatory: false,
  href: "/fr/sous-traitant/devis",
  occurredAt: "2026-09-16T08:00:00Z",
  dueAt: "2026-09-17T12:00:00Z",
  requiresHumanReview: false,
};

describe("provider-home view-model", () => {
  it("does not count accepted milestones or obligations of completed missions as due",()=>{
    const counts=computeProviderHomeCounts({now:"2026-11-02T00:00:00Z",actionItems:[],missions:[{status:"IN_PROGRESS",milestones:[{status:"ACCEPTED",dueAt:"2026-11-01T00:00:00Z"}],deliverables:[]},{status:"COMPLETED",milestones:[{status:"PENDING",dueAt:"2026-11-01T00:00:00Z"}],deliverables:[{status:"PENDING"}]}]});
    expect(counts.deliverablesDue).toBe(0);expect(counts.activeMissions).toBe(1);
  });
  it("n’invente pas de zéro si le snapshot est indisponible", () => {
    const counts = computeProviderHomeCounts({ actionItems: [], now: "2026-09-16T10:00:00Z", snapshotUnavailable: true });
    expect(counts.consultationsDue).toBeNull();
    expect(counts.invoicesOutstanding).toBeNull();
  });

  it("agrège consultations, devis et missions", () => {
    const counts = computeProviderHomeCounts({
      now: "2026-09-16T10:00:00Z",
      actionItems: [],
      invitations: [
        { status: "INVITED", deadline: "2026-09-20T00:00:00Z", quote: null },
        { status: "ACCEPTED", deadline: "2026-09-21T00:00:00Z", quote: { status: "DRAFT" } },
        { status: "DECLINED", deadline: "2026-09-21T00:00:00Z", quote: null },
      ],
      missions: [{ status: "ACTIVE", milestones: [{ status: "OPEN", dueAt: "2026-09-18T00:00:00Z" }], deliverables: [{ status: "REJECTED" }] }],
      invoices: [{ paymentStatus: "OPEN", outstandingMinor: "1200" }, { paymentStatus: "PAID", outstandingMinor: "0" }],
    });
    expect(counts.consultationsDue).toBe(2);
    expect(counts.quotesInProgress).toBe(1);
    expect(counts.activeMissions).toBe(1);
    expect(counts.deliverablesDue).toBeGreaterThanOrEqual(2);
    expect(counts.invoicesOutstanding).toBe(1);
  });

  it("détecte stages, situations et filtre le hors périmètre", () => {
    expect(resolveProviderHomeStage({ profileOverallStatus: "PROFILE_INCOMPLETE", hasServices: false, blockedServices: 0, qualifiedServices: 0 })).toBe("new");
    expect(resolveProviderHomeStage({ profileOverallStatus: "APPROVED", hasServices: true, blockedServices: 0, qualifiedServices: 2 })).toBe("qualified");
    expect(resolveProviderHomeStage({ profileOverallStatus: "SUSPENDED", hasServices: true, blockedServices: 0, qualifiedServices: 1 })).toBe("blocked");
    expect(inferProviderSituation(base)).toBe("CONSULTATION");
    expect(proposedProviderAction("CONSULTATION", "fr")).toContain("Examiner");
    expect(filterProviderFacingActions([base, { ...base, id: "2", href: "/fr/client/demandes" }], false)).toHaveLength(1);
    const blockers = buildProviderBlockers({
      profileOverallStatus: null,
      services: [{ label: "Audit", eligible: false, reasons: ["QUALIFICATION_REJECTED"], qualificationStatus: "REJECTED" }],
      locale: "fr",
    });
    expect(blockers[0]?.scope).toBe("service");
    expect(blockers[0]?.serviceLabel).toBe("Audit");
  });
});

describe("signed scope reconciliation counts",()=>{it("keeps a pending scope workload unavailable instead of claiming zero",()=>{const counts=computeProviderHomeCounts({missions:[{status:"COMPLETED",scopeReconciliationRequired:true,milestones:[],deliverables:[]}],actionItems:[],now:"2026-11-02T12:00:00Z"});expect(counts.deliverablesDue).toBeNull();expect(counts.activeMissions).toBe(0)})});

 it("excludes retired obligations from the current workload without deleting history", () => {
   const counts = computeProviderHomeCounts({now:"2026-11-02T12:00:00Z",actionItems:[],missions:[{status:"IN_PROGRESS",deliverables:[{status:"PENDING",retirement:{operation:"REMOVE"}},{status:"CORRECTION_REQUIRED"}],milestones:[{status:"PENDING",dueAt:"2026-11-03T00:00:00Z",retired:true},{status:"PENDING",dueAt:"2026-11-03T00:00:00Z"}]}]});
   expect(counts.deliverablesDue).toBe(2);
 });

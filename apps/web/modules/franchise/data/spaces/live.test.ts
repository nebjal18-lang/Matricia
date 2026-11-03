import { describe, expect, it } from "vitest";
import { buildFranchiseSpaceBoard } from "./live";
import type { FranchiseCrmDashboard } from "@/modules/franchise/data/crm/model";
import type { FranchiseDashboard } from "@/modules/franchise/data/governance/model";

const crm: FranchiseCrmDashboard = {
  currentUserId: "11111111-1111-4111-8111-111111111111",
  canWrite: true,
  canRecordPerformance: false,
  franchises: [{
    id: "22222222-2222-4222-8222-222222222222",
    operatorCode: "HATIM_AHMITECH",
    type: "IT",
    canWrite: true,
    territory: { id: "33333333-3333-4333-8333-333333333333", code: "CASA", nameFr: "Casablanca-Settat", nameAr: "الدار البيضاء-سطات", version: 1 },
  }],
  prospects: [
    { id: "44444444-4444-4444-8444-444444444444", franchiseId: "22222222-2222-4222-8222-222222222222", territoryVersionId: "33333333-3333-4333-8333-333333333333", type: "PROVIDER", displayName: "Studio Atlas", contactEmail: "atlas@example.invalid", organizationName: "Studio Atlas", sourceCode: "NETWORK", stage: "VERIFIED", nextFollowupAt: null, rowVersion: 1, activities: [{ id: "1", type: "INVITATION", occurredAt: "2026-09-10T10:00:00.000Z", summary: "Invitation envoyée", evidenceRefs: [{ reference: "invite://atlas" }] }], pipelineEvents: [{ id: "2", from: "SENT", to: "VERIFIED", reasonCode: "ELIGIBILITY_CONFIRMED", occurredAt: "2026-09-12T10:00:00.000Z", evidenceRefs: [] }] },
    { id: "55555555-5555-4555-8555-555555555555", franchiseId: "22222222-2222-4222-8222-222222222222", territoryVersionId: "33333333-3333-4333-8333-333333333333", type: "CLIENT", displayName: "Conseil stratégique", contactEmail: "client@example.invalid", organizationName: "Conseil stratégique", sourceCode: "RFQ", stage: "RFQ_STARTED", nextFollowupAt: "2026-09-21T00:00:00.000Z", rowVersion: 1, activities: [{ id: "3", type: "NOTE", occurredAt: "2026-09-15T09:00:00.000Z", summary: "Besoin cadré", evidenceRefs: [{ reference: "rfq://conseil" }] }], pipelineEvents: [] },
  ],
  metrics: [],
  snapshots: [],
  alerts: [{
    id: "66666666-6666-4666-8666-666666666666",
    franchiseId: "22222222-2222-4222-8222-222222222222",
    snapshotId: "77777777-7777-4777-8777-777777777777",
    type: "QUALITY",
    severity: "WARNING",
    status: "OPEN",
    metricCode: "COVERAGE",
    explanationFr: "Couverture du réseau",
    explanationAr: "تغطية الشبكة",
    evidenceRefs: [],
    ruleVersion: "1",
  }],
  objectives: [{
    id: "88888888-8888-4888-8888-888888888888",
    franchiseId: "22222222-2222-4222-8222-222222222222",
    code: "COVERAGE",
    version: 1,
    titleFr: "Couverture du réseau",
    titleAr: "تغطية الشبكة",
    targetValue: "100",
    currentValue: "40",
    unitCode: "BPS",
    status: "ACTIVE",
    startsOn: "2026-01-01",
    dueOn: "2026-12-31",
    ruleVersion: "1",
  }],
};

const governance = {
  canApprove: false,
  canManageFinance: false,
  franchises: [],
  approvals: [],
  invitations: [],
  rules: [],
  books: [{
    id: "99999999-9999-4999-8999-999999999999",
    libraryId: "22222222-2222-4222-8222-222222222222",
    organizationId: "22222222-2222-4222-8222-222222222222",
    type: "STANDARD",
    operatorCode: "OP",
    currency: "MAD",
    ruleVersionId: "22222222-2222-4222-8222-222222222222",
    status: "OPEN",
    entryFee: null,
    latestClosure: null,
    closures: [{
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      version: 1,
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      supersedesClosureId: null,
      ruleVersionId: "22222222-2222-4222-8222-222222222222",
      cutoffAt: "2026-09-30T23:59:59.000Z",
      revenueMinor: "10000",
      costsMinor: "2000",
      profitMinor: "8000",
      contentHash: "a".repeat(64),
      closedAt: "2026-09-30T23:59:59.000Z",
      allocations: [
        { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", beneficiaryCode: "FRANCHISEE", shareBps: 5000, amountMinor: "4000", roundingAdjustmentMinor: 0 },
        { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", beneficiaryCode: "NEOXA_JALIL", shareBps: 2500, amountMinor: "2000", roundingAdjustmentMinor: 0 },
        { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", beneficiaryCode: "ASMA_MATRICIA", shareBps: 2500, amountMinor: "2000", roundingAdjustmentMinor: 0 },
      ],
    }],
    allocations: [],
    balances: [],
    ledgerEntries: [],
    entryFeeLedger: [],
  }],
} satisfies FranchiseDashboard;

describe("franchise space live board", () => {
  it("mappe le CRM du mandat sans répartition interne", () => {
    const board = buildFranchiseSpaceBoard({ locale: "fr", query: "", crm, libraryName: "Informatique", governance });
    expect(board.people.map((item) => item.name)).toContain("Studio Atlas");
    expect(board.requests.map((item) => item.title)).toContain("Conseil stratégique");
    expect(board.perimeter.territory).toBe("Casablanca-Settat");
    expect(board.quality[0]?.title).toBe("Couverture du réseau");
    expect(board.finance[0]?.object).toBe("Votre part");
    expect(board.finance[0]?.amount).toContain("40,00");
    expect(board.people[0]?.activities?.[0]?.evidence).toContain("invite://atlas");
    expect(board.requests[0]?.matching?.map((item) => item.name)).toContain("Studio Atlas");
    expect(board.documents.map((item) => item.title)).toEqual(expect.arrayContaining(["invite://atlas", "rfq://conseil"]));
    expect(board.messages).toEqual([]); // CRM activity is never presented as an actual conversation.
    expect(JSON.stringify(board)).not.toMatch(/50\s*%|Hatim Ahmitech|Jalil-NEOXA|NEOXA_JALIL|ASMA_MATRICIA/);
  });

  it("projette la supervision mandatée sans nom d’organisation prestataire", () => {
    const board = buildFranchiseSpaceBoard({
      locale: "fr",
      query: "",
      crm,
      libraryName: "Informatique",
      governance,
      volumeServices: [{ id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", title: "Sauvegarde", status: "PUBLISHED", href: "/fr/franchise/services/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" }],
      catalogRules: [{ id: "21212121-2121-4212-8212-212121212121", title: "HEALTH_SCORE_CRITICAL", status: "PUBLISHED", href: "/fr/franchise/regles/21212121-2121-4212-8212-212121212121", actions: [{ type: "CREATE_RISK", target: "COVERAGE_GAP" }] }],
      operations: {
        requests: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", status: "MATCHING", title: "IT_BACKUP", urgency: "HIGH" }],
        matching: [{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", eligible: true, scoreBps: 4200 }],
        quotes: [{ id: "ffffffff-ffff-4fff-8fff-ffffffffffff", requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", status: "SUBMITTED", totalMinor: "125000", currency: "MAD" }],
        missions: [{ id: "12121212-1212-4121-8121-121212121212", status: "IN_PROGRESS", startedAt: "2026-09-20T00:00:00.000Z" }],
        anomalies: [{ id: "99999999-9999-4999-8999-999999999999", titleFr: "Score critique", titleAr: "درجة حرجة", severity: "HIGH", status: "OPEN", code: "HEALTH_SCORE_IMPORTANT", blocking: false }],
        recommendations: [{ id: "13131313-1313-4131-8131-131313131313", titleFr: "Renforcer la couverture", titleAr: "تعزيز التغطية", priority: 1, serviceId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", serviceCode: "IT_BACKUP", solutionLevel: "MANAGED" }],
        opportunities: [{ id: "14141414-1414-4141-8141-141414141414", status: "OPEN", priority: 2, serviceId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", serviceCode: "IT_BACKUP", solutionLevel: "ASSISTED" }],
        qualifications: [{ id: "15151515-1515-4151-8151-151515151515", serviceId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", serviceCode: "IT_BACKUP", status: "APPROVED" }],
        capacities: [],
        documents: [{ id: "16161616-1616-4161-8161-161616161616", kind: "RC", code: "RC-01", status: "VALID" }],
        threads: [{ id: "17171717-1717-4171-8171-171717171717", subject: "Pièces du dossier", status: "OPEN" }],
        members: [{ id: "18181818-1818-4181-8181-181818181818", status: "ACTIVE", roles: ["FRANCHISE_MANAGER"] }],
        disputes: [{ id: "19191919-1919-4191-8191-191919191919", status: "WARNING_LEVEL_1", urgency: "URGENT", obligationKey: "SLA_RESPONSE" }],
        skus: [{ id: "20202020-2020-4202-8202-202020202020", code: "IT_BACKUP_SKU", status: "ACTIVE", serviceId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" }],
        anomalyDefinitions: [{ id: "21212121-aaaa-4aaa-8aaa-aaaaaaaaaaaa", titleFr: "Score critique défini", titleAr: "درجة حرجة معرفة", severity: "CRITICAL", status: "PUBLISHED" }],
        riskDefinitions: [{ id: "22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb", titleFr: "Couverture", titleAr: "تغطية", criticality: "HIGH", status: "PUBLISHED" }],
        recommendationDefinitions: [{ id: "23232323-cccc-4ccc-8ccc-cccccccccccc", titleFr: "Sauvegarde managée", titleAr: "نسخ مُدار", solutionLevel: "ADVANCED", serviceId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" }],
        volumeProposals: [{ id: "24242424-dddd-4ddd-8ddd-dddddddddddd", skuId: "20202020-2020-4202-8202-202020202020", status: "PROPOSED", paymentModel: "PAY_PER_USE" }],
      },
    });
    expect(board.requests.map((item) => item.title)).toContain("IT_BACKUP");
    expect(board.quotes[0]?.meta).toMatch(/1\D?250/);
    expect(board.quotes[0]?.meta).toContain("MAD");
    expect(board.missions[0]?.status).toBe("IN_PROGRESS");
    expect(board.anomalies[0]?.title).toBe("Score critique");
    expect(board.recommendations[0]?.status).toBe("MANAGED");
    expect(board.recommendations[0]?.meta).toContain("IT_BACKUP");
    expect(board.opportunities[0]?.status).toBe("ASSISTED");
    expect(board.volume.map((item) => item.title)).toEqual(expect.arrayContaining(["Sauvegarde", "IT_BACKUP_SKU"]));
    expect(board.users[0]?.title).toBe("FRANCHISE_MANAGER");
    expect(board.definitions.map((item) => item.title)).toEqual(expect.arrayContaining(["Score critique défini", "HEALTH_SCORE_CRITICAL"]));
    expect(board.risks.map((item) => item.title)).toEqual(expect.arrayContaining(["Couverture", "COVERAGE_GAP", "Score critique"]));
    expect(board.recommendations.map((item) => item.title)).toEqual(expect.arrayContaining(["Renforcer la couverture", "Sauvegarde managée"]));
    expect(board.volume.map((item) => item.status)).toEqual(expect.arrayContaining(["PROPOSED"]));
    expect(board.incidents[0]?.title).toBe("SLA_RESPONSE");
    expect(JSON.stringify(board)).not.toMatch(/Hatim Ahmitech|Jalil-NEOXA|50\s*%/);
  });

  it("reste vide hors démo lorsqu’aucune donnée n’est chargée", () => {
    const previous = process.env.MATRICIA_DEMO_ACCESS_ENABLED;
    delete process.env.MATRICIA_DEMO_ACCESS_ENABLED;
    const board = buildFranchiseSpaceBoard({ locale: "fr", query: "" });
    expect(board.people).toEqual([]);
    expect(board.requests).toEqual([]);
    expect(board.finance).toEqual([]);
    if (previous) process.env.MATRICIA_DEMO_ACCESS_ENABLED = previous;
  });
});

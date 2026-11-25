import { describe, expect, it } from "vitest";
import type { AdminGovernanceDashboard } from "@/modules/admin/data/governance-disputes/model";
import {
  isLegacyShiftedTerritoiresCells,
  normalizeTerritoiresRpcRow,
  presentAuthorizedTerritoiresRows,
  presentTerritoiresListTitle,
} from "./territoires-presentation";

const mandateId = "11111111-1111-4111-8111-111111111111";
const orgId = "22222222-2222-4222-8222-222222222222";
const franchiseId = "33333333-3333-4333-8333-333333333333";

describe("territoires-presentation", () => {
  it("detects the legacy 8-cell shift that put Fin into État", () => {
    expect(
      isLegacyShiftedTerritoiresCells(
        ["Informatique", "E2E_ZONE", "IT", "v1", "1", "2026-11-08", "2029-11-08", "ACTIVE"],
        "ACTIVE",
      ),
    ).toBe(true);
    expect(
      isLegacyShiftedTerritoiresCells(
        ["Franchisé · Casablanca-Settat", "Casablanca-Settat", "Informatique", "v1", "2026-11-08", "2029-11-08", "ACTIVE"],
        "ACTIVE",
      ),
    ).toBe(false);
  });

  it("humanizes raw operator · E2E titles", () => {
    expect(presentTerritoiresListTitle("FRANCHISEE · E2E_SOUSS_ZONE", "fr")).toBe("Franchisé · Souss Zone");
    expect(presentTerritoiresListTitle("HATIM_AHMITECH - CASABLANCA_SETTAT", "fr")).toBe("Hatim Ahmitech · Casablanca Settat");
  });

  it("repairs legacy RPC cells so État shows the mandate status", () => {
    const row = normalizeTerritoiresRpcRow("fr", "", {
      id: mandateId,
      href: "",
      title: "FRANCHISEE · E2E_SOUSS_ZONE",
      status: "ACTIVE",
      tone: "mint",
      organizationId: orgId,
      cells: ["Informatique", "E2E_SOUSS_ZONE", "IT", "v2", "2", "2026-11-08", "2029-11-08", "ACTIVE"],
    });
    expect(row.title).toBe("Franchisé · Souss Zone");
    expect(row.cells).toEqual([
      "Franchisé · Souss Zone",
      "Souss Zone",
      "Informatique",
      "v2",
      "2026-11-08",
      "2029-11-08",
      "ACTIVE",
    ]);
  });

  it("prefers governance presentation for authorized mandate ids", () => {
    const governance = {
      franchise: {
        franchises: [
          {
            id: franchiseId,
            libraryCode: "IT",
            libraryNameFr: "Informatique",
            libraryNameAr: "المعلوميات",
            organizationId: orgId,
            type: "IT" as const,
            operatorCode: "HATIM_AHMITECH",
            territoryCode: "CASABLANCA_SETTAT",
            status: "ACTIVE",
            rowVersion: 1,
            mandate: {
              id: mandateId,
              version: 1,
              status: "ACTIVE",
              entryFeeMinor: "0",
              entryFeeMode: "EXEMPT",
              franchiseeShareBps: 5000,
              neoxaShareBps: 5000,
              asmaShareBps: 0,
              effectiveFrom: "2026-01-01T00:00:00.000Z",
            },
            territoryVersions: [{ id: "t1", version: 1, code: "CASABLANCA_SETTAT", name: "Casablanca-Settat", effectiveFrom: "2026-01-01", effectiveUntil: null, contentHash: "a".repeat(64) }],
            mandateVersions: [
              {
                id: mandateId,
                territoryVersionId: "t1",
                economicRuleVersionId: "r1",
                version: 1,
                status: "ACTIVE",
                entryFeeMinor: "0",
                entryFeeMode: "EXEMPT",
                franchiseeShareBps: 5000,
                neoxaShareBps: 5000,
                asmaShareBps: 0,
                effectiveFrom: "2026-01-01T00:00:00.000Z",
                effectiveUntil: "2029-11-08T00:00:00.000Z",
                contentHash: "b".repeat(64),
              },
            ],
          },
        ],
      },
    } as AdminGovernanceDashboard;

    const rows = presentAuthorizedTerritoiresRows(
      "fr",
      "",
      [
        {
          id: mandateId,
          href: "",
          title: "HATIM_AHMITECH · CASABLANCA_SETTAT",
          status: "ACTIVE",
          tone: "mint",
          organizationId: orgId,
          cells: ["Informatique", "CASABLANCA_SETTAT", "IT", "v1", "1", "2026-01-01", "2029-11-08", "ACTIVE"],
        },
      ],
      governance,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe("Hatim Ahmitech · Casablanca-Settat");
    expect(rows[0]?.cells[6]).toBe("ACTIVE");
    expect(rows[0]?.cells[5]).toBe("2029-11-08");
  });
});

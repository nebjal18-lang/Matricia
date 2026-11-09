import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getMissionMessages } from "@/modules/client/screens/missions/messages";
import type { ContractMissionDashboard } from "@/modules/shared/lib/contracts-missions/model";
import { JalonsBoard } from "./milestones-board";

const id = "33333333-3333-4333-8333-333333333333";

function mission(overrides: { signatures?: number; criteria?: number } = {}): ContractMissionDashboard["missions"][number] {
  return {
    id,
    contractId: id,
    contractVersionId: id,
    status: "ACTIVE",
    startedAt: "2026-09-21T00:00:00.000Z",
    completedAt: null,
    contractSnapshot: {
      versionId: id,
      version: 1,
      selectedQuoteVersionId: id,
      priceMinor: "1200000",
      currency: "MAD",
      contentHash: "a".repeat(64),
      changeReason: "Démonstration",
      createdAt: "2026-09-21T00:00:00.000Z",
      items: [],
      signatures: Array.from({ length: overrides.signatures ?? 0 }, () => ({ party: "CLIENT", signedAt: "2026-09-21T00:00:00.000Z" })),
    },
    milestones: [{ id, key: "DELIVERY", title: "Livraison", status: "PENDING", dueAt: null, rowVersion: 1 }],
    deliverables: [{
      id,
      key: "DEMO",
      label: "Livrable de démonstration",
      status: "SUBMITTED",
      currentVersion: 1,
      proofScanStatus: "NONE",
      criteria: Array.from({ length: overrides.criteria ?? 0 }, () => ({ key: "SCOPE_MATCH", label: "Périmètre", status: "PENDING" })),
    }],
  } as ContractMissionDashboard["missions"][number];
}

describe("jalon receipt truth", () => {
  it("does not call a contract signed when no signature is recorded", () => {
    const html = renderToStaticMarkup(<JalonsBoard locale="fr" query="" organizationName="Client" mission={mission()} messages={getMissionMessages("fr")} />);
    expect(html).toContain("Signature non enregistrée");
    expect(html).not.toContain("Contrat signé");
    expect(html).toContain("1 sur 1 livrables soumis");
    expect(html).toContain("Aucune preuve");
    expect(html).toContain("aucun critère d’acceptation");
  });

  it("keeps the signed chip when a signature exists", () => {
    const html = renderToStaticMarkup(<JalonsBoard locale="fr" query="" organizationName="Client" mission={mission({ signatures: 1 })} messages={getMissionMessages("fr")} />);
    expect(html).toContain("Contrat signé");
  });
});

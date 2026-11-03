import { describe, expect, it } from "vitest";
import type { EvolutionDashboard } from "@/modules/shared/lib/diagnostics-evolution/model";
import {
  clientHref,
  formatDimensionKey,
  labelSolutionLevel,
  latestEvolutionHighlights,
  opportunityRequestHref,
} from "./journey";

describe("diagnostic journey helpers", () => {
  it("keeps GUIDANCE/ASSISTED/MANAGED distinct from Essential/Standard/Advanced", () => {
    expect(labelSolutionLevel("fr", "GUIDANCE")).toBe("Conseil");
    expect(labelSolutionLevel("fr", "ASSISTED")).toBe("Accompagné");
    expect(labelSolutionLevel("fr", "MANAGED")).toBe("Piloté");
    expect(labelSolutionLevel("ar", "MANAGED")).toBe("تسيير");
    expect(labelSolutionLevel("fr", "ESSENTIAL")).toBe("Niveau non renseigné");
    expect(labelSolutionLevel("ar",null)).toBe("المستوى غير محدد");
  });

  it("builds exact query strings without inventing scores", () => {
    expect(clientHref("/fr/client/diagnostics", "", { anomalyId: "a1" })).toBe("/fr/client/diagnostics?anomalyId=a1");
    expect(clientHref("/fr/client/demandes/nouvelle", "?organizationId=org-1", { opportunityId: "o1" })).toBe(
      "/fr/client/demandes/nouvelle?organizationId=org-1&opportunityId=o1",
    );
    expect(opportunityRequestHref("fr", "o1", "")).toBe("/fr/client/demandes/nouvelle?opportunityId=o1");
    expect(formatDimensionKey("BACKUP_COVERAGE")).toBe("BACKUP COVERAGE");
  });

  it("surfaces the current evolution point per library with signed integer deltas", () => {
    const dashboard: EvolutionDashboard = {
      truncated: false,
      series: [{
        libraryId: "lib-1",
        libraryCode: "IT",
        points: [
          {
            id: "run-old",
            libraryId: "lib-1",
            libraryCode: "IT",
            score: "70.00",
            scoreHundredths: 7000,
            deltaHundredths: null,
            rating: "ATTENTION",
            status: "SUPERSEDED",
            completedAt: "2026-08-01T00:00:00.000Z",
            openAnomalies: 2,
            criticalAnomalies: 0,
          },
          {
            id: "run-now",
            libraryId: "lib-1",
            libraryCode: "IT",
            score: "72.00",
            scoreHundredths: 7200,
            deltaHundredths: 200,
            rating: "ATTENTION",
            status: "COMPLETED",
            completedAt: "2026-09-01T00:00:00.000Z",
            openAnomalies: 1,
            criticalAnomalies: 0,
          },
        ],
      }],
    };
    expect(latestEvolutionHighlights(dashboard, "fr", "?organizationId=org-1")).toEqual([{
      libraryCode: "IT",
      score: "72.00",
      delta: "+2.00",
      href: "/fr/client/diagnostics/run-now?organizationId=org-1",
    }]);
  });
});

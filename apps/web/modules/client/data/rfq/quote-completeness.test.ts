import { describe, expect, it } from "vitest";
import { formatCompletenessBasisPoints, missingCompletenessLabels, quoteCompleteness } from "./quote-completeness";

describe("quote completeness", () => {
  it("score en points de base entiers et bloque un champ manquant", () => {
    const complete = quoteCompleteness({
      solution: "Audit du SI",
      deliverablesCount: 2,
      warranty: "Trois mois",
      corrections: "Une itération",
      startDate: "2026-10-01",
      durationDays: 14,
      validUntil: "2026-11-30T00:00:00.000Z",
      lineCount: 3,
    });
    expect(complete.basisPoints).toBe(10_000);
    expect(formatCompletenessBasisPoints(complete.basisPoints, "fr")).toBe("100 %");
    const incomplete = quoteCompleteness({
      solution: "Audit du SI",
      deliverablesCount: 0,
      warranty: "Trois mois",
      corrections: "Une itération",
      startDate: "2026-10-01",
      durationDays: 14,
      validUntil: "2026-11-30T00:00:00.000Z",
      lineCount: 3,
    });
    expect(incomplete.basisPoints).toBe(8_750);
    expect(incomplete.checks.find((item) => item.key === "deliverables")?.present).toBe(false);
    expect(missingCompletenessLabels(incomplete.checks, "fr")).toEqual(["livrables"]);
  });
  it("nomme l’absence de lignes tarifées qui laisse un devis à 87 %", () => {
    const quoted = quoteCompleteness({
      solution: "Audit du SI",
      deliverablesCount: 2,
      warranty: "Trois mois",
      corrections: "Une itération",
      startDate: "2026-10-01",
      durationDays: 21,
      validUntil: "2026-11-30T00:00:00.000Z",
      lineCount: 0,
    });
    expect(quoted.basisPoints).toBe(8_750);
    expect(missingCompletenessLabels(quoted.checks, "fr")).toEqual(["lignes tarifées"]);
    expect(missingCompletenessLabels(quoted.checks, "ar")).toEqual(["بنود السعر"]);
  });
});

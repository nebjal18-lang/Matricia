import { describe, expect, it } from "vitest";
import { formatDiagnosticProgress, localizeDiagnosticRating, localizeStatus } from "./view-model";

describe("localizeStatus", () => {
  it("localizes mandate and approval statuses used on territoires", () => {
    expect(localizeStatus("ACTIVE", "fr")).toBe("Active");
    expect(localizeStatus("PROPOSED", "fr")).toBe("Proposé");
    expect(localizeStatus("PROPOSED", "ar")).toBe("مقترح");
    expect(localizeStatus("PENDING_APPROVAL", "fr")).toBe("En attente");
  });

  it("localizes diagnostic queue statuses and ratings", () => {
    expect(localizeStatus("COMPLETED", "fr")).toBe("Terminé");
    expect(localizeStatus("SUPERSEDED", "fr")).toBe("Remplacé");
    expect(localizeStatus("IN_PROGRESS", "ar")).toBe("جارٍ");
    expect(localizeDiagnosticRating("IMPORTANT", "fr")).toBe("Priorité Importante");
    expect(formatDiagnosticProgress(45.25, "fr")).toEqual({ label: "45,25 %", percent: 45.25 });
  });
});

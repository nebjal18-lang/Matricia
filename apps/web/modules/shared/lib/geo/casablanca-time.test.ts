import { describe, expect, it } from "vitest";
import { casablancaIsoToLocal, casablancaLocalToIso } from "./casablanca-time";

describe("casablancaLocalToIso", () => {
  it("ajoute le décalage marocain à une date saisie en heure locale", () => {
    const iso = casablancaLocalToIso("2026-10-01T17:00");
    expect(iso).toMatch(/^2026-10-01T17:00:00[+-]\d{2}:\d{2}$/u);
    expect(new Date(iso!).getTime()).toBeLessThanOrEqual(Date.UTC(2026, 9, 1, 17, 0));
  });

  it("refuse les saisies invalides", () => {
    for (const value of ["", "2026-02-30T10:00", "2026-10-01T24:00", "01/10/2026 17:00", "2026-10-01"]) {
      expect(casablancaLocalToIso(value)).toBeNull();
    }
  });

  it("refuse les heures supprimées ou répétées lors des transitions marocaines", () => {
    expect(casablancaLocalToIso("2024-04-14T02:30")).toBeNull();
    expect(casablancaLocalToIso("2024-03-10T02:30")).toBeNull();
  });

  it("préremplit une échéance avec son heure marocaine sans décaler les éditions", () => {
    expect(casablancaIsoToLocal("2024-11-01T09:00:00.000Z")).toBe("2024-11-01T10:00");
    expect(casablancaIsoToLocal("2024-03-20T10:00:00.000Z")).toBe("2024-03-20T10:00");
    expect(casablancaIsoToLocal("2024-11-01T10:00")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { businessLocalToInstant, instantToBusinessLocal } from "./business-time";

describe("Morocco quote deadlines", () => {
  it("converts local winter time using the business zone, not the host zone", () => {
    expect(businessLocalToInstant("2026-11-02T18:00")).toBe("2026-11-02T17:00:00.000Z");
  });
  it("uses Morocco's Ramadan UTC offset", () => {
    expect(businessLocalToInstant("2026-03-05T18:00")).toBe("2026-03-05T18:00:00.000Z");
  });
  it("retains the instant when a persisted quote is revised", () => {
    for (const instant of ["2026-11-02T17:00:00.000Z", "2026-03-05T18:00:00.000Z"])
      expect(businessLocalToInstant(instantToBusinessLocal(instant))).toBe(instant);
  });
  it("rejects malformed or normalized invalid calendar dates", () => {
    for (const value of ["2026-02-30T18:00", "2026-11-02T28:00", "2026-11-02T18:00Z", ""]) expect(() => businessLocalToInstant(value)).toThrow();
  });
});

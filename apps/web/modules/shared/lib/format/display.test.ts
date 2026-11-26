import { describe, expect, it, vi } from "vitest";
import { casablancaTransitions, casablancaTzdbVersion } from "./display-casablanca-data";
import { formatDateTimeCasablanca, formatMinorAmount, shortReference } from "./display";

describe("display helpers", () => {
  it.each(["fr", "ar"] as const)("keeps bigint cents and currency scales exact in %s", locale => {
    const digits = (value: string) => value.replace(/[^0-9٠-٩]/g, "").replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632));
    for (const minor of ["9007199254740992", "9007199254740993", "9223372036854775807", "-9223372036854775808", "-1"]) {
      expect(digits(formatMinorAmount(minor, "MAD", locale))).toBe(minor.replace("-", "").padStart(3, "0"));
    }
    for (const [currency, minor, major] of [["JPY", 123, 123], ["KWD", 1234, 1.234], ["MAD", -1, -0.01], ["MAD", 0, 0]] as const) {
      expect(formatMinorAmount(minor, currency, locale)).toBe(new Intl.NumberFormat(`${locale}-MA`, { style: "currency", currency }).format(major));
    }
    expect(formatMinorAmount(9007199254740993n, "MAD", locale)).toBe(formatMinorAmount("9007199254740993", "MAD", locale));
    expect(formatMinorAmount("invalid", "MAD", locale)).toBe("invalid MAD");
    expect(() => formatMinorAmount(Number.MAX_SAFE_INTEGER + 1, "MAD", locale)).toThrow(RangeError);
    expect(() => formatMinorAmount(1.5, "MAD", locale)).toThrow(RangeError);
  });

  it.each([
    ["2025-03-01T23:30:00Z", "23:30"],
    ["2025-05-01T23:30:00Z", "00:30"],
    ["2026-03-01T23:30:00Z", "23:30"],
    ["2026-05-01T23:30:00Z", "00:30"],
    ["2026-02-15T01:59:00Z", "02:59"],
    ["2026-02-15T02:00:00Z", "02:00"],
    ["2026-03-22T01:59:00Z", "01:59"],
    ["2026-03-22T02:00:00Z", "03:00"],
    ["2026-09-20T00:59:00Z", "01:59"],
    ["2026-09-20T01:00:00Z", "01:00"],
    ["2026-11-14T22:24:00.548972+00:00", "22:24"],
    ["2027-03-01T23:30:00Z", "23:30"],
  ])("uses real Casablanca civil time at %s", (instant, time) => {
    expect(formatDateTimeCasablanca(instant, "fr")).toContain(time);
    expect(formatDateTimeCasablanca(instant, "ar")).toContain(time);
  });
  it("shortens long references without dumping full UUIDs", () => {
    expect(shortReference("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")).toBe("aaaaaaaa…eeee");
    expect(shortReference("COURT")).toBe("COURT");
  });

  it("formats Casablanca datetimes for FR and AR", () => {
    const value = "2026-09-15T10:30:00.000Z";
    expect(formatDateTimeCasablanca(value, "fr")).toMatch(/2026/);
    expect(formatDateTimeCasablanca(value, "ar")).toMatch(/2026|٢٠٢٦/);
  });

  it("keeps the same Casablanca wall clock on server and browser", () => {
    // tzdb 2026c introduced the September 2026 transition to UTC; 2025b is stale.
    expect(formatDateTimeCasablanca("2026-11-14T22:24:00.548972+00:00", "fr")).toBe("14 nov. 2026, 22:24");
    expect(formatDateTimeCasablanca("2026-11-14T23:30:00Z", "fr")).toBe("14 nov. 2026, 23:30");
    expect(formatDateTimeCasablanca("2026-09-19T23:30:00Z", "fr")).toBe("20 sept. 2026, 00:30");
  });

  it("pins the complete IANA transition table, including historical civil time", () => {
    expect(casablancaTzdbVersion).toBe("2026e");
    expect(casablancaTransitions).toHaveLength(72);
    expect(casablancaTransitions.at(-1)).toEqual([1789866000, 0]);
    expect(formatDateTimeCasablanca("1900-01-01T00:30:20Z", "fr")).toBe("1 jan. 1900, 00:00");
  });

  it("never depends on host ICU timezone or locale data for civil-time rendering", () => {
    const host = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => { throw new Error("Host ICU must not be used"); });
    try {
      expect(formatDateTimeCasablanca("2026-11-14T22:24:00.548972+00:00", "fr")).toBe("14 nov. 2026, 22:24");
      expect(formatDateTimeCasablanca("2026-11-14T22:24:00.548972+00:00", "ar")).toBe("14 نونبر 2026، 22:24");
      expect(formatDateTimeCasablanca("2026-03-22T02:00:00Z", "ar")).toBe("22 مارس 2026، 03:00");
    } finally { host.mockRestore(); }
  });

  it("formats minor amounts as MAD currency", () => {
    expect(formatMinorAmount(12550, "MAD", "fr")).toMatch(/125[,.]50/);
    expect(formatMinorAmount("9900", "MAD", "fr")).toMatch(/99[,.]00/);
  });
});

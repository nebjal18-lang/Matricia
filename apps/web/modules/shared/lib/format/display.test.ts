import { describe, expect, it } from "vitest";
import { formatDateTimeCasablanca, formatMinorAmount, shortReference } from "./display";

describe("display helpers", () => {
  it("shortens long references without dumping full UUIDs", () => {
    expect(shortReference("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")).toBe("aaaaaaaa…eeee");
    expect(shortReference("COURT")).toBe("COURT");
  });

  it("formats Casablanca datetimes for FR and AR", () => {
    const value = "2026-09-15T10:30:00.000Z";
    expect(formatDateTimeCasablanca(value, "fr")).toMatch(/2026/);
    expect(formatDateTimeCasablanca(value, "ar")).toMatch(/2026|٢٠٢٦/);
  });

  it("formats minor amounts as MAD currency", () => {
    expect(formatMinorAmount(12550, "MAD", "fr")).toMatch(/125[,.]50/);
    expect(formatMinorAmount("9900", "MAD", "fr")).toMatch(/99[,.]00/);
  });
});

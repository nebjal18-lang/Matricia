import { describe, expect, it } from "vitest";
import { directionFor, isLocale, normalizeLocale, supportedLocales } from "./locale";

describe("MAT-FUNC-059 FR/AR exhaustive locale contract", () => {
  it("exposes exactly the V1 bilingual locales", () => {
    expect(supportedLocales).toEqual(["fr", "ar"]);
  });

  it("normalizes unknown values to French and preserves Arabic", () => {
    expect(normalizeLocale(null)).toBe("fr");
    expect(normalizeLocale("en")).toBe("fr");
    expect(normalizeLocale("ar")).toBe("ar");
  });

  it("maps each locale to the correct document direction", () => {
    expect(directionFor("fr")).toBe("ltr");
    expect(directionFor("ar")).toBe("rtl");
  });

  it("rejects pseudo-locales outside the supported set", () => {
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("ar")).toBe(true);
    expect(isLocale("de")).toBe(false);
  });
});

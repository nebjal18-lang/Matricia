import { describe, expect, it } from "vitest";
import { csvCell, csvDocument } from "./export";

describe("safe CSV exports", () => {
  it.each(["=1+1", "+SUM(A1)", "-1+1", "@SUM(A1)", "\t=1+1", " \r=1+1", "\rtext"])("neutralizes spreadsheet prefix %j", (value) => {
    expect(csvCell(value)).toBe(`"'${value}"`);
  });
  it("preserves Unicode and RFC quoting without treating normal names as formulas", () => {
    expect(csvCell('Société "Atlas", المغرب')).toBe('"Société ""Atlas"", المغرب"');
    expect(csvCell(42)).toBe('"42"');
    expect(csvDocument([["nom", "valeur"], ["شركة", "line\nbreak"]])).toBe('\uFEFF"nom","valeur"\r\n"شركة","line\nbreak"\r\n');
  });
});

import { describe, expect, it } from "vitest";
import { adminPillCode, filterAdminRows } from "./filters";
import type { SpaceRow } from "./space-data";
const rows: SpaceRow[] = [
  { id: "a", title: "Atlas", href: "/a", cells: [], status: "APPROVED", tone: "mint" },
  { id: "b", title: "Rif", href: "/b", cells: [], status: "REJECTED", tone: "peach" },
];
describe("administrative filters", () => {
  it("uses the same canonical qualification status in every language", () => {
    expect(adminPillCode("qualification", 4)).toBe("APPROVED");
    expect(filterAdminRows(rows, "qualification", adminPillCode("qualification", 4)).map((row) => row.id)).toEqual(["a"]);
  });
  it("combines search and status without interpreting a translated label as data", () => {
    expect(filterAdminRows(rows, "qualification", "APPROVED", "Rif")).toEqual([]);
    expect(filterAdminRows(rows, "qualification", "", "Atlas")).toEqual([rows[0]]);
  });
});

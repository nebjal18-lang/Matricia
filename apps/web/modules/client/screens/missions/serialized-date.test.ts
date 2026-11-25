import { describe, expect, it, vi } from "vitest";
import { serializedDateLabel } from "./serialized-date";
describe("server serialized contractual dates",()=>{
 it("does not recalculate the label using browser ICU",()=>{const formatter=vi.spyOn(Intl,"DateTimeFormat").mockImplementation(()=>{throw new Error("different browser tzdata");});try{expect(serializedDateLabel("2026-10-31T22:56:00Z","31 oct. 2026, 23:56")).toBe("31 oct. 2026, 23:56");}finally{formatter.mockRestore();}});
 it("localizes the fallback for Casablanca instead of dumping ISO",()=>{
  expect(serializedDateLabel("2026-10-31T22:56:00Z")).toMatch(/2026/);
  expect(serializedDateLabel("2026-10-31T22:56:00Z")).not.toContain("T22:56");
  expect(serializedDateLabel("2026-10-31T22:56:00Z","", "ar")).toMatch(/\d/);
 });
});

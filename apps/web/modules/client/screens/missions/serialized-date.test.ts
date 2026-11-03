import { describe, expect, it, vi } from "vitest";
import { serializedDateLabel } from "./serialized-date";
describe("server serialized contractual dates",()=>{
 it("does not recalculate the label using browser ICU",()=>{const formatter=vi.spyOn(Intl,"DateTimeFormat").mockImplementation(()=>{throw new Error("different browser tzdata");});try{expect(serializedDateLabel("2026-10-31T22:56:00Z","31 oct. 2026, 23:56")).toBe("31 oct. 2026, 23:56");}finally{formatter.mockRestore();}});
 it("has a timezone independent UTC fallback for old snapshots",()=>{expect(serializedDateLabel("2026-10-31T22:56:00")).toBe("2026-10-31 22:56 UTC");expect(serializedDateLabel("2026-10-31T23:56:00+01:00")).toBe("2026-10-31 22:56 UTC");});
});

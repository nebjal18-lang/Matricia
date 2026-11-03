import{describe,it,expect}from"vitest";
import{parseBenefitSchedule}from"./time";
describe("benefit schedule in Morocco",()=>{
 it("converts an actual Moroccan appointment to the correct instant",()=>{expect(parseBenefitSchedule("2026-11-01T10:00")).toBe("2026-11-01T10:00:00+01:00");});
 it("refuses malformed dates and nonexistent or ambiguous clock times",()=>{for(const value of["2026-02-30T10:00","2026-11-01T24:00","2026-03-22T02:30","2026-02-15T02:30"])expect(parseBenefitSchedule(value)).toBeNull();});
});

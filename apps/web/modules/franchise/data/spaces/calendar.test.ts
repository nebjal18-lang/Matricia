import{describe,it,expect}from"vitest";
import{renewalCalendarCounts,renewalCivilDate}from"./calendar";
describe("real renewal calendar",()=>{
 it("counts every dated deadline in actual business week/month across month boundary",()=>{expect(renewalCalendarCounts(["2026-10-26","2026-10-31","2026-10-31","2026-11-01","2026-11-30","2026-12-01","invalid"],new Date("2026-10-31T10:00:00Z"))).toMatchObject({weekCount:4,monthCount:3,nextCount:2});});
 it("converts timestamped contracts into Casablanca civil date, preserving date-only documents",()=>{expect(renewalCivilDate("2026-10-31T23:30:00Z")).toBe("2026-11-01");expect(renewalCivilDate("2026-10-31")).toBe("2026-10-31");});
});

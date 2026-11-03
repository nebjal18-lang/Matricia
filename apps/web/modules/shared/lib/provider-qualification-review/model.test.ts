import { describe,expect,it } from "vitest";
import { humanQualificationScoreBps } from "./model";
describe("human qualification score distinct from engine evidence",()=>{
 it("retains exact percentage decimals and zero",()=>{
  expect(humanQualificationScoreBps("80,81")).toBe(8081);
  expect(humanQualificationScoreBps("0")).toBe(0);
  expect(humanQualificationScoreBps("100.00")).toBe(10000);
 });
 it.each(["","1e2","100.01","-1","NaN","0.001"])("refuses invalid score %s",value=>expect(humanQualificationScoreBps(value)).toBeNull());
});

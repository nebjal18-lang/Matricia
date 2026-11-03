import { describe,expect,it } from "vitest";
import { newRuleAction,ruleListValues } from "./rule-values";
describe("visual rule operand contract",()=>{
 it("persists the score and validity defaults shown by controls",()=>{
  expect(newRuleAction("SCORE",undefined)).toEqual({type:"SCORE",dimension:"",delta_basis_points:0});
  expect(newRuleAction("SET_VALIDITY_DAYS",undefined)).toEqual({type:"SET_VALIDITY_DAYS",duration_days:1});
 });
 it("uses typed values for membership predicates",()=>{
  expect(ruleListValues("1, 2, 3","INTEGER")).toEqual([1,2,3]);
  expect(ruleListValues("1.5, 2.75","DECIMAL")).toEqual([1.5,2.75]);
  expect(ruleListValues("oui, false, نعم, لا","YES_NO")).toEqual([true,false,true,false]);
  expect(ruleListValues("01, 02","SHORT_TEXT")).toEqual(["01","02"]);
 });
});

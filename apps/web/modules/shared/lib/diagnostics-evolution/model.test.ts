import { describe, expect, it } from "vitest";
import { scoringPolicyKey, scoreToHundredths, summarizeLatestEvolution } from "./model";
describe("diagnostic comparability", () => {
  it("compares reordered policy snapshots consistently", () => { expect(scoringPolicyKey({ version: 2, dimensions: { a: 20, b: 80 } })).toBe(scoringPolicyKey({ dimensions: { b: 80, a: 20 }, version: 2 })); });
  it("keeps changed weights and array order distinct", () => { expect(scoringPolicyKey({ weights: [20, 80] })).not.toBe(scoringPolicyKey({ weights: [80, 20] })); expect(scoringPolicyKey({ version: 1 })).not.toBe(scoringPolicyKey({ version: 2 })); });
  it("preserves exact score differences", () => { expect(scoreToHundredths("72.31")-scoreToHundredths("72.30")).toBe(1); });
});

describe("latest comparable trajectory",()=>{
 it.each([[null,"INSUFFICIENT"],[100,"IMPROVING"],[0,"STABLE"],[-100,"DECLINING"]] as const)("classifies latest delta %s as %s",(delta,status)=>{expect(summarizeLatestEvolution([{points:[{deltaHundredths:delta}]}]).status).toBe(status);});
 it("counts one latest point per library and excludes old historical declines",()=>{const summary=summarizeLatestEvolution([{points:[{deltaHundredths:100},{deltaHundredths:-100},{deltaHundredths:-100}]},{points:[{deltaHundredths:0}]}]);expect(summary).toEqual({improved:1,declined:0,stable:1,status:"IMPROVING"});});
});

import { describe, expect, it } from "vitest";
import { parseFranchiseRulePayload } from "./rule-payload";
const a="11111111-1111-4111-8111-111111111111",b="22222222-2222-4222-8222-222222222222";
const payload={condition_ast:{group:"AND",conditions:[{operator:"EQ",question_version_id:a,value:true}]},actions:[{type:"HUMAN_REVIEW"}],dependency_graph:{},priority:100,sensitive:false};
describe("franchise rule version contract",()=>{
 it("preserves real grouped conditions and actions",()=>expect(parseFranchiseRulePayload(JSON.stringify(payload),new Set([a]))).toEqual(payload));
 it("rejects references to another library",()=>expect(parseFranchiseRulePayload(JSON.stringify(payload),new Set([b]))).toBeNull());
 it("requires action-only question targets to belong to the same allowed library",()=>{
  const value=JSON.stringify({...payload,actions:[{type:"HIDE",target:b}]});
  expect(parseFranchiseRulePayload(value,new Set([a]))).toBeNull();
  expect(parseFranchiseRulePayload(value,new Set([a,b]))).not.toBeNull();
 });
 it("requires action-specific score operands",()=>expect(parseFranchiseRulePayload(JSON.stringify({...payload,actions:[{type:"SCORE"}]}),new Set([a]))).toBeNull());
 it("rejects a dependency cycle before saving a draft",()=>expect(parseFranchiseRulePayload(JSON.stringify({...payload,dependency_graph:{[a]:[b],[b]:[a]}}),new Set([a,b]))).toBeNull());
 it("rejects unbounded nesting without recursively parsing it",()=>{
  let node:unknown={operator:"EQ",question_version_id:a,value:true};for(let i=0;i<100;i++)node={group:"AND",conditions:[node]};
  expect(parseFranchiseRulePayload(JSON.stringify({...payload,condition_ast:node}),new Set([a]))).toBeNull();
 });
});

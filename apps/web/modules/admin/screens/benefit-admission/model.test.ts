import {describe,expect,it} from "vitest";
import {benefitAdmissionError,contextSchema,policyProposalArgs,policySchema,utcPolicyDate} from "./model";
const uid=(n:number)=>String(n).padStart(8,"0")+"-0000-4000-8000-000000000000";
const context=contextSchema.parse({benefit_version_id:uid(1),name_fr:"TEST",name_ar:"اختبار",source_hash:"a".repeat(64),head_id:null,source:{quota:null,capacity_rule:{},eligibility_rule:{},fulfillment_mode:"MATRICIA_INTERNAL"},policies:[],page:1,total:0,has_next:false});
function form(){const f=new FormData();for(const[k,v]of Object.entries({quotaScope:"GLOBAL_VERSION",quotaUnits:"9007199254740993",capacityMode:"GLOBAL_CONCURRENT_UNITS",capacityUnits:"3",countries:"MA, FR,MA",from:"2026-11-01T10:30",until:"",reason:"TEST explicit quota and delegation",reference:"TEST_ONLY_APPROVAL",humanEvidence:"yes"}))f.set(k,v);return f;}
describe("typed benefit admission configuration",()=>{
 it("preserves exact bigint units and explicit quota scope rather than assuming a scope",()=>{
  const args=policyProposalArgs(context,form(),[uid(3),uid(2),uid(3)]);
  expect(args.p_quota_units).toBe("9007199254740993");expect(args.p_quota_scope).toBe("GLOBAL_VERSION");
  expect(args.p_allowed_country_codes).toEqual(["FR","MA"]);expect(args.p_required_box_version_ids).toEqual([uid(2),uid(3)]);
  expect(args.p_expected_source_hash).toBe(context.source_hash);expect(args.p_expected_head_id).toBeNull();
 });
 it("requires a quota choice and explicit human delegation",()=>{
  const f=form();f.set("quotaScope","");expect(()=>policyProposalArgs(context,f,[])).toThrow();
  f.set("quotaScope","NONE");f.set("quotaUnits","");f.delete("humanEvidence");expect(()=>policyProposalArgs(context,f,[])).toThrow("HUMAN_DELEGATION");
 });
 it("rejects ambiguous limit fields instead of silently ignoring them",()=>{
  const f=form();f.set("quotaScope","NONE");expect(()=>policyProposalArgs(context,f,[])).toThrow("CONTRADICTORY_QUOTA");
  f.set("quotaUnits","");f.set("capacityMode","UNLIMITED");expect(()=>policyProposalArgs(context,f,[])).toThrow("CONTRADICTORY_CAPACITY");
 });
 it("bounds units to actual PostgreSQL bigint and checks country and Box IDs",()=>{
  const f=form();f.set("quotaUnits","9223372036854775808");expect(()=>policyProposalArgs(context,f,[])).toThrow();
  f.set("quotaUnits","2");f.set("countries","Morocco");expect(()=>policyProposalArgs(context,f,[])).toThrow();
  f.set("countries","MA");expect(()=>policyProposalArgs(context,f,["foreign-value"])).toThrow();
 });
 it("interprets the labelled dates as UTC, including rejection of normalized impossible dates",()=>{
  expect(utcPolicyDate("2026-11-01T10:30")).toBe("2026-11-01T10:30:00.000Z");
  expect(()=>utcPolicyDate("2026-02-30T10:30")).toThrow();expect(()=>utcPolicyDate("2026-11-01T10:30+01:00")).toThrow();
 });
 it("refuses rounded numeric quota/capacity projections",()=>{
  expect(policySchema.safeParse({id:uid(2),version:1,content_hash:"a".repeat(64),quota_scope:"GLOBAL_VERSION",quota_units:9007199254740992,capacity_units:"2",allowed_country_codes:[],required_box_version_ids:[],effective_from:"2026-11-01",effective_until:null,reason:"TEST",reference:"TEST",fulfillment_evidence_kind:"HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1",decision:"APPROVE",can_review:false}).success).toBe(false);
 });
 it("reports unsupported rules and automation without promising a manual substitute",()=>{
  expect(benefitAdmissionError("BENEFIT_LEGACY_RULE_UNSUPPORTED","fr")).toContain("aucune règle n’est ignorée");
  expect(benefitAdmissionError("BENEFIT_AUTOMATION_NOT_CONFIGURED","ar")).toContain("الإثبات البشري لا يعوض");
 });
});

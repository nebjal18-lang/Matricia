import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminFinanceCostTargets } from "./repository";
const mocks=vi.hoisted(()=>({access:vi.fn(),rpc:vi.fn()}));
vi.mock("@/modules/shared/lib/account-security/platform-access",()=>({loadMyPlatformAccess:mocks.access,hasPlatformRole:(roles:Set<string>,allowed:readonly string[])=>allowed.some(role=>roles.has(role))}));
const id="11111111-1111-4111-8111-111111111111";
const data=()=>({targets:[{id,component:"PSP_FEE",label:"Encaissement société TEST · reçu approuvé"}],canUpload:true,page:1,page_size:20,has_more:false});
const authorized=(roles=["FINANCE_MANAGER"],satisfied=true)=>({status:"ok",client:{rpc:mocks.rpc},roles:new Set(roles),requirementSatisfied:satisfied,email:"finance@example.invalid",userId:id});
beforeEach(()=>{mocks.access.mockReset().mockResolvedValue(authorized());mocks.rpc.mockReset().mockResolvedValue({data:data(),error:null});});
describe("Admin Finance actual target page",()=>{
 it.each(["fr","ar"] as const)("loads only the bounded native projection with its locale and filters in %s",async locale=>{
  const source=data();source.page=2;mocks.rpc.mockResolvedValue({data:source,error:null});
  expect(await loadAdminFinanceCostTargets({locale,page:"2",search:"  reçu TEST  "})).toMatchObject({status:"success",value:{targets:source.targets,page:2,pageSize:20,search:"reçu TEST",hasMore:false}});
  expect(mocks.rpc).toHaveBeenCalledWith("list_finance_cost_reconciliation_targets_v1",{p_locale:locale,p_page:2,p_search:"reçu TEST"});
 });
 it.each(["UNAUTHENTICATED","QUERY_FAILED","INVALID_RESPONSE"] as const)("preserves access failure %s without business queries",async reason=>{
  mocks.access.mockResolvedValue({status:"error",reason});expect(await loadAdminFinanceCostTargets({locale:"fr"})).toEqual({status:"error",reason});expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("does not convert a missing Finance role into a second-factor request",async()=>{
  mocks.access.mockResolvedValue(authorized(["CLIENT_OWNER"],false));expect(await loadAdminFinanceCostTargets({locale:"ar"})).toEqual({status:"error",reason:"FORBIDDEN"});expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("requests MFA only after confirming an authorized read role",async()=>{
  mocks.access.mockResolvedValue(authorized(["FINANCE_MANAGER"],false));expect(await loadAdminFinanceCostTargets({locale:"fr"})).toEqual({status:"error",reason:"MFA_REQUIRED"});expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it.each([["42501","FINANCE_COST_MFA_REQUIRED","MFA_REQUIRED"],["42501","FINANCE_COST_DOCUMENT_READ_DENIED","FORBIDDEN"],["42501","FINANCE_COST_UNAUTHENTICATED","UNAUTHENTICATED"],["PGRST303","expired","UNAUTHENTICATED"],["08006","connection interrupted","QUERY_FAILED"],["PGRST202","missing migration","CONFIGURATION"]])("keeps backend %s/%s precise",async(code,message,reason)=>{
  mocks.rpc.mockResolvedValue({data:null,error:{code,message}});expect(await loadAdminFinanceCostTargets({locale:"fr"})).toEqual({status:"error",reason});
 });
 it("does not return an empty successful page after a transport rejection",async()=>{
  mocks.rpc.mockRejectedValue(new Error("internal address never shown"));expect(await loadAdminFinanceCostTargets({locale:"fr"})).toEqual({status:"error",reason:"QUERY_FAILED"});
 });
 it("preserves a real empty success and read-only capabilities",async()=>{
  mocks.access.mockResolvedValue(authorized(["READ_ONLY_AUDITOR"]));mocks.rpc.mockResolvedValue({data:{...data(),targets:[],canUpload:false},error:null});
  expect(await loadAdminFinanceCostTargets({locale:"ar"})).toMatchObject({status:"success",value:{targets:[],canUpload:false,hasMore:false}});
 });
 it("rejects an impossible elevated upload capability on an auditor response",async()=>{
  mocks.access.mockResolvedValue(authorized(["READ_ONLY_AUDITOR","FINANCE_MANAGER"]));expect(await loadAdminFinanceCostTargets({locale:"fr"})).toEqual({status:"error",reason:"INVALID_RESPONSE"});
 });
 it.each([{locale:"fr",page:0},{locale:"fr",page:10001},{locale:"fr",search:"a".repeat(101)},{locale:"ar",page:["1","2"]}])("validates request shape before calling the projection %j",async input=>{
  expect(await loadAdminFinanceCostTargets(input)).toEqual({status:"error",reason:"VALIDATION"});expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("does not accept a different page, a duplicate row or missing pagination metadata",async()=>{
  for(const source of [{...data(),page:2},{...data(),targets:[...data().targets,...data().targets]},{...data(),has_more:undefined},{...data(),has_more:true}]){
   mocks.rpc.mockResolvedValue({data:source,error:null});expect(await loadAdminFinanceCostTargets({locale:"fr"})).toEqual({status:"error",reason:"INVALID_RESPONSE"});
  }
 });
});

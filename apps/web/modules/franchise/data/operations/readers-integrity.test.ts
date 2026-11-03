import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({rows:new Map<string,unknown[]>(),auth:vi.fn(),rpc:vi.fn(),failPage:vi.fn(),queries:[] as Array<{table:string;from:number;to:number;matches:Record<string,unknown>}>}));
const org="a3621000-0000-4000-8000-000000000001",franchise="a3622000-0000-4000-8000-000000000001",user="a3620000-0000-4000-8000-000000000001";
function query(table:string){
 const matches:Record<string,unknown>={};
 const chain={
  select:()=>chain,order:()=>chain,
  match:(value:Record<string,unknown>)=>{Object.assign(matches,value);return chain;},
  eq:(key:string,value:unknown)=>{matches[key]=value;return chain;},
  range:async(from:number,to:number)=>{
   mocks.queries.push({table,from,to,matches});
   const error=mocks.failPage(table,from);
   if(error)return{data:null,error};
   const rows=(mocks.rows.get(table)??[]).filter(row=>Object.entries(matches).every(([key,value])=>typeof row==="object"&&row!==null&&(!(key in row)||(row as Record<string,unknown>)[key]===value)));
   return{data:rows.slice(from,to+1),error:null};
  },
 };
 return chain;
}
const client=()=>({auth:{getUser:mocks.auth},rpc:mocks.rpc,from:query});
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>client()}));
vi.mock("@/modules/shared/lib/account-security/platform-access",()=>({loadMyPlatformAccess:async()=>({status:"success",client:client(),userId:user,roles:new Set<string>(),requirementSatisfied:true})}));
import { loadFranchiseCrm } from "../crm/repository";
import { loadFranchiseFollowups } from "../followups/repository";
import { loadFranchiseDigest } from "../digest/repository";
import { loadFranchiseCorrectivePlans } from "../quality/repository";

beforeEach(()=>{
 vi.clearAllMocks();mocks.rows.clear();mocks.queries.length=0;mocks.failPage.mockReturnValue(null);
 mocks.auth.mockResolvedValue({data:{user:{id:user}},error:null});mocks.rpc.mockResolvedValue({data:{read:true,write:true},error:null});
 mocks.rows.set("franchises",[{id:franchise,operator_organization_id:org,franchise_type:"IT",operator_code:"HATIM_AHMITECH"}]);
});
describe("franchise complete readers and explicit incidents",()=>{
 it("loads a CRM prospect past the old 300-row cap and keeps native invitation distinct",async()=>{
  const prospects=Array.from({length:301},(_,index)=>({id:`a3624000-0000-4000-8000-${String(index).padStart(12,"0")}`,linked_organization_id:null,created_at:"2026-11-03T00:00:00Z",franchise_id:franchise,territory_version_id:franchise,prospect_type:"PROVIDER",display_name:`TEST ${index}`,contact_email:`test-${index}@example.invalid`,organization_name:null,source_code:"TEST",pipeline_stage:"SENT",next_followup_at:null,row_version:1}));
  mocks.rows.set("franchise_crm_prospects",prospects);
  mocks.rows.set("franchise_network_invitations",[{id:franchise,franchise_id:franchise,prospect_id:prospects[300]!.id,status:"QUEUED",delivery_mode:"NON_CONTRACTUAL_DEMO",expires_at:"2026-12-03T00:00:00Z",sent_at:null}]);
  const result=await loadFranchiseCrm(franchise);
  expect(result.status).toBe("success");if(result.status!=="success")throw Error(JSON.stringify(result));
  expect(result.dashboard.prospects).toHaveLength(301);
  expect(result.dashboard.prospects[0]?.invitation).toBeUndefined();
  expect(result.dashboard.prospects[300]?.invitation).toMatchObject({status:"QUEUED",deliveryMode:"NON_CONTRACTUAL_DEMO",sentAt:null});
  expect(mocks.queries.filter(q=>q.table==="franchise_crm_prospects").map(q=>[q.from,q.to])).toEqual([[0,99],[100,199],[200,299],[300,399]]);
  for(const table of["franchise_crm_activities","franchise_pipeline_events"])expect(mocks.queries.find(q=>q.table===table)?.matches).toEqual({franchise_id:franchise});
 });
 it("returns an explicit incident when a later CRM page fails",async()=>{
  mocks.rows.set("franchises",Array.from({length:100},()=>({id:franchise,operator_organization_id:org,franchise_type:"IT",operator_code:"HATIM_AHMITECH"})));
  mocks.failPage.mockImplementation((table,from)=>table==="franchises"&&from===100?{code:"08006"}:null);
  expect(await loadFranchiseCrm(franchise)).toEqual({status:"error",reason:"QUERY_FAILED"});
 });
 it.each([loadFranchiseFollowups,loadFranchiseDigest,loadFranchiseCorrectivePlans])("contains an Auth transport failure without requesting a login",async reader=>{
  mocks.auth.mockResolvedValue({data:{user:null},error:{status:503}});
  expect(await reader(franchise)).toEqual({status:"error",reason:"QUERY_FAILED"});expect(mocks.queries).toHaveLength(0);
  mocks.auth.mockResolvedValue({data:{user:null},error:{status:401}});
  expect(await reader(franchise)).toEqual({status:"error",reason:"UNAUTHENTICATED"});
  mocks.auth.mockRejectedValue(new Error("transport"));
  expect(await reader(franchise)).toEqual({status:"error",reason:"QUERY_FAILED"});
 });
 it("applies selected franchise before corrective plan pagination",async()=>{
  const other="a3622000-0000-4000-8000-000000000002";
  mocks.rows.set("franchise_corrective_plan_versions",[{id:franchise,franchise_id:franchise,plan_key:"TEST",version:1,status:"ACTIVE",due_on:"2026-11-20"},{id:other,franchise_id:other,plan_key:"FOREIGN_CONTEXT",version:1,status:"ACTIVE",due_on:"2026-11-20"}]);
  const result=await loadFranchiseCorrectivePlans(franchise);
  expect(result).toEqual({status:"success",plans:[{id:franchise,franchiseId:franchise,key:"TEST",version:1,status:"ACTIVE",dueOn:"2026-11-20"}]});
  expect(mocks.queries[0]?.matches).toEqual({franchise_id:franchise});
 });
});

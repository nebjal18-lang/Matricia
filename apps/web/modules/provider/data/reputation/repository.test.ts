import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({from:vi.fn(),getUser:vi.fn(),queries:[] as Array<{table:string;columns:string}>}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({from:mocks.from,auth:{getUser:mocks.getUser}}),getServerAuthUser:async()=>mocks.getUser()}));
import { loadClientFavorites, loadFavoriteProviderOptions } from "./repository";
import { maskedProviderReference } from "./model";
const org="11111111-1111-4111-8111-111111111111",request="22222222-2222-4222-8222-222222222222",service="33333333-3333-4333-8333-333333333333";
function query(table:string,data:unknown,error:unknown=null,failAfterFirstPage=false){
 let from=0,to=Number.MAX_SAFE_INTEGER;
 const q={select:vi.fn((columns:string)=>{mocks.queries.push({table,columns});return q}),eq:vi.fn(),is:vi.fn(),in:vi.fn(),not:vi.fn(),order:vi.fn(),limit:vi.fn(),range:vi.fn((start:number,end:number)=>{from=start;to=end;return q;}),then:(done:(r:unknown)=>unknown)=>Promise.resolve(failAfterFirstPage&&from>0?{data:null,error:{code:"503"}}:{data:Array.isArray(data)?data.slice(from,to+1):data,error}).then(done)};
 for(const f of [q.eq,q.is,q.in,q.not,q.order,q.limit])f.mockReturnValue(q);return q;
}
describe("client favorites database projection",()=>{
 beforeEach(()=>{mocks.queries=[];mocks.from.mockReset();mocks.getUser.mockResolvedValue({data:{user:{id:"actor"}},error:null});});
 function setup(fail=false,favorites:unknown[]=[],failAfterFirstPage=false){mocks.from.mockImplementation((table:string)=>query(table,table==="organization_memberships"?[{id:request,organization_id:org,organizations:{display_name:"Organisation de test"},organization_member_roles:[{role_code:"CLIENT_OWNER",revoked_at:null}]}]:table==="service_requests"?[{id:request,service_id:service,status:"SUBMITTED"}]:table==="catalog_services"?[{id:service,current_published_version_id:null}]:table==="client_provider_favorites"?favorites:[],fail&&table==="client_provider_favorites"?{code:"503"}:null,failAfterFirstPage&&table==="client_provider_favorites"));}
 const manyFavorites=()=>Array.from({length:501},(_,index)=>({id:`44444444-4444-4444-8444-${String(index).padStart(12,"0")}`,provider_organization_id:request,service_id:null,status:"ACTIVE",note:null,row_version:1,created_at:"2026-11-23T00:00:00Z"}));
 it("loads favorites beyond the old limit and a full database page",async()=>{setup(false,manyFavorites());const result=await loadClientFavorites(org);expect(result.status).toBe("success");if(result.status==="success")expect(result.dashboard.favorites).toHaveLength(501);});
 it("does not return a partial favorites list when a later page fails",async()=>{setup(false,manyFavorites(),true);expect(await loadClientFavorites(org)).toEqual({status:"error",reason:"QUERY_FAILED"});});
 it("accepts the actual service_requests schema without a fictitious request_number",async()=>{
  setup();const result=await loadClientFavorites(org);
  expect(result).toMatchObject({status:"success",dashboard:{organizationId:org,requests:[{id:request,reference:request,serviceId:service,status:"SUBMITTED"}]}});
  expect(mocks.queries).toContainEqual({table:"service_requests",columns:"id,service_id,status"});
 });
 it("keeps failed favorites distinct from an empty list",async()=>{setup(true);expect(await loadClientFavorites(org)).toEqual({status:"error",reason:"QUERY_FAILED"});});
 it("rejects a foreign organization before loading business data",async()=>{setup();expect(await loadClientFavorites(service)).toEqual({status:"error",reason:"FORBIDDEN_ORGANIZATION"});expect(mocks.queries.map(x=>x.table)).toEqual(["organization_memberships"]);});
 it("does not treat an auth outage as a missing session",async()=>{mocks.getUser.mockResolvedValue({data:{user:null},error:{name:"AuthRetryableFetchError",status:503}});expect(await loadClientFavorites(org)).toEqual({status:"error",reason:"QUERY_FAILED"});expect(mocks.from).not.toHaveBeenCalled();});
 it("keeps an authorized quoted provider selectable when RLS hides its organization name",async()=>{
  mocks.from.mockImplementation((table:string)=>query(table,table==="organization_memberships"?[{id:request,organization_id:org,organizations:{display_name:"Client"},organization_member_roles:[{role_code:"CLIENT_OWNER",revoked_at:null}]}]:table==="service_requests"?[{id:request,service_id:service}]:table==="rfqs"?[{id:org,request_id:request}]:table==="quotes"?[{provider_organization_id:request,rfq_id:org,status:"SELECTED"}]:table==="catalog_services"?[{id:service,current_published_version_id:null}]:[]));
  expect(await loadFavoriteProviderOptions(org)).toMatchObject({status:"success",options:[{organizationId:request,name:maskedProviderReference(request),services:[{id:service}]}]});
 });
});

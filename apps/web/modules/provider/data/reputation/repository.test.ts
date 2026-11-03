import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({from:vi.fn(),getUser:vi.fn(),queries:[] as Array<{table:string;columns:string}>}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({from:mocks.from,auth:{getUser:mocks.getUser}})}));
import { loadClientFavorites } from "./repository";
const org="11111111-1111-4111-8111-111111111111",request="22222222-2222-4222-8222-222222222222",service="33333333-3333-4333-8333-333333333333";
function query(table:string,data:unknown,error:unknown=null){const q={select:vi.fn((columns:string)=>{mocks.queries.push({table,columns});return q}),eq:vi.fn(),is:vi.fn(),in:vi.fn(),not:vi.fn(),order:vi.fn(),limit:vi.fn(),then:(done:(r:unknown)=>unknown)=>Promise.resolve({data,error}).then(done)};for(const f of [q.eq,q.is,q.in,q.not,q.order,q.limit])f.mockReturnValue(q);return q;}
describe("client favorites database projection",()=>{
 beforeEach(()=>{mocks.queries=[];mocks.from.mockReset();mocks.getUser.mockResolvedValue({data:{user:{id:"actor"}},error:null});});
 function setup(fail=false){mocks.from.mockImplementation((table:string)=>query(table,table==="organization_memberships"?[{id:request,organization_id:org,organizations:{display_name:"Organisation de test"},organization_member_roles:[{role_code:"CLIENT_OWNER",revoked_at:null}]}]:table==="service_requests"?[{id:request,service_id:service,status:"SUBMITTED"}]:table==="catalog_services"?[{id:service,current_published_version_id:null}]:[],fail&&table==="client_provider_favorites"?{code:"503"}:null));}
 it("accepts the actual service_requests schema without a fictitious request_number",async()=>{
  setup();const result=await loadClientFavorites(org);
  expect(result).toMatchObject({status:"success",dashboard:{organizationId:org,requests:[{id:request,reference:request,serviceId:service,status:"SUBMITTED"}]}});
  expect(mocks.queries).toContainEqual({table:"service_requests",columns:"id,service_id,status"});
 });
 it("keeps failed favorites distinct from an empty list",async()=>{setup(true);expect(await loadClientFavorites(org)).toEqual({status:"error",reason:"QUERY_FAILED"});});
 it("rejects a foreign organization before loading business data",async()=>{setup();expect(await loadClientFavorites(service)).toEqual({status:"error",reason:"FORBIDDEN_ORGANIZATION"});expect(mocks.queries.map(x=>x.table)).toEqual(["organization_memberships"]);});
 it("does not treat an auth outage as a missing session",async()=>{mocks.getUser.mockResolvedValue({data:{user:null},error:{name:"AuthRetryableFetchError",status:503}});expect(await loadClientFavorites(org)).toEqual({status:"error",reason:"QUERY_FAILED"});expect(mocks.from).not.toHaveBeenCalled();});
});

import{beforeEach,describe,expect,it,vi}from"vitest";
const mocks=vi.hoisted(()=>({rpc:vi.fn(),getUser:vi.fn(),request:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({auth:{getUser:mocks.getUser},rpc:mocks.rpc})}));
vi.mock("@/modules/admin/screens/command-center/actions",()=>({requestAdminAction:mocks.request}));
vi.mock("@/modules/admin/screens/spaces/environment",()=>({bindAdminDeployment:async(form:FormData)=>{form.set("targetEnvironment","DEVELOPMENT");return true;}}));
import{requestCanonicalIdentityRevision}from"./actions";
const id="11111111-1111-4111-8111-111111111111",hash="a".repeat(64);
const context={identity_hash:hash,snapshot:{organization:{id,row_version:2,legal_name:"TEST Client",country_code:"MA",status:"ACTIVE"},identifiers:{ICE:"000000000000001",IF:"12345678",RC:"TEST123"},identifier_verification:{ICE:"VERIFIED",IF:"VERIFIED",RC:"VERIFIED"},client_case:{id,status:"VERIFIED",row_version:3,profile_version:1,profile_hash:hash,legal_profile:{legal_form:"TEST SARL",registered_city:"Casablanca",registered_address:{line1:"TEST ancienne adresse",country_code:"MA"}}}}};
function form(overrides:Record<string,string>={}){const data=new FormData();for(const[k,v]of Object.entries({locale:"fr",organizationId:id,identityHash:hash,rowVersion:"2",idempotencyKey:id,legalName:"TEST Client",country:"MA",ice:"000000000000001",ifNumber:"87654321",rcNumber:"NEW-123",verifiedLegalForm:"TEST SAS",registeredCity:"Rabat",registeredAddress:"TEST nouvelle adresse",reason:"TEST new legal identity reviewed independently",identityConfirmed:"on",...overrides}))data.set(k,v);return data;}
beforeEach(()=>{mocks.rpc.mockReset().mockResolvedValue({data:context,error:null});mocks.getUser.mockResolvedValue({data:{user:{id}}});mocks.request.mockReset().mockResolvedValue({status:"success"});});
describe("canonical complete organization identity",()=>{
 it("requires explicit identity revision confirmation",async()=>{expect(await requestCanonicalIdentityRevision({status:"idle"},form({identityConfirmed:""}))).toEqual({status:"error",reason:"VALIDATION"});expect(mocks.request).not.toHaveBeenCalled();});
 it("does not rebase a stale legal profile onto a newly fetched snapshot",async()=>{expect(await requestCanonicalIdentityRevision({status:"idle"},form({identityHash:"b".repeat(64)}))).toEqual({status:"error",reason:"CONFLICT"});expect(mocks.request).not.toHaveBeenCalled();});
 it("persists real fiscal/profile fields in a two-approver typed command",async()=>{
  expect(await requestCanonicalIdentityRevision({status:"idle"},form())).toEqual({status:"success"});const submitted=mocks.request.mock.calls[0]?.[1]as FormData;
  expect(submitted.get("actionType")).toBe("MANUAL_EXCEPTION");expect(submitted.get("resourceId")).toBe(id);
  expect(JSON.parse(String(submitted.get("redactedSummary")))).toMatchObject({extendedIdentity:true,expectedIdentityHash:hash,ifNumber:"87654321",rcNumber:"NEW123",identityProfile:{legal_form:"TEST SAS",registered_city:"Rabat",registered_address:{line1:"TEST nouvelle adresse",country_code:"MA"}}});
 });
});

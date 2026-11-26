import {beforeEach, describe, expect, it, vi} from "vitest";
const mocks=vi.hoisted(()=>({access:vi.fn(),select:vi.fn(),rpc:vi.fn(),rows:[] as unknown[],profiles:[] as unknown[],readError:false,lateError:false}));
vi.mock("@/modules/shared/lib/account-security/platform-access",()=>({
 loadMyPlatformAccess:mocks.access,
 hasPlatformRole:(roles:string[],allowed:string[])=>roles.some(role=>allowed.includes(role)),
}));
import {loadAdminIncentives} from "./server-repository";
const id="00000000-0000-4000-8000-000000000001";
beforeEach(()=>{
 vi.clearAllMocks();mocks.rows=[];mocks.profiles=[];mocks.readError=false;mocks.lateError=false;mocks.rpc.mockResolvedValue({data:{organizations:[]},error:null});
 mocks.access.mockResolvedValue({status:"success",roles:["MATRICIA_ADMIN"],requirementSatisfied:true,client:{rpc:mocks.rpc,from:(table:string)=>{
  const query={select:(columns:string)=>{mocks.select(table,columns);return query},eq:()=>query,order:()=>query,range:async(from:number,to:number)=>({data:(table==="organizations"?mocks.rows:table==="provider_profiles"?mocks.profiles:[]).slice(from,to+1),error:mocks.readError||mocks.lateError&&from>0?{code:"42703"}:null})};
  return query;
 }}});
});
describe("admin incentives organization projection",()=>{
 it("uses the authorized name projection when organization membership RLS hides a provider",async()=>{
  mocks.profiles=[{provider_organization_id:id}];mocks.rpc.mockResolvedValue({data:{organizations:[{id,display_name:'Supervised provider'}]},error:null});
  const result=await loadAdminIncentives();expect(result.status).toBe('success');
  if(result.status==='success')expect(result.value.organizations).toContainEqual({id,display_name:'Supervised provider',kind:'PROVIDER'});
  expect(mocks.rpc).toHaveBeenCalledWith('list_admin_provider_organization_names_v1',{p_organization_ids:[id]});
 });
 it("rejects a missing authorized provider name instead of hiding the provider",async()=>{
  mocks.profiles=[{provider_organization_id:id}];
  expect(await loadAdminIncentives()).toEqual({status:'error',reason:'UNAVAILABLE'});
 });
 it("keeps the provider beyond the first 500 organizations selectable",async()=>{
  mocks.rows=Array.from({length:501},(_,i)=>{const organizationId=`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`;return{id:organizationId,display_name:`Organization ${i}`,status:'ACTIVE',provider_profiles:i===500?{provider_organization_id:organizationId}:null};});
  const result=await loadAdminIncentives();expect(result.status).toBe('success');
  if(result.status==='success'){expect(result.value.organizations).toHaveLength(501);expect(result.value.organizations[500]?.kind).toBe('PROVIDER');}
 });
 it("fails closed when the second page is unavailable",async()=>{
  mocks.rows=Array.from({length:501},()=>({id,display_name:'Organization',status:'ACTIVE',provider_profiles:null}));mocks.lateError=true;
  expect(await loadAdminIncentives()).toEqual({status:'error',reason:'UNAVAILABLE'});
 });
 it("derives provider eligibility from its real profile without querying organizations.kind",async()=>{
  mocks.rows=[{id,display_name:"Provider fixture",status:"ACTIVE",provider_profiles:{provider_organization_id:id}}];
  const result=await loadAdminIncentives();
  expect(result.status).toBe("success");
  if(result.status==="success")expect(result.value.organizations).toEqual([{id,display_name:"Provider fixture",status:"ACTIVE",kind:"PROVIDER"}]);
  expect(mocks.select).toHaveBeenCalledWith("organizations","id,display_name,status,provider_profiles(provider_organization_id)");
 });
 it("does not classify an organization without a provider profile as a provider",async()=>{
  mocks.rows=[{id,display_name:"Client fixture",status:"ACTIVE",provider_profiles:null}];
  const result=await loadAdminIncentives();
  if(result.status!=="success")throw new Error("Expected available dashboard");
  expect(result.value.organizations[0]?.kind).toBeNull();
 });
 it("fails closed on an inconsistent provider projection or failed query",async()=>{
  mocks.rows=[{id,display_name:"Invalid",status:"ACTIVE",provider_profiles:{provider_organization_id:"00000000-0000-4000-8000-000000000002"}}];
  expect(await loadAdminIncentives()).toEqual({status:"error",reason:"UNAVAILABLE"});
  mocks.readError=true;
  expect(await loadAdminIncentives()).toEqual({status:"error",reason:"UNAVAILABLE"});
 });
 it("retains the role and MFA gates before accessing business data",async()=>{
  mocks.access.mockResolvedValueOnce({status:"success",roles:["COMPLIANCE_MANAGER"],requirementSatisfied:true});
  expect(await loadAdminIncentives()).toEqual({status:"error",reason:"FORBIDDEN"});
  mocks.access.mockResolvedValueOnce({status:"success",roles:["MATRICIA_ADMIN"],requirementSatisfied:false});
  expect(await loadAdminIncentives()).toEqual({status:"error",reason:"MFA_REQUIRED"});
  expect(mocks.select).not.toHaveBeenCalled();
 });
});

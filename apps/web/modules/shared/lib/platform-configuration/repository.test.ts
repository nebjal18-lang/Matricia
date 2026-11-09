import {beforeEach,describe,it,expect,vi} from "vitest";
const mocks=vi.hoisted(()=>({access:vi.fn(),rpc:vi.fn(),adminRpc:vi.fn(),probe:vi.fn()}));
vi.mock("@/modules/shared/lib/account-security/platform-access",()=>({loadMyPlatformAccess:mocks.access,hasPlatformRole:(roles:Set<string>,allowed:string[])=>allowed.some(r=>roles.has(r))}));
vi.mock("@/modules/shared/lib/supabase/admin",()=>({getSupabaseAdminClient:()=>({rpc:mocks.adminRpc})}));
vi.mock("./checks",()=>({checkConfigurationConnection:mocks.probe,validateProviderEnvironment:vi.fn(),validateProviderSecrets:vi.fn()}));
import {configurationSections,type ConfigurationDashboard,type ConfigurationRevision} from "./model";
import {sealConfigurationSecrets,unsealConfigurationSecrets} from "./secrets";
import {loadConfigurationDashboard,saveConfigurationForm,testConfigurationForm,decideConfigurationForm,loadActiveConfigurationEnvironment,configurationFailure} from "./repository";
const actor="11111111-1111-4111-8111-111111111111",revisionId="22222222-2222-4222-8222-222222222222",sourceId="33333333-3333-4333-8333-333333333333",hash="a".repeat(64),master="ab".repeat(32);
const settings={RESEND_FROM_EMAIL:"sender@example.com",RESEND_FROM_NAME:"Matricia",EMAIL_RECIPIENT_ALLOWLIST:"owner@example.com"};
const secrets={RESEND_API_KEY:"test-only-provider-key".repeat(2),RESEND_WEBHOOK_SECRET:`whsec_${Buffer.alloc(24,1).toString("base64")}`};
let data:ConfigurationDashboard,stored:Record<string,unknown>|undefined;
const form=(values:Record<string,string>)=>{const result=new FormData();for(const[k,v]of Object.entries({locale:"fr",idempotencyKey:revisionId,section:"RESEND",expectedActiveId:"",...values}))result.set(k,v);return result;};
function saveForm(overrides:Record<string,string>={}){return form({...Object.fromEntries(Object.entries(settings).map(([k,v])=>[`settings:${k}`,v])),...Object.fromEntries(Object.entries(secrets).map(([k,v])=>[`secret:${k}`,v])),...overrides});}
function safeRevision(id:string,status:ConfigurationRevision["status"]="DRAFT"):ConfigurationRevision{return{id,section:"RESEND",environment:"STAGING",settings,secret_keys:Object.keys(secrets),content_hash:hash,status,created_by:actor,created_at:new Date().toISOString(),approved_by:status==="ACTIVE"?sourceId:null,approved_at:status==="ACTIVE"?new Date().toISOString():null,probe:null};}
beforeEach(()=>{
 vi.stubEnv("APP_ENV","staging");vi.stubEnv("APP_ENCRYPTION_KEY",master);mocks.access.mockReset();mocks.rpc.mockReset();mocks.adminRpc.mockReset();mocks.probe.mockReset();stored=undefined;
 data={environment:"STAGING",actor_id:actor,can_write:true,sections:configurationSections.map(section=>({section,active_revision_id:null,latest_revision_id:null,revisions:[]}))};
 mocks.access.mockResolvedValue({status:"ok",client:{rpc:mocks.rpc},userId:actor,email:"admin@example.com",roles:new Set(["SUPER_ADMIN"]),requirementSatisfied:true});
 mocks.rpc.mockImplementation(async(name,args)=>{
  if(name==="get_admin_configuration_v1")return{data:structuredClone(data),error:null};
  if(name==="save_admin_configuration_v1"){
   stored={id:args.p_revision_id,section:args.p_section,environment:"STAGING",settings:args.p_settings,encrypted_secrets:args.p_encrypted_secrets,secret_keys:args.p_secret_keys,content_hash:hash};
   const section=data.sections.find(s=>s.section===args.p_section)!;section.latest_revision_id=args.p_revision_id;section.revisions.unshift(safeRevision(args.p_revision_id));
   return{data:{outcome:"CONFIGURATION_SAVED",revision_id:args.p_revision_id,content_hash:hash},error:null};
  }
  if(name==="start_admin_configuration_probe_v1")return{data:{probe_token:revisionId,expires_at:new Date(Date.now()+60000).toISOString()},error:null};
  return{data:null,error:{code:"42501"}};
 });
 mocks.adminRpc.mockImplementation(async(name)=>name==="load_admin_configuration_probe_v1"?{data:stored,error:null}:{data:{outcome:"CONFIGURATION_PROBE_RECORDED"},error:null});
});
describe("configuration administration boundary",()=>{
 it("refuses anonymous users and MFA-incomplete administrators before privileged access",async()=>{
  mocks.access.mockResolvedValueOnce({status:"error",reason:"UNAUTHENTICATED"});await expect(loadConfigurationDashboard()).rejects.toThrow("UNAUTHENTICATED");
  mocks.access.mockResolvedValueOnce({status:"ok",roles:new Set(["SUPER_ADMIN"]),requirementSatisfied:false});await expect(saveConfigurationForm(saveForm())).rejects.toThrow("MFA_REQUIRED");expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.adminRpc).not.toHaveBeenCalled();
 });
 it("does not permit an ordinary platform support role to read the vault dashboard",async()=>{mocks.access.mockResolvedValueOnce({status:"ok",roles:new Set(["SUPPORT_AGENT"]),requirementSatisfied:true});await expect(loadConfigurationDashboard()).rejects.toThrow("FORBIDDEN");expect(mocks.rpc).not.toHaveBeenCalled();});
 it("refuses deployment mismatch and overposted provider flags",async()=>{vi.stubEnv("APP_ENV","production");await expect(loadConfigurationDashboard()).rejects.toThrow("DEPLOYMENT_ENVIRONMENT_MISMATCH");vi.stubEnv("APP_ENV","staging");await expect(saveConfigurationForm(saveForm({"settings:EMAIL_LIVE_DELIVERY_ENABLED":"true"}))).rejects.toThrow("VALIDATION");expect(mocks.rpc.mock.calls.some(([name])=>name==="save_admin_configuration_v1")).toBe(false);});
 it("stores only authenticated ciphertext and confirms actual readback",async()=>{expect(await saveConfigurationForm(saveForm())).toEqual({outcome:"CONFIGURATION_SAVED",revision_id:revisionId,content_hash:hash});const call=mocks.rpc.mock.calls.find(([name])=>name==="save_admin_configuration_v1")!;expect(JSON.stringify(call[1])).not.toContain(secrets.RESEND_API_KEY);expect(unsealConfigurationSecrets(call[1].p_encrypted_secrets,{environment:"STAGING",section:"RESEND",revisionId},master)).toEqual(secrets);expect(mocks.rpc.mock.calls.filter(([name])=>name==="get_admin_configuration_v1")).toHaveLength(2);});
 it("replays the exact saved request without regenerating ciphertext or writing another row",async()=>{const first=await saveConfigurationForm(saveForm());expect(await saveConfigurationForm(saveForm())).toEqual(first);expect(mocks.rpc.mock.calls.filter(([name])=>name==="save_admin_configuration_v1")).toHaveLength(1);await expect(saveConfigurationForm(saveForm({"secret:RESEND_API_KEY":"changed-secret-key".repeat(3)}))).rejects.toThrow("STALE");});
 it("preserves blank secrets only from the exact authorized source revision",async()=>{
  const source=safeRevision(sourceId,"ACTIVE"),section=data.sections.find(s=>s.section==="RESEND")!;section.revisions=[source];section.active_revision_id=sourceId;section.latest_revision_id=sourceId;
  stored={...source,encrypted_secrets:sealConfigurationSecrets(secrets,{environment:"STAGING",section:"RESEND",revisionId:sourceId},master)};
  await saveConfigurationForm(saveForm({sourceRevisionId:sourceId,sourceHash:hash,expectedActiveId:sourceId,"secret:RESEND_API_KEY":"","secret:RESEND_WEBHOOK_SECRET":""}));
  const call=mocks.rpc.mock.calls.find(([name])=>name==="save_admin_configuration_v1")!;expect(unsealConfigurationSecrets(call[1].p_encrypted_secrets,{environment:"STAGING",section:"RESEND",revisionId},master)).toEqual(secrets);expect(call[1].p_expected_active_id).toBe(sourceId);
 });
 it("does not use another section as a source for blank secrets",async()=>{const source={...safeRevision(sourceId),section:"YOUSIGN" as const};data.sections.find(s=>s.section==="YOUSIGN")!.revisions=[source];await expect(saveConfigurationForm(saveForm({sourceRevisionId:sourceId,sourceHash:hash}))).rejects.toThrow("VALIDATION");expect(mocks.adminRpc).not.toHaveBeenCalled();});
 it("records a failed connectivity result and never claims activation",async()=>{await saveConfigurationForm(saveForm());mocks.probe.mockResolvedValue({status:"FAIL",code:"PROVIDER_REJECTED"});await expect(testConfigurationForm(form({revisionId,contentHash:hash}))).rejects.toThrow("PROVIDER_REJECTED");expect(mocks.adminRpc).toHaveBeenCalledWith("record_admin_configuration_probe_v1",{p_probe_token:revisionId,p_status:"FAIL",p_code:"PROVIDER_REJECTED"});expect(mocks.rpc.mock.calls.some(([name])=>name==="approve_admin_configuration_v1")).toBe(false);});
 it("requires explicit review and rejects a tracked request masquerading as actual activation",async()=>{await expect(decideConfigurationForm(form({revisionId,contentHash:hash,reason:"Independent actual review"}),true)).rejects.toThrow("VALIDATION");mocks.rpc.mockImplementation(async(name)=>name==="get_admin_configuration_v1"?{data,error:null}:{data:{outcome:"REQUEST_TRACKED",revision_id:revisionId},error:null});await expect(decideConfigurationForm(form({revisionId,contentHash:hash,reason:"Independent actual review",reviewConfirmed:"on"}),true)).rejects.toThrow("CONFIGURATION_UNAVAILABLE");});
 it("loads approved secrets only on the server and preserves the managed/disabled section list",async()=>{const row={...safeRevision(revisionId,"ACTIVE"),encrypted_secrets:sealConfigurationSecrets(secrets,{environment:"STAGING",section:"RESEND",revisionId},master)};mocks.adminRpc.mockResolvedValue({data:{environment:"STAGING",managed_sections:["RESEND","PAYPAL"],sections:[row]},error:null});expect(await loadActiveConfigurationEnvironment({APP_ENCRYPTION_KEY:master})).toEqual({environment:"STAGING",managedSections:["RESEND","PAYPAL"],values:{...settings,...secrets,EMAIL_DELIVERY_MODE:"EXTERNAL",EMAIL_LIVE_DELIVERY_ENABLED:"true"}});});
 it("does not decrypt or validate an unrelated provider when loading a scoped runtime",async()=>{const unrelated={...safeRevision(revisionId,"ACTIVE"),section:"PAYPAL",encrypted_secrets:"invalid-unrelated-ciphertext"};mocks.adminRpc.mockResolvedValue({data:{environment:"STAGING",managed_sections:["RESEND","PAYPAL"],sections:[unrelated]},error:null});expect(await loadActiveConfigurationEnvironment({APP_ENCRYPTION_KEY:master},["RESEND"])).toEqual({environment:"STAGING",managedSections:["RESEND"],values:{}});});
 it("does not propagate arbitrary provider errors to client state",()=>{expect(configurationFailure(new Error("PRIVATE_KEY-provider-payload"))).toBe("CONFIGURATION_UNAVAILABLE");});
});

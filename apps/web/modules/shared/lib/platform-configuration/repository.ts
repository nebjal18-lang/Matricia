import "server-only";
import {timingSafeEqual} from "node:crypto";
import {z} from "zod";
import {loadMyPlatformAccess,hasPlatformRole} from "@/modules/shared/lib/account-security/platform-access";
import {getSupabaseAdminClient} from "@/modules/shared/lib/supabase/admin";
import {configurationDashboardSchema,configurationEnvironmentSchema,configurationSectionSchema,parseConfigurationValues,sectionFields,type ConfigurationDashboard,type ConfigurationEnvironment,type ConfigurationRevision,type ConfigurationSection} from "./model";
import {sealConfigurationSecrets,unsealConfigurationSecrets} from "./secrets";
import {checkConfigurationConnection,validateProviderEnvironment,validateProviderSecrets} from "./checks";

export class ConfigurationError extends Error {constructor(readonly code:string){super(code);}}
const uuid=z.string().uuid(),hash=z.string().regex(/^[a-f0-9]{64}$/u);
const rpcError=(error:{code?:string}|null|undefined)=>new ConfigurationError(error?.code==="42501"?"FORBIDDEN":error?.code==="40001"?"STALE":error?.code==="22023"||error?.code==="22000"?"VALIDATION":"CONFIGURATION_UNAVAILABLE");
async function access(){
  const result=await loadMyPlatformAccess();
  if(result.status!=="ok")throw new ConfigurationError(result.reason==="UNAUTHENTICATED"?"UNAUTHENTICATED":"CONFIGURATION_UNAVAILABLE");
  if(!hasPlatformRole(result.roles,["SUPER_ADMIN","MATRICIA_ADMIN"]))throw new ConfigurationError("FORBIDDEN");
  if(!result.requirementSatisfied)throw new ConfigurationError("MFA_REQUIRED");
  return result;
}
async function dashboard(client:Awaited<ReturnType<typeof access>>["client"]):Promise<ConfigurationDashboard>{
  const result=await client.rpc("get_admin_configuration_v1");if(result.error)throw rpcError(result.error);
  const parsed=configurationDashboardSchema.safeParse(result.data);if(!parsed.success)throw new ConfigurationError("CONFIGURATION_UNAVAILABLE");
  if(parsed.data.environment!==process.env.APP_ENV?.trim().toUpperCase())throw new ConfigurationError("DEPLOYMENT_ENVIRONMENT_MISMATCH");
  return parsed.data;
}
export async function loadConfigurationDashboard():Promise<ConfigurationDashboard>{const authorized=await access();return dashboard(authorized.client);}
const protectedRow=z.object({id:uuid,section:configurationSectionSchema,environment:configurationEnvironmentSchema,settings:z.record(z.string(),z.string()),encrypted_secrets:z.string().max(100000),secret_keys:z.array(z.string()),content_hash:hash}).passthrough();
function findRevision(data:ConfigurationDashboard,id:string,expectedHash:string){
  const row=data.sections.flatMap(s=>s.revisions).find(r=>r.id===id&&r.content_hash===expectedHash);
  if(!row)throw new ConfigurationError("STALE");return row;
}
async function leaseRow(client:Awaited<ReturnType<typeof access>>["client"],revision:ConfigurationRevision){
  const issued=await client.rpc("start_admin_configuration_probe_v1",{p_revision_id:revision.id,p_expected_hash:revision.content_hash});if(issued.error)throw rpcError(issued.error);
  const lease=z.object({probe_token:uuid,expires_at:z.string()}).safeParse(issued.data);
  if(!lease.success||Date.parse(lease.data.expires_at)<=Date.now())throw new ConfigurationError("CONFIGURATION_UNAVAILABLE");
  const admin=getSupabaseAdminClient({timeoutMs:10000});
  const loaded=await admin.rpc("load_admin_configuration_probe_v1",{p_probe_token:lease.data.probe_token});if(loaded.error)throw rpcError(loaded.error);
  const row=protectedRow.safeParse(loaded.data);
  if(!row.success||row.data.id!==revision.id||row.data.section!==revision.section||row.data.environment!==revision.environment||row.data.content_hash!==revision.content_hash)throw new ConfigurationError("CONFIGURATION_UNAVAILABLE");
  return {admin,token:lease.data.probe_token,row:row.data};
}
function secretsFromRow(row:z.infer<typeof protectedRow>,key?:string){return row.section==="COMPANY"?{}:unsealConfigurationSecrets(row.encrypted_secrets,{environment:row.environment,section:row.section,revisionId:row.id},key);}
function formText(form:FormData,key:string){const value=form.get(key);if(value!==null&&typeof value!=="string")throw new ConfigurationError("VALIDATION");return value??"";}
function formValues(form:FormData,section:ConfigurationSection,kind:"settings"|"secret"){
  const allowed=sectionFields[section].filter(f=>f.secret===(kind==="secret")).map(f=>f.key),result:Record<string,string>={};
  for(const [key,value]of form.entries())if(key.startsWith(`${kind}:`)){
    const name=key.slice(kind.length+1);if(!allowed.includes(name)||typeof value!=="string"||Object.hasOwn(result,name))throw new ConfigurationError("VALIDATION");
    result[name]=kind==="secret"?value:value.trim();
  }
  if(kind==="settings")for(const name of allowed)if(!Object.hasOwn(result,name))result[name]="";
  return result;
}
const canonical=(v:Record<string,string>)=>JSON.stringify(Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))));
function sameSecrets(a:Record<string,string>,b:Record<string,string>){const first=Buffer.from(canonical(a)),second=Buffer.from(canonical(b));return first.length===second.length&&timingSafeEqual(first,second);}

export async function saveConfigurationForm(form:FormData){
  const authorized=await access(),data=await dashboard(authorized.client);
  const section=configurationSectionSchema.parse(formText(form,"section")),id=uuid.parse(formText(form,"idempotencyKey"));
  const expected=formText(form,"expectedActiveId")||null;if(expected)uuid.parse(expected);
  const values=formValues(form,section,"settings"),provided=formValues(form,section,"secret");let merged:Record<string,string>={};
  const sourceId=formText(form,"sourceRevisionId"),sourceHash=formText(form,"sourceHash");
  if(sourceId||sourceHash){
    uuid.parse(sourceId);hash.parse(sourceHash);const source=findRevision(data,sourceId,sourceHash);
    if(source.section!==section)throw new ConfigurationError("VALIDATION");
    if(section!=="COMPANY")merged=secretsFromRow((await leaseRow(authorized.client,source)).row);
  }
  for(const [key,value]of Object.entries(provided))if(value!=="")merged[key]=value;
  const parsed=parseConfigurationValues(section,values,merged);validateProviderEnvironment(section,parsed.settings,data.environment);validateProviderSecrets(section,parsed.secrets);
  const existing=data.sections.flatMap(s=>s.revisions).find(r=>r.id===id);
  if(existing){
    if(existing.created_by!==authorized.userId||existing.section!==section||canonical(existing.settings)!==canonical(parsed.settings))throw new ConfigurationError("STALE");
    const oldSecrets=section==="COMPANY"?{}:secretsFromRow((await leaseRow(authorized.client,existing)).row);
    if(!sameSecrets(oldSecrets,parsed.secrets))throw new ConfigurationError("STALE");
    return {outcome:"CONFIGURATION_SAVED",revision_id:id,content_hash:existing.content_hash};
  }
  const encrypted=section==="COMPANY"?"":sealConfigurationSecrets(parsed.secrets,{environment:data.environment,section,revisionId:id});
  const result=await authorized.client.rpc("save_admin_configuration_v1",{p_revision_id:id,p_section:section,p_settings:parsed.settings,p_encrypted_secrets:encrypted,p_secret_keys:Object.keys(parsed.secrets).sort(),p_expected_active_id:expected,p_idempotency_key:id});
  if(result.error)throw rpcError(result.error);
  const receipt=z.object({outcome:z.literal("CONFIGURATION_SAVED"),revision_id:uuid,content_hash:hash}).safeParse(result.data);
  if(!receipt.success||receipt.data.revision_id!==id)throw new ConfigurationError("CONFIGURATION_UNAVAILABLE");
  const readback=await dashboard(authorized.client);findRevision(readback,id,receipt.data.content_hash);
  return receipt.data;
}
export async function testConfigurationForm(form:FormData){
  const authorized=await access(),data=await dashboard(authorized.client);
  const row=findRevision(data,uuid.parse(formText(form,"revisionId")),hash.parse(formText(form,"contentHash")));
  if(row.section==="COMPANY")return {outcome:"CONFIGURATION_CHECKED",probeCode:"COMPANY_VALIDATED"};
  const leased=await leaseRow(authorized.client,row),values=secretsFromRow(leased.row);
  const result=await checkConfigurationConnection(row.section,row.settings,values,row.environment);
  const recorded=await leased.admin.rpc("record_admin_configuration_probe_v1",{p_probe_token:leased.token,p_status:result.status,p_code:result.code});
  if(recorded.error)throw rpcError(recorded.error);
  const receipt=z.object({outcome:z.literal("CONFIGURATION_PROBE_RECORDED"),revision_id:uuid,status:z.enum(["PASS","FAIL"]),code:z.string(),checked_at:z.string(),valid_until:z.string()}).safeParse(recorded.data);
  if(!receipt.success||receipt.data.revision_id!==row.id||receipt.data.status!==result.status||receipt.data.code!==result.code)throw new ConfigurationError("CONFIGURATION_UNAVAILABLE");
  const checked=Date.parse(receipt.data.checked_at),until=Date.parse(receipt.data.valid_until),now=Date.now();
  if(!Number.isFinite(checked)||!Number.isFinite(until)||checked<now-300000||checked>now+60000||until<=now||until>checked+86400000)throw new ConfigurationError("CONFIGURATION_UNAVAILABLE");
  if(result.status!=="PASS")throw new ConfigurationError(result.code);
  return {outcome:"CONFIGURATION_CHECKED",probeCode:result.code};
}
export async function decideConfigurationForm(form:FormData,approve:boolean){
  const authorized=await access();await dashboard(authorized.client);
  if(approve&&formText(form,"reviewConfirmed")!=="on")throw new ConfigurationError("VALIDATION");
  const args={p_revision_id:uuid.parse(formText(form,"revisionId")),p_expected_hash:hash.parse(formText(form,"contentHash")),p_approve:approve,p_reason:z.string().trim().min(10).max(2000).parse(formText(form,"reason")),p_idempotency_key:uuid.parse(formText(form,"idempotencyKey"))};
  const result=await authorized.client.rpc("approve_admin_configuration_v1",args);if(result.error)throw rpcError(result.error);
  const receipt=z.object({outcome:z.literal(approve?"CONFIGURATION_ACTIVATED":"CONFIGURATION_REJECTED"),revision_id:uuid}).safeParse(result.data);
  if(!receipt.success||receipt.data.revision_id!==args.p_revision_id)throw new ConfigurationError("CONFIGURATION_UNAVAILABLE");return receipt.data;
}
export async function deactivateConfigurationForm(form:FormData){
  const authorized=await access();await dashboard(authorized.client);
  const args={p_section:configurationSectionSchema.parse(formText(form,"section")),p_expected_active_id:uuid.parse(formText(form,"expectedActiveId")),p_reason:z.string().trim().min(10).max(2000).parse(formText(form,"reason")),p_idempotency_key:uuid.parse(formText(form,"idempotencyKey"))};
  const result=await authorized.client.rpc("deactivate_admin_configuration_v1",args);if(result.error)throw rpcError(result.error);
  const receipt=z.object({outcome:z.literal("CONFIGURATION_DEACTIVATED")}).safeParse(result.data);if(!receipt.success)throw new ConfigurationError("CONFIGURATION_UNAVAILABLE");return receipt.data;
}
async function activeConfiguration(){
  const result=await getSupabaseAdminClient({timeoutMs:10000}).rpc("get_active_platform_configuration_v1");if(result.error)throw rpcError(result.error);
  const parsed=z.object({environment:configurationEnvironmentSchema,managed_sections:z.array(configurationSectionSchema),sections:z.array(protectedRow)}).safeParse(result.data);
  if(!parsed.success)throw new ConfigurationError("CONFIGURATION_UNAVAILABLE");return parsed.data;
}
export async function loadActiveConfigurationEnvironment(base:Record<string,string|undefined>=process.env,sections?:readonly ConfigurationSection[]):Promise<{environment:ConfigurationEnvironment;managedSections:ConfigurationSection[];values:Record<string,string>}>{
  const data=await activeConfiguration(),values:Record<string,string>={};
  const selected=sections?sections.map(section=>configurationSectionSchema.parse(section)):undefined;
  for(const row of data.sections.filter(row=>!selected||selected.includes(row.section))){
    if(row.environment!==data.environment)throw new ConfigurationError("DEPLOYMENT_ENVIRONMENT_MISMATCH");
    if(row.section==="COMPANY"){values.PUBLIC_CONTACT_NOTIFICATION_EMAIL=parseConfigurationValues("COMPANY",row.settings,{}).settings.supportEmail!;continue;}
    const parsed=parseConfigurationValues(row.section,row.settings,secretsFromRow(row,base.APP_ENCRYPTION_KEY));validateProviderEnvironment(row.section,parsed.settings,data.environment);
    Object.assign(values,parsed.settings,parsed.secrets);
    if(row.section==="RESEND")Object.assign(values,{EMAIL_DELIVERY_MODE:"EXTERNAL",EMAIL_LIVE_DELIVERY_ENABLED:"true"});
    if(row.section==="PAYPAL")Object.assign(values,{PAYMENT_PROVIDER:"PAYPAL",PAYMENT_PROVIDER_ALLOWLIST:"PAYPAL",PAYMENT_LIVE_ENABLED:"true"});
    if(row.section==="YOUSIGN")Object.assign(values,{SIGNATURE_PROVIDER_MODE:"EXTERNAL",SIGNATURE_PROVIDER_CODE:"YOUSIGN"});
  }
  return {environment:data.environment,managedSections:data.managed_sections.filter(section=>!selected||selected.includes(section)),values};
}
export async function loadActiveCompanyProfile():Promise<Record<string,string>|null>{
  const data=await activeConfiguration();
  if(data.environment!==process.env.APP_ENV?.trim().toUpperCase())throw new ConfigurationError("DEPLOYMENT_ENVIRONMENT_MISMATCH");
  const row=data.sections.find(s=>s.section==="COMPANY");return row?parseConfigurationValues("COMPANY",row.settings,{}).settings:null;
}
export function configurationFailure(error:unknown):string{
  if(error instanceof ConfigurationError)return error.code;
  if(error instanceof z.ZodError)return "VALIDATION";
  if(error instanceof Error&&["ENCRYPTION_NOT_CONFIGURED","CONFIGURATION_SECRETS_UNAVAILABLE","PROVIDER_ENVIRONMENT_MISMATCH","PAYPAL_CERTIFICATE_INVALID"].includes(error.message))return error.message;
  return "CONFIGURATION_UNAVAILABLE";
}

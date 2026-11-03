"use server";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {hasPlatformRole,loadMyPlatformAccess} from "@/modules/shared/lib/account-security/platform-access";
import {policyRoles,type PolicyState} from "./model";
const uuid=z.string().uuid(),reason=z.string().trim().min(20).max(1000),reference=z.string().regex(/^[A-Z][A-Z0-9_.:/-]{7,199}$/u);
export async function submitSignaturePolicyAction(_state:PolicyState,form:FormData):Promise<PolicyState>{
 const access=await loadMyPlatformAccess();if(access.status!=="ok"||!access.requirementSatisfied||!hasPlatformRole(access.roles,policyRoles))return{status:"error",code:"ACCESS_DENIED"};
 const locale=z.enum(["fr","ar"]).safeParse(form.get("locale"));if(!locale.success)return{status:"error"};
 let result;const operation=form.get("operation");
 if(operation==="propose"){
  const parsed=z.object({issuer:uuid,kind:z.enum(["CONTRACT","AMENDMENT","FRANCHISE_MANDATE"]),provider:uuid,level:z.enum(["SIMPLE","ADVANCED","QUALIFIED"]),legal:reference,adapter:reference,hours:z.coerce.number().int().min(1).max(8760),reason,key:uuid}).safeParse(Object.fromEntries(form));if(!parsed.success)return{status:"error",code:"INVALID_INPUT"};const p=parsed.data;
  result=await access.client.rpc("propose_signature_policy_v1",{p_issuer_organization_id:p.issuer,p_source_kind:p.kind,p_provider_config_id:p.provider,p_minimum_level:p.level,p_require_certificate:form.get("certificate")==="on",p_require_trusted_timestamp:form.get("timestamp")==="on",p_legal_approval_reference:p.legal,p_adapter_registration_reference:p.adapter,p_valid_hours:p.hours,p_reason:p.reason,p_idempotency_key:p.key});
 }else if(operation==="approve"||operation==="reject"){
  const parsed=z.object({proposal:uuid,hash:z.string().regex(/^[a-f0-9]{64}$/u),reason}).safeParse(Object.fromEntries(form));if(!parsed.success)return{status:"error",code:"INVALID_INPUT"};const p=parsed.data;
  result=await access.client.rpc("decide_signature_policy_v1",{p_proposal_id:p.proposal,p_expected_content_hash:p.hash,p_approve:operation==="approve",p_reason:p.reason});
 }else if(operation==="disable"){
  const parsed=z.object({proposal:uuid,reason}).safeParse(Object.fromEntries(form));if(!parsed.success)return{status:"error",code:"INVALID_INPUT"};
  result=await access.client.rpc("disable_signature_policy_v1",{p_proposal_id:parsed.data.proposal,p_reason:parsed.data.reason});
 }else if(operation==="cancel_local"){
  const parsed=z.object({envelope:uuid,version:z.coerce.number().int().positive(),reason,key:uuid,confirmation:z.literal("NON_CONTRACTUAL_DEMO")}).safeParse(Object.fromEntries(form));if(!parsed.success)return{status:"error",code:"INVALID_INPUT"};const p=parsed.data;
  result=await access.client.rpc("cancel_development_signature_envelope_v1",{p_envelope_id:p.envelope,p_expected_row_version:p.version,p_reason:p.reason,p_idempotency_key:p.key});
 }else if(operation==="simulate"){
  const parsed=z.object({envelope:uuid,step:z.enum(["SENT","SIGNER_SIGNED"]),signer:z.union([uuid,z.literal("")]),key:uuid,confirmation:z.literal("NON_CONTRACTUAL_DEMO")}).safeParse(Object.fromEntries(form));if(!parsed.success)return{status:"error",code:"INVALID_INPUT"};const p=parsed.data;
  result=await access.client.rpc("request_signature_mock_step_v1",{p_envelope_id:p.envelope,p_action:p.step,p_signer_id:p.signer||null,p_idempotency_key:p.key});
 }else return{status:"error",code:"INVALID_INPUT"};
 const outcome=(result.data as{outcome?:unknown}|null)?.outcome;if(result.error||typeof outcome!=="string"||!/^SIGNATURE_(POLICY_(PROPOSED|APPROVED|REJECTED|DISABLED)|SIMULATION_QUEUED|DEVELOPMENT_ENVELOPE_VOIDED)$/u.test(outcome))return{status:"error",code:result.error?.code==="55000"?"PRECONDITION_REQUIRED":"COMMAND_REFUSED"};
 revalidatePath(`/${locale.data}/administration/signatures`);return{status:"success",code:outcome};
}

"use server";
import{randomUUID}from"node:crypto";
import{revalidatePath}from"next/cache";
import{z}from"zod";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
export type ContractGenerationState={status:"idle"}|{status:"success";contractId:string}|{status:"error";reason:"VALIDATION"|"MFA"|"FORBIDDEN"|"STALE"|"TEMPLATE"|"COMMISSION"|"SELECTED_QUOTE"|"IDENTITY"|"UNAVAILABLE"};
const input=z.object({locale:z.enum(["fr","ar"]),organizationId:z.string().uuid(),requestId:z.string().uuid(),quoteVersionId:z.string().uuid(),requestRowVersion:z.coerce.number().int().positive(),templateVersionId:z.string().uuid(),commissionPolicyVersionId:z.string().uuid(),reason:z.string().trim().min(10).max(1000),idempotencyKey:z.string().uuid()});
export async function generateSelectedQuoteContract(_:ContractGenerationState,form:FormData):Promise<ContractGenerationState>{
 const p=input.safeParse(Object.fromEntries(form.entries()));if(!p.success)return{status:"error",reason:"VALIDATION"};
 try{const client=await getSupabaseServerClient(),auth=await client.auth.getUser();if(auth.error||!auth.data.user)return{status:"error",reason:"FORBIDDEN"};
  const assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();if(assurance.error||assurance.data?.currentLevel!=="aal2")return{status:"error",reason:"MFA"};
  const value=p.data,scope=await client.from("service_requests").select("id").eq("id",value.requestId).eq("client_organization_id",value.organizationId).limit(1);
  if(scope.error)return{status:"error",reason:scope.error.code==="42501"?"FORBIDDEN":"UNAVAILABLE"};
  if(!z.array(z.object({id:z.literal(value.requestId)})).length(1).safeParse(scope.data).success)return{status:"error",reason:"FORBIDDEN"};
  const result=await client.rpc("generate_selected_quote_contract_v1",{p_request_id:value.requestId,p_quote_version_id:value.quoteVersionId,p_expected_request_row_version:value.requestRowVersion,p_template_version_id:value.templateVersionId,p_commission_policy_version_id:value.commissionPolicyVersionId,p_reason:value.reason,p_idempotency_key:value.idempotencyKey,p_correlation_id:randomUUID()});
  if(result.error){const message=result.error.message;return{status:"error",reason:result.error.code==="42501"?"FORBIDDEN":result.error.code==="40001"?"STALE":message.includes("CONTRACT_TEMPLATE_REQUIRED")?"TEMPLATE":message.includes("COMMISSION_POLICY_REQUIRED")?"COMMISSION":message.includes("SELECTED_QUOTE_REQUIRED")?"SELECTED_QUOTE":message.includes("VERIFIED_LEGAL_PARTIES_REQUIRED")?"IDENTITY":"UNAVAILABLE"};}
  const output=z.object({outcome:z.literal("SELECTED_QUOTE_CONTRACT_DRAFTED"),contract_id:z.string().uuid(),contract_version_id:z.string().uuid(),content_hash:z.string().regex(/^[0-9a-f]{64}$/u)}).safeParse(result.data);
  if(!output.success)return{status:"error",reason:"UNAVAILABLE"};
  for(const path of[`/${value.locale}/client/contrats`,`/${value.locale}/client/demandes/${value.requestId}`,`/${value.locale}/client/demandes/${value.requestId}/offres`])revalidatePath(path);
  return{status:"success",contractId:output.data.contract_id};
 }catch{return{status:"error",reason:"UNAVAILABLE"};}
}

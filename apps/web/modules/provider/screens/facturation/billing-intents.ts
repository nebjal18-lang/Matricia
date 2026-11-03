import { z } from "zod";
import type { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
type Client=Awaited<ReturnType<typeof getSupabaseServerClient>>;
export type BillingIntentResult={status:"pending_scan";intentId:string}|{status:"success";outcome:string}|{status:"error";reason:"VALIDATION"|"FORBIDDEN"|"CONFLICT"|"FAILED"};
const fail=(error:{code?:string}|null):BillingIntentResult=>({status:"error",reason:error?.code==="42501"?"FORBIDDEN":["23505","23514","55000","22000"].includes(error?.code??"")?"CONFLICT":"FAILED"});
export async function finalizeBillingIntent(client:Client,intentId:string):Promise<BillingIntentResult>{
 if(!z.string().uuid().safeParse(intentId).success)return {status:"error",reason:"VALIDATION"};
 const result=await client.rpc("finalize_my_provider_billing_intent",{p_intent_id:intentId});if(result.error)return fail(result.error);
 const parsed=z.object({outcome:z.string()}).safeParse(result.data);if(!parsed.success)return{status:"error",reason:"FAILED"};
 if(parsed.data.outcome==="PROVIDER_BILLING_SCAN_PENDING")return{status:"pending_scan",intentId};
 if(["PROVIDER_BILLING_PROOF_EXPIRED","PROVIDER_BILLING_PROOF_REJECTED"].includes(parsed.data.outcome))return{status:"error",reason:"CONFLICT"};
 return["PROVIDER_PAYMENT_RECORDED","PROVIDER_PAYABLE_RECORDED","PROVIDER_FINANCIAL_DECLARATION_SUBMITTED"].includes(parsed.data.outcome)?{status:"success",outcome:parsed.data.outcome}:{status:"error",reason:"FAILED"};
}
export async function persistBillingIntent(client:Client,organizationId:string,kind:"PAYMENT"|"PAYABLE",payload:Record<string,unknown>,key:string):Promise<BillingIntentResult>{
 const result=await client.rpc("save_my_provider_billing_intent",{p_provider_organization_id:organizationId,p_kind:kind,p_payload:payload,p_idempotency_key:key});if(result.error)return fail(result.error);
 const parsed=z.object({intent_id:z.string().uuid()}).safeParse(result.data);return parsed.success?finalizeBillingIntent(client,parsed.data.intent_id):{status:"error",reason:"FAILED"};
}

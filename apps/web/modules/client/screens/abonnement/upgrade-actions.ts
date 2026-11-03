"use server";
import {z} from "zod";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
export type UpgradeQuote={id:string;hash:string;amountMinor:string;currency:string;expiresAt:string;targetPlanVersionId:string;billingInterval:"MONTHLY"|"ANNUAL";termsFr:string;termsAr:string;sourcePeriodEnd:string;mode:"FULL_NEW_CYCLE"|"PROPORTIONAL_REMAINING"};
export type UpgradeQuoteState={status:"idle"}|{status:"quoted";quote:UpgradeQuote}|{status:"error";reason:"VALIDATION"|"MFA_REQUIRED"|"FORBIDDEN"|"CONFLICT"|"UNAVAILABLE"};
const input=z.object({organizationId:z.string().uuid(),policyId:z.string().uuid(),key:z.string().uuid()});
const output=z.object({outcome:z.literal("UPGRADE_QUOTED"),quote_id:z.string().uuid(),content_hash:z.string().regex(/^[a-f0-9]{64}$/u),amount_minor:z.string().regex(/^[1-9]\d*$/u),currency:z.string().regex(/^[A-Z]{3}$/u),expires_at:z.string().datetime({offset:true}),snapshot:z.object({target_plan_version_id:z.string().uuid(),billing_interval:z.enum(["MONTHLY","ANNUAL"]),mode:z.enum(["FULL_NEW_CYCLE","PROPORTIONAL_REMAINING"]),terms_fr:z.string(),terms_ar:z.string(),source_period_end:z.string()})});
export async function prepareUpgradeQuote(_previous:UpgradeQuoteState,form:FormData):Promise<UpgradeQuoteState>{
 const p=input.safeParse(Object.fromEntries(form.entries()));if(!p.success)return{status:"error",reason:"VALIDATION"};
 try{
  const client=await getSupabaseServerClient();const auth=await client.auth.getUser();if(auth.error||!auth.data.user)return{status:"error",reason:"FORBIDDEN"};
  const aal=await client.auth.mfa.getAuthenticatorAssuranceLevel();if(aal.error)return{status:"error",reason:"UNAVAILABLE"};if(aal.data.currentLevel!=="aal2")return{status:"error",reason:"MFA_REQUIRED"};
  const r=await client.rpc("create_client_subscription_upgrade_quote_v1",{p_organization_id:p.data.organizationId,p_policy_id:p.data.policyId,p_idempotency_key:p.data.key});
  if(r.error)return{status:"error",reason:r.error.code==="42501"?"FORBIDDEN":["40001","55000","22003"].includes(r.error.code)?"CONFLICT":"UNAVAILABLE"};
  const parsed=output.safeParse(r.data);if(!parsed.success)return{status:"error",reason:"UNAVAILABLE"};const q=parsed.data;
  return{status:"quoted",quote:{id:q.quote_id,hash:q.content_hash,amountMinor:q.amount_minor,currency:q.currency,expiresAt:q.expires_at,targetPlanVersionId:q.snapshot.target_plan_version_id,billingInterval:q.snapshot.billing_interval,termsFr:q.snapshot.terms_fr,termsAr:q.snapshot.terms_ar,sourcePeriodEnd:q.snapshot.source_period_end,mode:q.snapshot.mode}};
 }catch{return{status:"error",reason:"UNAVAILABLE"};}
}

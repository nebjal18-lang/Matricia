"use server";
import{z}from"zod";
import{revalidatePath}from"next/cache";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import{classifyAuthReadFailure}from"@/modules/shared/lib/auth/read-failure";
import{classifyCommandFailure}from"@/modules/shared/lib/auth/command-failure";
import type{ReferralRewardActionState}from"./model";
const common=z.object({locale:z.enum(["fr","ar"]),idempotencyKey:z.string().uuid()});
async function call(locale:"fr"|"ar",name:string,args:Record<string,unknown>,kind:"decision"|"execution"):Promise<ReferralRewardActionState>{
 try{
  const client=await getSupabaseServerClient(),auth=await client.auth.getUser(),failure=classifyAuthReadFailure(auth.error);
  if(failure)return{status:"error",reason:failure==="UNAUTHENTICATED"?"UNAUTHENTICATED":"FAILED"};
  if(!auth.data.user)return{status:"error",reason:"UNAUTHENTICATED"};
  const assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if(assurance.error)return{status:"error",reason:"FAILED"};
  if(assurance.data.currentLevel!=="aal2")return{status:"error",reason:"MFA_REQUIRED"};
  const response=await client.rpc(name,args);
  if(response.error)return{status:"error",reason:response.error.code==="23514"&&/(?:_CAP_EXCEEDED|_COOLDOWN_ACTIVE)/u.test(response.error.message??"")?"CONFLICT":classifyCommandFailure(response.error)};
  const output=kind==="decision"?z.object({outcome:z.literal(`REWARD_AWARD_${String(args.p_decision)}`),approval_id:z.string().uuid(),source_event_id:z.literal(String(args.p_source_event_id)),rule_version_id:z.literal(String(args.p_rule_version_id))}):z.object({outcome:z.literal("CLIENT_REFERRAL_REWARD_EXECUTED"),approval_id:z.literal(String(args.p_approval_id)),reward_grant_id:z.string().uuid(),quantity:z.string().regex(/^[1-9]\d*$/u)});
  if(!output.safeParse(response.data).success)return{status:"error",reason:"FAILED"};
  revalidatePath(`/${locale}/administration/finance/recompenses`);revalidatePath(`/${locale}/client/recompenses`);revalidatePath(`/${locale}/client/credits`);
  return{status:"success",kind};
 }catch{return{status:"error",reason:"FAILED"};}
}
export async function decideClientReferralReward(_previous:ReferralRewardActionState,form:FormData):Promise<ReferralRewardActionState>{
 const p=common.extend({sourceEventId:z.string().uuid(),ruleVersionId:z.string().uuid(),decision:z.enum(["APPROVED","REJECTED"]),rationale:z.string().trim().min(10).max(1000)}).safeParse(Object.fromEntries(form.entries()));
 if(!p.success)return{status:"error",reason:"VALIDATION"};const v=p.data;
 return call(v.locale,"decide_reward_award",{p_source_event_id:v.sourceEventId,p_rule_version_id:v.ruleVersionId,p_decision:v.decision,p_rationale:v.rationale,p_idempotency_key:v.idempotencyKey},"decision");
}
export async function executeClientReferralReward(_previous:ReferralRewardActionState,form:FormData):Promise<ReferralRewardActionState>{
 const p=common.extend({approvalId:z.string().uuid()}).safeParse(Object.fromEntries(form.entries()));
 if(!p.success)return{status:"error",reason:"VALIDATION"};const v=p.data;
 return call(v.locale,"execute_client_referral_reward_v1",{p_approval_id:v.approvalId,p_idempotency_key:v.idempotencyKey},"execution");
}

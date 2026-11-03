"use server";
import{z}from"zod";
import{revalidatePath}from"next/cache";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import{classifyCommandFailure}from"@/modules/shared/lib/auth/command-failure";
import type{MemberBoxActionState}from"./model";
const base=z.object({locale:z.enum(["fr","ar"]),idempotencyKey:z.string().uuid()});
async function perform(name:string,args:Record<string,unknown>,expected:string,locale:string):Promise<MemberBoxActionState>{
 try{
  const client=await getSupabaseServerClient(),auth=await client.auth.getUser();
  if(auth.error)return{status:"error",reason:auth.error.status===401?"UNAUTHENTICATED":"FAILED"};
  if(!auth.data.user)return{status:"error",reason:"UNAUTHENTICATED"};
  const assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if(assurance.error)return{status:"error",reason:"FAILED"};
  if(assurance.data.currentLevel!=="aal2")return{status:"error",reason:"MFA_REQUIRED"};
  const result=await client.rpc(name,args);
  if(result.error)return{status:"error",reason:classifyCommandFailure(result.error)};
  if(!z.object({outcome:z.literal(expected),redemption_id:z.string().uuid()}).safeParse(result.data).success)return{status:"error",reason:"FAILED"};
  revalidatePath(`/${locale}/client/boxes/mon-enveloppe`);revalidatePath(`/${locale}/client/credits`);
  return{status:"success"};
 }catch{return{status:"error",reason:"FAILED"};}
}
export async function reserveMemberBoxBenefit(_previous:MemberBoxActionState,form:FormData):Promise<MemberBoxActionState>{
 const p=base.extend({boxId:z.string().uuid(),benefitId:z.string().uuid(),units:z.string().regex(/^[1-9]\d{0,17}$/u),expiresAt:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u)}).safeParse(Object.fromEntries(form.entries()));
 if(!p.success)return{status:"error",reason:"VALIDATION"};
 const date=new Date(`${p.data.expiresAt}:00Z`);if(Number.isNaN(date.getTime())||date.toISOString().slice(0,16)!==p.data.expiresAt)return{status:"error",reason:"VALIDATION"};
 return perform("reserve_my_box_benefit_v1",{p_customer_box_id:p.data.boxId,p_benefit_version_id:p.data.benefitId,p_units:p.data.units,p_reservation_expires_at:date.toISOString(),p_idempotency_key:p.data.idempotencyKey},"MEMBER_BOX_BENEFIT_RESERVED",p.data.locale);
}
export async function releaseMemberBoxReservation(_previous:MemberBoxActionState,form:FormData):Promise<MemberBoxActionState>{
 const p=base.extend({redemptionId:z.string().uuid(),rowVersion:z.string().regex(/^[1-9]\d{0,17}$/u),reason:z.string().trim().min(3).max(80)}).safeParse(Object.fromEntries(form.entries()));
 if(!p.success)return{status:"error",reason:"VALIDATION"};
 return perform("release_my_box_reservation_v1",{p_redemption_id:p.data.redemptionId,p_expected_row_version:p.data.rowVersion,p_reason:p.data.reason,p_idempotency_key:p.data.idempotencyKey},"MEMBER_BOX_RESERVATION_RELEASED",p.data.locale);
}

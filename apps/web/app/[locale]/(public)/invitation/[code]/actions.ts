"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
export type ClaimState={status:"idle"|"success"}|{status:"error";reason:"VALIDATION"|"DENIED"|"UNAVAILABLE"};
const input=z.object({locale:z.enum(["fr","ar"]),referralCode:z.string().regex(/^[A-Z0-9][A-Z0-9_-]{7,63}$/u),organizationId:z.string().uuid(),consent:z.literal("on"),idempotencyKey:z.string().uuid()});
export async function claimReferral(_previous:ClaimState,form:FormData):Promise<ClaimState>{
 const parsed=input.safeParse(Object.fromEntries(form.entries()));
 if(!parsed.success)return{status:"error",reason:"VALIDATION"};
 try{
  const client=await getSupabaseServerClient();const auth=await client.auth.getUser();
  if(auth.error||!auth.data.user)return{status:"error",reason:"DENIED"};
  const p=parsed.data;const response=await client.rpc("claim_client_referral_v1",{p_referral_code:p.referralCode,p_target_organization_id:p.organizationId,p_consent:true,p_idempotency_key:p.idempotencyKey});
  if(response.error)return{status:"error",reason:["42501","55000"].includes(response.error.code)?"DENIED":"UNAVAILABLE"};
  if(!z.object({outcome:z.literal("REFERRAL_REGISTERED"),referral_conversion_id:z.string().uuid()}).safeParse(response.data).success)return{status:"error",reason:"UNAVAILABLE"};
  revalidatePath(`/${p.locale}/client/recompenses`);return{status:"success"};
 }catch{return{status:"error",reason:"UNAVAILABLE"};}
}

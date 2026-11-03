"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
import type {RefundState} from "./model";
export async function manageBenefitRefund(_:RefundState,form:FormData):Promise<RefundState>{
 const t=(name:string)=>String(form.get(name)??"").trim();
 const input=z.object({locale:z.enum(["fr","ar"]),id:z.string().uuid(),org:z.string().uuid(),version:z.string().regex(/^[1-9]\d*$/u),key:z.string().uuid(),intent:z.enum(["request","approve","reject"]),reason:z.string().min(10).max(2000),confirmed:z.literal("yes")}).safeParse({locale:t("locale"),id:t("redemptionId"),org:t("organizationId"),version:t("rowVersion"),key:t("idempotencyKey"),intent:t("intent"),reason:t("reason"),confirmed:t("confirmed")});
 if(!input.success)return{status:"error",reason:"VALIDATION"};
 const v=input.data,c=await getSupabaseServerClient();const{data:auth}=await c.auth.getUser();if(!auth.user)return{status:"error",reason:"FORBIDDEN"};
 let name:string,args:Record<string,unknown>,outcome:NonNullable<RefundState["outcome"]>;
 if(v.intent==="request"){
  // The RPC scopes the exact redemption, including Buyer-owned Box allocations.
  name="request_benefit_refund_v1";args={p_organization_id:v.org,p_redemption_id:v.id,p_expected_row_version:v.version,p_reason:v.reason,p_idempotency_key:v.key};outcome="BENEFIT_REFUND_REQUESTED";
 }else{
  const review=z.object({id:z.string().uuid(),hash:z.string().regex(/^[a-f0-9]{64}$/u)}).safeParse({id:t("requestId"),hash:t("contentHash")});if(!review.success)return{status:"error",reason:"VALIDATION"};
  const q=await c.from("benefit_refund_requests_v1").select("id,redemption_id,organization_id").eq("id",review.data.id).eq("redemption_id",v.id).eq("organization_id",v.org).maybeSingle();
  if(q.error||!z.object({id:z.literal(review.data.id),redemption_id:z.literal(v.id),organization_id:z.literal(v.org)}).safeParse(q.data).success)return{status:"error",reason:"FORBIDDEN"};
  name="decide_benefit_refund_v1";args={p_request_id:review.data.id,p_expected_hash:review.data.hash,p_approve:v.intent==="approve",p_reason:v.reason,p_idempotency_key:v.key};outcome=v.intent==="approve"?"BENEFIT_REFUNDED":"BENEFIT_REFUND_REJECTED";
 }
 const r=await c.rpc(name,args);
 if(r.error){const message=r.error.message??"";return{status:"error",reason:r.error.code==="42501"?"FORBIDDEN":r.error.code==="40001"?"STALE":/EXPIRED|ELAPSED/u.test(message)?"EXPIRED":/POLICY|ATTRIBUTION|BOOK_CLOSED|FUNDING/u.test(message)?"POLICY":"FAILED"};}
 if(!z.object({outcome:z.literal(outcome),redemption_id:z.literal(v.id)}).safeParse(r.data).success)return{status:"error",reason:"FAILED"};
 for(const path of[`/${v.locale}/client/avantages/remboursements`,`/${v.locale}/administration/avantages/remboursements`,`/${v.locale}/client/credits`,`/${v.locale}/client/boxes`,`/${v.locale}/client/avantages/livraisons`])revalidatePath(path);
 return{status:"success",outcome};
}

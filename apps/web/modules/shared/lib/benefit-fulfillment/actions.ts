"use server";
import {z}from"zod";
import {revalidatePath}from"next/cache";
import {getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import{fulfillmentOutcomes,type FulfillmentState}from"./model";
import{parseBenefitSchedule}from"./time";
export async function manageBenefitFulfillment(_:FulfillmentState,form:FormData):Promise<FulfillmentState>{
 const t=(name:string)=>String(form.get(name)??"").trim();
 const input=z.object({locale:z.enum(["fr","ar"]),id:z.string().uuid(),org:z.string().uuid(),version:z.string().regex(/^[1-9]\d*$/u),key:z.string().uuid(),intent:z.enum(["schedule","start","report","accept","reject","consume"]),confirmed:z.literal("yes")}).safeParse({locale:t("locale"),id:t("redemptionId"),org:t("organizationId"),version:t("rowVersion"),key:t("idempotencyKey"),intent:t("intent"),confirmed:t("confirmed")});
 if(!input.success)return{status:"error",reason:"VALIDATION"};
 const v=input.data,c=await getSupabaseServerClient();const{data:auth}=await c.auth.getUser();if(!auth.user)return{status:"error",reason:"FORBIDDEN"};
 const target=await c.from("benefit_redemptions").select("id,status,organization_id,delivery_proof_hash").eq("id",v.id).eq("organization_id",v.org).maybeSingle();
 const targetValue=z.object({id:z.literal(v.id),organization_id:z.literal(v.org),status:z.string(),delivery_proof_hash:z.string().nullable()}).safeParse(target.data);
 if(target.error||!targetValue.success)return{status:"error",reason:"FORBIDDEN"};
 let name:string,args:Record<string,unknown>,expected:(typeof fulfillmentOutcomes)[number];
 if(v.intent==="consume"){
  const checked=z.object({status:z.enum(["DELIVERED","CONSUMED"]),delivery_proof_hash:z.string().regex(/^[a-f0-9]{64}$/u)}).safeParse(targetValue.data);
  if(!checked.success)return{status:"error",reason:"PENDING"};
  name="consume_benefit_credits";args={p_redemption_id:v.id,p_delivery_proof_hash:checked.data.delivery_proof_hash,p_idempotency_key:v.key};expected="BENEFIT_CONSUMED";
 }else if(v.intent==="schedule"||v.intent==="start"){
  const reason=z.string().min(10).max(2000).safeParse(t("reason")),date=v.intent==="schedule"?parseBenefitSchedule(t("scheduledFor")):null;
  if(!reason.success||(v.intent==="schedule"&&!date))return{status:"error",reason:"VALIDATION"};
  name="advance_benefit_fulfillment_v1";args={p_redemption_id:v.id,p_expected_row_version:v.version,p_action:v.intent==="schedule"?"SCHEDULE":"START",p_scheduled_for:date,p_reason:reason.data,p_idempotency_key:v.key};expected=v.intent==="schedule"?"BENEFIT_SCHEDULED":"BENEFIT_STARTED";
 }else if(v.intent==="report"){
  const report=z.object({summary:z.string().min(20).max(10000),reference:z.string().min(3).max(2000)}).safeParse({summary:t("summary"),reference:t("reference")});if(!report.success)return{status:"error",reason:"VALIDATION"};
  name="propose_benefit_delivery_v1";args={p_redemption_id:v.id,p_expected_row_version:v.version,p_summary:report.data.summary,p_service_reference:report.data.reference,p_completed_at:null,p_idempotency_key:v.key};expected="BENEFIT_DELIVERY_REVIEW_REQUIRED";
 }else{
  const receipt=z.object({id:z.string().uuid(),hash:z.string().regex(/^[a-f0-9]{64}$/u),reason:z.string().min(10).max(2000)}).safeParse({id:t("proposalId"),hash:t("sourceHash"),reason:t("reason")});if(!receipt.success)return{status:"error",reason:"VALIDATION"};
  const proposal=await c.from("benefit_delivery_proposals_v1").select("id,redemption_id,organization_id").eq("id",receipt.data.id).eq("redemption_id",v.id).eq("organization_id",v.org).maybeSingle();
  if(proposal.error||!z.object({id:z.literal(receipt.data.id),redemption_id:z.literal(v.id),organization_id:z.literal(v.org)}).safeParse(proposal.data).success)return{status:"error",reason:"FORBIDDEN"};
  name="decide_my_benefit_delivery_v1";args={p_proposal_id:receipt.data.id,p_expected_source_hash:receipt.data.hash,p_expected_row_version:v.version,p_accept:v.intent==="accept",p_reason:receipt.data.reason,p_idempotency_key:v.key};expected=v.intent==="accept"?"BENEFIT_DELIVERY_ACCEPTED":"BENEFIT_DELIVERY_REJECTED";
 }
 const result=await c.rpc(name,args);if(result.error){const message=result.error.message??"";return{status:"error",reason:result.error.code==="42501"?"FORBIDDEN":result.error.code==="40001"?"STALE":/FUNDING|FINANCIAL_HOLD|RESERVATION_EXPIRED/u.test(message)?"FUNDING":result.error.code==="55000"?"PENDING":"FAILED"};}
 if(!z.object({outcome:z.literal(expected),redemption_id:z.literal(v.id)}).safeParse(result.data).success)return{status:"error",reason:"FAILED"};
 for(const path of[`/${v.locale}/administration/avantages/livraisons`,`/${v.locale}/client/avantages/livraisons`,`/${v.locale}/client/credits`])revalidatePath(path);
 return{status:"success",outcome:expected};
}

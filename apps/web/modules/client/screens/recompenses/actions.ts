"use server";
import{classifyAuthReadFailure}from"@/modules/shared/lib/auth/read-failure";import{z}from"zod";import{moneyToMinor}from"@/modules/client/data/portfolio/model";import{revalidatePath}from"next/cache";import{isLocale}from"@/modules/shared/lib/i18n/locale";import{actualDocumentInput,baselineDecisionInput,baselineDocumentInput,referralLinkInput}from"@/modules/shared/lib/rewards-referrals-roi/model";import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
export type ValueActionState={status:"idle"}|{status:"success";outcome:string}|{status:"error";reason:"VALIDATION"|"UNAUTHENTICATED"|"FORBIDDEN"|"AAL2_REQUIRED"|"CONFLICT"|"FAILED"};
const output=z.object({outcome:z.string()}).passthrough(),text=(f:FormData,k:string)=>String(f.get(k)??"");
async function rpc(name:string,args:Record<string,unknown>,locale:string):Promise<ValueActionState>{const c=await getSupabaseServerClient(),{data}=await c.auth.getUser();if(!data.user)return{status:"error",reason:"UNAUTHENTICATED"};const result=await c.rpc(name,args);if(result.error){const message=result.error.message??"";if(result.error.code==="42501"&&/AAL|MFA/i.test(message))return{status:"error",reason:"AAL2_REQUIRED"};if(result.error.code==="42501")return{status:"error",reason:"FORBIDDEN"};if(["23505","23514","40001","55000"].includes(result.error.code??"")||/STALE|IDEMPOTENCY|DUAL_CONTROL|APPROVED/i.test(message))return{status:"error",reason:"CONFLICT"};return{status:"error",reason:"FAILED"}}const parsed=output.safeParse(result.data);if(!parsed.success)return{status:"error",reason:"FAILED"};revalidatePath(`/${locale}/client/recompenses`);return{status:"success",outcome:parsed.data.outcome}}
function localeOf(f:FormData){const locale=text(f,"uiLocale");return isLocale(locale)?locale:null}
export async function createReferralLink(_:ValueActionState,f:FormData){const locale=localeOf(f);let expiresAt="";try{expiresAt=new Date(text(f,"expiresAt")).toISOString()}catch{return{status:"error",reason:"VALIDATION"}as const}const p=referralLinkInput.safeParse({organizationId:text(f,"organizationId"),referralCode:text(f,"referralCode").toUpperCase(),audienceType:text(f,"audienceType"),campaignReference:text(f,"campaignReference"),expiresAt,maxConversions:text(f,"maxConversions"),idempotencyKey:text(f,"idempotencyKey")});if(!locale||!p.success)return{status:"error",reason:"VALIDATION"}as const;const v=p.data;return rpc("create_referral_link",{p_source_organization_id:v.organizationId,p_referral_code:v.referralCode,p_audience_type:v.audienceType,p_campaign_reference:v.campaignReference,p_expires_at:v.expiresAt,p_max_conversions:v.maxConversions,p_idempotency_key:v.idempotencyKey},locale)}
export async function submitBaseline(_:ValueActionState,f:FormData):Promise<ValueActionState>{
 const locale=localeOf(f),p=baselineDocumentInput.safeParse(Object.fromEntries([...f.keys()].map(key=>[key,text(f,key)])));
 if(!locale||!p.success)return{status:"error",reason:"VALIDATION"};const v=p.data,amount=moneyToMinor(v.amount,v.currency),[subjectType,subjectId]=v.subjectChoice.split(":");
 if(amount===null||!z.string().uuid().safeParse(subjectId).success)return{status:"error",reason:"VALIDATION"};
 return rpc("capture_client_baseline_with_document_v1",{p_organization_id:v.organizationId,p_subject_type:subjectType,p_subject_id:subjectId,p_metric_code:v.metricCode,p_baseline_amount_minor:amount,p_currency:v.currency,p_period_start:v.periodStart,p_period_end:v.periodEnd,p_source_type:v.sourceType,p_source_reference:v.sourceReference,p_document_id:v.documentId,p_methodology_version:v.methodologyVersion,p_idempotency_key:v.idempotencyKey},locale);
}
export async function decideBaseline(_:ValueActionState,f:FormData){const locale=localeOf(f),p=baselineDecisionInput.safeParse({submissionId:text(f,"submissionId"),decision:text(f,"decision"),rationale:text(f,"rationale"),idempotencyKey:text(f,"idempotencyKey")});if(!locale||!p.success)return{status:"error",reason:"VALIDATION"}as const;return rpc("decide_measurement_baseline",{p_submission_id:p.data.submissionId,p_decision:p.data.decision,p_rationale:p.data.rationale,p_idempotency_key:p.data.idempotencyKey},locale)}
function actualInput(f:FormData){return actualDocumentInput.safeParse({recommendationId:text(f,"recommendationId")||undefined,baselineId:text(f,"baselineId"),amount:text(f,"amount"),cost:text(f,"cost")||undefined,periodStart:text(f,"actualPeriodStart"),periodEnd:text(f,"actualPeriodEnd"),sourceType:text(f,"actualSourceType"),sourceReference:text(f,"actualSourceReference"),documentId:text(f,"documentId"),formulaVersion:text(f,"formulaVersion").toUpperCase(),idempotencyKey:text(f,"idempotencyKey")});}
/** Approved baseline IDs are immutable; their currency is the sole unit authority. */
async function verifiedBaselineCurrency(baselineId:string):Promise<{status:"success";currency:string}|{status:"error";reason:"UNAUTHENTICATED"|"FORBIDDEN"|"FAILED"}>{
 try{
  const client=await getSupabaseServerClient(),auth=await client.auth.getUser();
  const authFailure=classifyAuthReadFailure(auth.error);
  if(authFailure)return{status:"error",reason:authFailure==="UNAUTHENTICATED"?"UNAUTHENTICATED":"FAILED"};
  if(!auth.data.user)return{status:"error",reason:"UNAUTHENTICATED"};
  const response=await client.from("measurement_baselines").select("currency").eq("id",baselineId).eq("verification_status","VERIFIED").maybeSingle();
  if(response.error)return{status:"error",reason:response.error.code==="42501"?"FORBIDDEN":"FAILED"};
  if(!response.data)return{status:"error",reason:"FORBIDDEN"};
  const row=z.object({currency:z.string().regex(/^[A-Z]{3}$/u)}).safeParse(response.data);
  return row.success?{status:"success",currency:row.data.currency}:{status:"error",reason:"FAILED"};
 }catch{return{status:"error",reason:"FAILED"};}
}
export async function calculateRoi(_:ValueActionState,f:FormData):Promise<ValueActionState>{
 const locale=localeOf(f),p=actualInput(f);if(!locale||!p.success)return{status:"error",reason:"VALIDATION"};
 const v=p.data,currency=await verifiedBaselineCurrency(v.baselineId);
 if(currency.status==="error")return currency;
 const amount=moneyToMinor(v.amount,currency.currency),cost=moneyToMinor(v.cost??"",currency.currency);
 if(amount===null||cost===null||BigInt(cost)<=BigInt(0)||!v.recommendationId)return{status:"error",reason:"VALIDATION"};
 return rpc("calculate_client_roi_with_document_v1",{p_recommendation_id:v.recommendationId,p_baseline_id:v.baselineId,p_actual_amount_minor:amount,p_implementation_cost_minor:cost,p_actual_period_start:v.periodStart,p_actual_period_end:v.periodEnd,p_actual_source_type:v.sourceType,p_actual_source_reference:v.sourceReference,p_document_id:v.documentId,p_formula_version:v.formulaVersion,p_idempotency_key:v.idempotencyKey},locale);
}
export async function recordSavings(_:ValueActionState,f:FormData):Promise<ValueActionState>{
 const locale=localeOf(f),p=actualInput(f);if(!locale||!p.success)return{status:"error",reason:"VALIDATION"};const v=p.data,currency=await verifiedBaselineCurrency(v.baselineId);if(currency.status==="error")return currency;const amount=moneyToMinor(v.amount,currency.currency);if(amount===null)return{status:"error",reason:"VALIDATION"};
 return rpc("record_client_savings_with_document_v1",{p_baseline_id:v.baselineId,p_actual_amount_minor:amount,p_actual_period_start:v.periodStart,p_actual_period_end:v.periodEnd,p_source_type:v.sourceType,p_source_reference:v.sourceReference,p_document_id:v.documentId,p_formula_version:v.formulaVersion,p_idempotency_key:v.idempotencyKey},locale);
}
export async function advanceReferral(_:ValueActionState,f:FormData):Promise<ValueActionState>{
 const locale=localeOf(f),p=z.object({conversionId:z.string().uuid(),toStage:z.enum(["PROFILE_STARTED","VERIFIED","ACTIVE"]),documentId:z.string().uuid(),expectedRowVersion:z.coerce.number().int().positive(),idempotencyKey:z.string().uuid()}).safeParse(Object.fromEntries([...f.keys()].map(key=>[key,text(f,key)])));
 if(!locale||!p.success)return{status:"error",reason:"VALIDATION"};const v=p.data;
 return rpc("advance_client_referral_with_document_v1",{p_conversion_id:v.conversionId,p_to_stage:v.toStage,p_document_id:v.documentId,p_expected_row_version:v.expectedRowVersion,p_idempotency_key:v.idempotencyKey},locale);
}

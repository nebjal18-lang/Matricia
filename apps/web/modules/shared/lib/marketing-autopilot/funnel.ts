import {createHash} from "node:crypto";
import {cookies} from "next/headers";
import {MARKETING_TOUCH_COOKIE,marketingTouchVisitorHash,verifyMarketingTouch,type MarketingFunnelEvent} from "./funnel-touch";
async function captureVerifiedTouch():Promise<{touchId:string}|null>{
 try{
  const secret=process.env.MARKETING_CTA_SIGNING_SECRET??"";
  const touch=verifyMarketingTouch((await cookies()).get(MARKETING_TOUCH_COOKIE)?.value,secret);if(!touch)return null;
  const{getSupabaseServerClient}=await import("@/modules/shared/lib/supabase/server");const{data:auth}=await(await getSupabaseServerClient()).auth.getUser();if(!auth.user)return null;
  const{getSupabaseAdminClient}=await import("@/modules/shared/lib/supabase/admin");
  const result=await getSupabaseAdminClient().rpc("register_verified_marketing_touch_v2",{p_actor_user_id:auth.user.id,p_organization_id:touch.organizationId,p_campaign_id:touch.campaignId,p_content_id:touch.contentId,p_source:touch.source,p_medium:touch.medium,p_visitor_hash:marketingTouchVisitorHash(touch.nonce,secret),p_expires_at:new Date(touch.expiresAt).toISOString()});
  const id=(result.data as{touch_id?:unknown}|null)?.touch_id;
  return!result.error&&typeof id==="string"&&/^[0-9a-f-]{36}$/iu.test(id)?{touchId:id}:null;
 }catch{return null}
}
/** Persist the verified touch before the business command; its durable fact can then resume without browser cookies. */
export async function captureMarketingFunnelTouch():Promise<boolean>{return(await captureVerifiedTouch())!==null}
/** Business facts and consent are verified in SQL. A browser action can never report a signed contract or monetary value. */
export async function recordMarketingFunnelEvent(event:MarketingFunnelEvent,subjectId:string,economicValueMinor:string|null=null):Promise<boolean>{
 if(economicValueMinor!==null||event==="CONTRACT_SIGNED"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(subjectId))return false;
 try{
  const touch=await captureVerifiedTouch();if(!touch)return false;
  const{getSupabaseAdminClient}=await import("@/modules/shared/lib/supabase/admin");
  const result=await getSupabaseAdminClient().rpc("record_marketing_business_conversion_v2",{p_event_type:event,p_source_id:subjectId,p_touch_id:touch.touchId,p_idempotency_key:`business-funnel:${createHash("sha256").update(`${event}\0${subjectId}`).digest("hex")}`});
  return!result.error&&["MARKETING_BUSINESS_ATTRIBUTED","MARKETING_BUSINESS_DEDUPLICATED"].includes(String((result.data as{outcome?:unknown}|null)?.outcome));
 }catch{return false}
}

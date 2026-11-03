"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
import type {NotificationEditorState} from "./model";
export async function manageNotificationTemplate(_:NotificationEditorState,form:FormData):Promise<NotificationEditorState>{
 const t=(key:string)=>String(form.get(key)??"").trim();
 const common=z.object({locale:z.enum(["fr","ar"]),key:z.string().uuid()}).safeParse({locale:t("locale"),key:t("idempotencyKey")});
 if(!common.success)return{status:"error",reason:"VALIDATION"};
 let rpc:string,args:Record<string,unknown>;
 if(["preview","propose"].includes(t("intent"))){
  const value=z.object({code:z.string().min(3).max(100),hash:z.string().regex(/^[a-f0-9]{64}$/u),frSubject:z.string().min(2).max(240),frBody:z.string().min(2).max(4000),arSubject:z.string().min(2).max(240),arBody:z.string().min(2).max(4000)}).safeParse({code:t("templateCode"),hash:t("sourcePairHash"),frSubject:t("frSubject"),frBody:t("frBody"),arSubject:t("arSubject"),arBody:t("arBody")});
  if(!value.success)return{status:"error",reason:"VALIDATION"};
  args={p_template_code:value.data.code,p_expected_pair_hash:value.data.hash,p_translations:{"fr-MA":{subject:value.data.frSubject,body:value.data.frBody},"ar-MA":{subject:value.data.arSubject,body:value.data.arBody}}};
  if(t("intent")==="preview"){
   const variables:Record<string,string>={};for(const[key,value]of form.entries())if(key.startsWith("variable:"))variables[key.slice(9)]=String(value);
   rpc="preview_notification_template_pair_v1";args.p_variables=variables;
  }else{
   const reason=z.string().min(10).max(2000).safeParse(t("reason"));if(!reason.success||form.get("authorConfirmed")!=="on")return{status:"error",reason:"VALIDATION"};
   rpc="propose_notification_template_pair_v1";args={...args,p_reason:reason.data,p_production_authorization_reference:t("productionReference")||null,p_idempotency_key:common.data.key};
  }
 }else if(t("intent")==="fulfil"){
  const value=z.object({id:z.string().uuid(),proposal:z.string().uuid(),reason:z.string().min(10).max(2000),confirmed:z.literal("on")}).safeParse({id:t("actionId"),proposal:t("proposalId"),reason:t("reason"),confirmed:t("fulfilConfirmed")});if(!value.success)return{status:"error",reason:"VALIDATION"};
  rpc="fulfil_notification_template_review_v1";args={p_action_request_id:value.data.id,p_proposal_id:value.data.proposal,p_reason:value.data.reason};
 }else{
  const value=z.object({id:z.string().uuid(),hash:z.string().regex(/^[a-f0-9]{64}$/u),decision:z.enum(["approve","reject"]),reason:z.string().min(10).max(2000)}).safeParse({id:t("proposalId"),hash:t("contentHash"),decision:t("intent"),reason:t("reason")});
  if(!value.success||(value.data.decision==="approve"&&form.get("reviewConfirmed")!=="on"))return{status:"error",reason:"VALIDATION"};
  rpc="decide_notification_template_pair_v1";args={p_proposal_id:value.data.id,p_expected_content_hash:value.data.hash,p_approve:value.data.decision==="approve",p_review_confirmed:form.get("reviewConfirmed")==="on",p_reason:value.data.reason,p_idempotency_key:common.data.key};
 }
 const client=await getSupabaseServerClient();const{data:auth}=await client.auth.getUser();if(!auth.user)return{status:"error",reason:"FORBIDDEN"};
 const result=await client.rpc(rpc,args);if(result.error)return{status:"error",reason:result.error.code==="40001"?"STALE":result.error.code==="42501"?"FORBIDDEN":result.error.code==="22023"?"VALIDATION":"FAILED"};
 if(rpc==="preview_notification_template_pair_v1"){
  const parsed=z.object({outcome:z.literal("NOTIFICATION_TEMPLATE_PREVIEW"),delivery_sent:z.literal(false),rendered:z.array(z.object({locale:z.string(),subject:z.string(),body:z.string(),cta_path:z.string().nullable()}))}).safeParse(result.data);
  return parsed.success?{status:"success",reason:parsed.data.outcome,rendered:parsed.data.rendered}:{status:"error",reason:"FAILED"};
 }
 const parsed=z.object({outcome:z.enum(["NOTIFICATION_TEMPLATE_PAIR_PROPOSED","NOTIFICATION_TEMPLATE_PAIR_ACTIVATED","NOTIFICATION_TEMPLATE_PAIR_REJECTED","NOTIFICATION_TEMPLATE_PAIR_APPROVAL_RECORDED","NOTIFICATION_TEMPLATE_REVIEW_FULFILLED"])}).safeParse(result.data);if(!parsed.success)return{status:"error",reason:"FAILED"};
 revalidatePath(`/${common.data.locale}/administration/notifications/modeles`);return{status:"success",reason:parsed.data.outcome};
}

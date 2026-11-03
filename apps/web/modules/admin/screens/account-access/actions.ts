"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { accountAction, type AccountAccessState } from "./model";
export async function manageAccountAccess(_:AccountAccessState,form:FormData):Promise<AccountAccessState>{
 const value=(key:string)=>String(form.get(key)??"").trim();
 const common=z.object({locale:z.enum(["fr","ar"]),user:z.string().uuid(),hash:z.string().regex(/^[a-f0-9]{64}$/u),reason:z.string().min(10).max(2000)}).safeParse({locale:value("locale"),user:value("userId"),hash:value("sourceHash"),reason:value("reason")});
 if(!common.success||form.get("confirmed")!=="on")return{status:"error",reason:"INVALID"};
 const environment=process.env.APP_ENV?.toUpperCase();
 if(!environment||!["DEVELOPMENT","STAGING","PRODUCTION"].includes(environment))return{status:"error",reason:"ENVIRONMENT"};
 let rpc:string,args:Record<string,unknown>;
 if(value("intent")==="request"){
  const parsed=z.object({action:accountAction,key:z.string().min(8).max(200),role:z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/u).or(z.literal(""))}).safeParse({action:value("action"),key:value("idempotencyKey"),role:value("roleCode")});
  if(!parsed.success)return{status:"error",reason:"INVALID"};
  const needsRole=parsed.data.action==="GRANT_PLATFORM_ROLE"||parsed.data.action==="REVOKE_PLATFORM_ROLE";
  if(needsRole&&!parsed.data.role)return{status:"error",reason:"INVALID"};
  rpc="request_platform_account_change_v1";args={p_target_user_id:common.data.user,p_action:parsed.data.action,p_role_code:needsRole?parsed.data.role:null,p_expected_source_hash:common.data.hash,p_reason:common.data.reason,p_idempotency_key:parsed.data.key,p_application_environment:environment,p_production_authorization_reference:value("productionAuthorizationReference")||null};
 }else{
  const parsed=z.object({id:z.string().uuid(),intent:z.enum(["approve","reject"])}).safeParse({id:value("requestId"),intent:value("intent")});
  if(!parsed.success)return{status:"error",reason:"INVALID"};
  rpc="decide_platform_account_change_v1";args={p_request_id:parsed.data.id,p_approve:parsed.data.intent==="approve",p_expected_source_hash:common.data.hash,p_reason:common.data.reason,p_application_environment:environment,p_expected_target_user_id:common.data.user};
 }
 const client=await getSupabaseServerClient();const{data:auth}=await client.auth.getUser();if(!auth.user)return{status:"error",reason:"FORBIDDEN"};
 const response=await client.rpc(rpc,args);
 if(response.error){const message=response.error.message??"";return{status:"error",reason:message.includes("LAST_SUPER_ADMIN")?"LAST_ADMIN":message.includes("MEMBERSHIP_REVIEW")?"MEMBERSHIP":message.includes("ENVIRONMENT")||message.includes("PRODUCTION_AUTHORIZATION")?"ENVIRONMENT":response.error.code==="40001"?"CONFLICT":response.error.code==="42501"?"FORBIDDEN":"FAILED"};}
 const expected=rpc==="request_platform_account_change_v1"?"ACCOUNT_CHANGE_REQUESTED":value("intent")==="approve"?"ACCOUNT_CHANGE_EXECUTED":"ACCOUNT_CHANGE_REJECTED";
 const parsed=z.object({outcome:z.literal(expected),request_id:z.string().uuid()}).safeParse(response.data);
 if(!parsed.success)return{status:"error",reason:"FAILED"};
 revalidatePath(`/${common.data.locale}/administration/utilisateurs`);
 revalidatePath(`/${common.data.locale}/administration/utilisateurs/${common.data.user}`);
 revalidatePath(`/${common.data.locale}/administration/utilisateurs/${common.data.user}/roles`);
 revalidatePath(`/${common.data.locale}/administration/utilisateurs/acces`);
 return{status:"success",outcome:parsed.data.outcome};
}

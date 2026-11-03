"use server";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {loadMyPlatformAccess,hasPlatformRole} from "@/modules/shared/lib/account-security/platform-access";
export type SubscriptionCreditRetryState={status:"idle"|"success"|"error"};
export async function submitSubscriptionCreditRetry(_previous:SubscriptionCreditRetryState,form:FormData):Promise<SubscriptionCreditRetryState>{
 const access=await loadMyPlatformAccess();if(access.status!=="ok"||!access.requirementSatisfied||!hasPlatformRole(access.roles,["SUPER_ADMIN","FINANCE_MANAGER"]))return{status:"error"};
 const input=z.object({locale:z.enum(["fr","ar"]),action:z.enum(["request","approve","reject"]),id:z.string().uuid(),sourceHash:z.string().regex(/^[a-f0-9]{64}$/u)}).safeParse(Object.fromEntries(form));if(!input.success)return{status:"error"};
 const value=input.data;let result;
 if(value.action==="request"){
  const details=z.object({reason:z.string().trim().min(10).max(1000),key:z.string().uuid()}).safeParse(Object.fromEntries(form));if(!details.success)return{status:"error"};
  result=await access.client.rpc("request_subscription_credit_retry_v1",{p_job_id:value.id,p_expected_source_hash:value.sourceHash,p_reason:details.data.reason,p_idempotency_key:details.data.key});
 }else result=await access.client.rpc("review_subscription_credit_retry_v1",{p_request_id:value.id,p_expected_source_hash:value.sourceHash,p_approve:value.action==="approve"});
 if(result.error||!z.object({outcome:z.enum(["SC_RETRY_REQUESTED","SC_RETRY_REVIEWED"])}).safeParse(result.data).success)return{status:"error"};
 revalidatePath(`/${value.locale}/administration/operations`);return{status:"success"};
}

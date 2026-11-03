import {z}from"zod";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import{classifyAuthReadFailure}from"@/modules/shared/lib/auth/read-failure";
import type{MessagingResult}from"@/modules/shared/lib/internal-messaging/repository";
export async function findProviderObjectThread(rfqId:string,organizationId:string):Promise<MessagingResult<string|null>>{
 const input=z.object({rfqId:z.string().uuid(),organizationId:z.string().uuid()}).safeParse({rfqId,organizationId});
 if(!input.success)return{status:"error",reason:"INVALID_RESPONSE"};
 const client=await getSupabaseServerClient(),auth=await client.auth.getUser(),failure=classifyAuthReadFailure(auth.error);
 if(failure||!auth.data.user)return{status:"error",reason:failure??"UNAUTHENTICATED"};
 const result=await client.rpc("find_provider_rfq_message_thread_v1",{p_rfq_id:input.data.rfqId,p_organization_id:input.data.organizationId});
 if(result.error)return{status:"error",reason:result.error.code==="42501"?"FORBIDDEN":"UNAVAILABLE"};
 const parsed=z.string().uuid().nullable().safeParse(result.data);
 return parsed.success?{status:"success",value:parsed.data}:{status:"error",reason:"INVALID_RESPONSE"};
}

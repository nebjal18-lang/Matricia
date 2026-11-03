"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { loadFranchiseLibraryWorkspace } from "@/modules/franchise/data/library/workspace";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { openThreadPayload,sendMessagePayload,threadPayload } from "@/modules/shared/lib/internal-messaging/model";
const scope=z.object({locale:z.enum(["fr","ar"]),organizationId:z.string().uuid(),franchiseId:z.string().uuid(),idempotencyKey:z.string().uuid()});
const open=scope.extend({target:z.string(),subject:z.string().trim().min(3).max(160)});
const send=scope.extend({threadId:z.string().uuid(),body:z.string().trim().min(1).max(4000)});
export type MessageState={status:"idle"}|{status:"success"}|{status:"error";reason:"VALIDATION"|"FORBIDDEN"|"UNAVAILABLE"};
async function workspace(input:z.infer<typeof scope>){
 const result=await loadFranchiseLibraryWorkspace({locale:input.locale,organizationId:input.organizationId,franchiseId:input.franchiseId});
 return result.status==="success"&&result.workspace.mandate.franchiseId===input.franchiseId;
}
export async function openFranchiseMessageAction(_state:MessageState,form:FormData):Promise<MessageState>{
 const parsed=open.safeParse(Object.fromEntries(form));if(!parsed.success)return{status:"error",reason:"VALIDATION"};const input=parsed.data;
 const target=z.tuple([z.string().uuid(),z.string().uuid()]).safeParse(input.target.split(":"));if(!target.success)return{status:"error",reason:"VALIDATION"};
 if(!await workspace(input))return{status:"error",reason:"FORBIDDEN"};
 const client=await getSupabaseServerClient();const response=await client.rpc("open_franchise_rfq_message_thread",{p_franchise_id:input.franchiseId,p_rfq_id:target.data[0],p_counterparty_organization_id:target.data[1],p_subject:input.subject,p_idempotency_key:input.idempotencyKey});
 if(response.error)return{status:"error",reason:response.error.code==="42501"?"FORBIDDEN":response.error.code==="22023"?"VALIDATION":"UNAVAILABLE"};
 const result=openThreadPayload.safeParse(response.data);if(!result.success)return{status:"error",reason:"UNAVAILABLE"};
 revalidatePath(`/${input.locale}/franchise/messages`);revalidatePath(`/${input.locale}/messagerie`);
 redirect(`/${input.locale}/franchise/messages?organizationId=${input.organizationId}&franchiseId=${input.franchiseId}&fil=${result.data.thread_id}`);
}
export async function sendFranchiseMessageAction(_state:MessageState,form:FormData):Promise<MessageState>{
 const parsed=send.safeParse(Object.fromEntries(form));if(!parsed.success)return{status:"error",reason:"VALIDATION"};const input=parsed.data;
 if(!await workspace(input))return{status:"error",reason:"FORBIDDEN"};
 const client=await getSupabaseServerClient();const conversation=await client.rpc("get_internal_message_thread",{p_thread_id:input.threadId,p_limit:1});
 const current=threadPayload.safeParse(conversation.data);
 if(conversation.error||!current.success||current.data.thread.franchise_id!==input.franchiseId||current.data.thread.participant_kind!=="FRANCHISE"||current.data.thread.participant_organization_id!==input.organizationId)return{status:"error",reason:"FORBIDDEN"};
 const response=await client.rpc("send_internal_message",{p_thread_id:input.threadId,p_sender_organization_id:input.organizationId,p_body:input.body,p_attachments:[],p_idempotency_key:input.idempotencyKey});
 if(response.error)return{status:"error",reason:response.error.code==="42501"?"FORBIDDEN":response.error.code==="22023"?"VALIDATION":"UNAVAILABLE"};
 if(!sendMessagePayload.safeParse(response.data).success)return{status:"error",reason:"UNAVAILABLE"};
 revalidatePath(`/${input.locale}/franchise/messages`);revalidatePath(`/${input.locale}/messagerie`);return{status:"success"};
}

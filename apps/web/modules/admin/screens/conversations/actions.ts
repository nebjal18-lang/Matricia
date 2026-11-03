"use server";
import{z}from"zod";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import{conversationPageSchema,type ConversationPage}from"./model";
export async function loadAdminConversationPage(threadId:string,cursor?:{at:string;id:string}|null):Promise<{status:"success";page:ConversationPage}|{status:"error"}>{
 const input=z.object({threadId:z.string().uuid(),cursor:z.object({at:z.string().datetime({offset:true}),id:z.string().uuid()}).nullish()}).safeParse({threadId,cursor});if(!input.success)return{status:"error"};
 const c=await getSupabaseServerClient();const r=await c.rpc("get_admin_thread_message_page_v1",{p_thread_id:input.data.threadId,p_before_at:input.data.cursor?.at??null,p_before_id:input.data.cursor?.id??null,p_limit:100});const p=conversationPageSchema.safeParse(r.data);return!r.error&&p.success?{status:"success",page:p.data}:{status:"error"};
}

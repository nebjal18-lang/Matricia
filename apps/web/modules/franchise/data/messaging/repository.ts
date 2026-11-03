import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { inboxPayload,threadPagePayload,type MessageCursor } from "@/modules/shared/lib/internal-messaging/model";
const targets=z.array(z.object({rfq_id:z.string().uuid(),organization_id:z.string().uuid(),kind:z.enum(["CLIENT","PROVIDER"])}));
export async function loadFranchiseMessaging(input:{franchiseId:string;threadId?:string;search?:string;page?:number;cursor?:MessageCursor}){
 const client=await getSupabaseServerClient();
 const [inboxResult,targetsResult,conversationResult]=await Promise.all([
  client.rpc("search_franchise_message_inbox",{p_franchise_id:input.franchiseId,p_search:input.search??"",p_page:input.page??1}),
  client.rpc("franchise_message_counterparties",{p_franchise_id:input.franchiseId}),
  input.threadId?client.rpc("get_internal_message_thread_page",{p_thread_id:input.threadId,p_before_created_at:input.cursor?.createdAt??null,p_before_message_id:input.cursor?.id??null,p_page_size:50}):Promise.resolve({data:null,error:null}),
 ]);
 if(inboxResult.error||targetsResult.error||conversationResult.error)return{status:"error"as const};
 const inbox=z.object({inbox:inboxPayload,total:z.number().int().nonnegative(),page:z.number().int().positive(),pageSize:z.literal(25)}).safeParse(inboxResult.data),options=targets.safeParse(targetsResult.data);
 if(!inbox.success||!options.success)return{status:"error"as const};
 if(inbox.data.inbox.some((thread)=>thread.franchise_id!==input.franchiseId))return{status:"error"as const};
 if(!input.threadId)return{status:"success"as const,inbox:inbox.data.inbox,total:inbox.data.total,page:inbox.data.page,pageSize:inbox.data.pageSize,options:options.data,conversation:null};
 const conversation=threadPagePayload.safeParse(conversationResult.data);
 if(!conversation.success||conversation.data.thread.franchise_id!==input.franchiseId||conversation.data.thread.participant_kind!=="FRANCHISE")return{status:"error"as const};
 return{status:"success"as const,inbox:inbox.data.inbox,total:inbox.data.total,page:inbox.data.page,pageSize:inbox.data.pageSize,options:options.data,conversation:conversation.data};
}

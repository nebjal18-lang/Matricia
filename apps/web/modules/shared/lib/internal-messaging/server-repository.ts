import { z } from "zod";
import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { readAllPages } from "@/modules/shared/lib/data/read-pages";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import type { InternalMessagingRepository, MessagingFailure } from "./repository";
import { messageCursorSchema,threadPagePayload,inboxPayload, openThreadPayload, sendMessagePayload, threadPayload, uuidSchema, type ThreadOption } from "./model";

const membershipRows=z.array(z.object({organization_id:uuidSchema}));
const optionPage=z.object({options:z.array(z.object({rfqId:uuidSchema,providerOrganizationId:uuidSchema,senderOrganizationId:uuidSchema,context:z.enum(["RFQ","CONTRACT"])})).max(100),total:z.number().int().nonnegative(),page:z.number().int().positive(),pageSize:z.literal(100),hasMore:z.boolean()});
function failure(error:{code?:string}|null):MessagingFailure{return error?.code==="42501"?"FORBIDDEN":"UNAVAILABLE";}

export async function createInternalMessagingRepository():Promise<InternalMessagingRepository>{
 const client=await getSupabaseServerClient();
 return{
  async history(threadId,cursor,organizationId){const user=await client.auth.getUser();const authFailure=classifyAuthReadFailure(user.error);if(authFailure||!user.data.user)return{status:"error",reason:authFailure??"UNAUTHENTICATED"};const input=z.object({threadId:uuidSchema,cursor:messageCursorSchema.optional(),organizationId:uuidSchema.optional()}).safeParse({threadId,cursor,organizationId});if(!input.success)return{status:"error",reason:"INVALID_RESPONSE"};const response=await client.rpc(input.data.organizationId?"get_internal_message_thread_page_for_organization_v1":"get_internal_message_thread_page",{...(input.data.organizationId?{p_organization_id:input.data.organizationId}:{}),p_thread_id:input.data.threadId,p_before_created_at:input.data.cursor?.createdAt??null,p_before_message_id:input.data.cursor?.id??null,p_page_size:50});if(response.error)return{status:"error",reason:failure(response.error)};const parsed=threadPagePayload.safeParse(response.data);return parsed.success?{status:"success",value:parsed.data}:{status:"error",reason:"INVALID_RESPONSE"};},
  async search(query,organizationId,page=1){const user=await client.auth.getUser();const authFailure=classifyAuthReadFailure(user.error);if(authFailure||!user.data.user)return{status:"error",reason:authFailure??"UNAUTHENTICATED"};const input=z.object({query:z.string().trim().max(120),organizationId:uuidSchema.optional(),page:z.number().int().positive().max(100000)}).safeParse({query,organizationId,page});if(!input.success)return{status:"error",reason:"INVALID_RESPONSE"};const response=await client.rpc("search_internal_message_inbox",{p_search:input.data.query,p_organization_id:input.data.organizationId??null,p_page:input.data.page});if(response.error)return{status:"error",reason:failure(response.error)};const parsed=z.object({inbox:inboxPayload,total:z.number().int().nonnegative(),page:z.number().int().positive(),pageSize:z.literal(25)}).safeParse(response.data);return parsed.success?{status:"success",value:parsed.data}:{status:"error",reason:"INVALID_RESPONSE"};},
  async load(threadId,loadOptions){
   const {data:userData,error:userError}=await client.auth.getUser();
   const authFailure=classifyAuthReadFailure(userError);
   if(authFailure||!userData.user)return{status:"error",reason:authFailure??"UNAUTHENTICATED"};
   const organizationId=loadOptions?.organizationId;
   if(organizationId&&!uuidSchema.safeParse(organizationId).success)return{status:"error",reason:"INVALID_RESPONSE"};
   const [inboxResult,membershipsResult]=await Promise.all([
    loadOptions?.skipInbox?Promise.resolve({data:[],error:null}):client.rpc("list_internal_message_inbox",{p_limit:100}),
    readAllPages((from,to)=>{let query=client.from("organization_memberships").select("organization_id").eq("user_id",userData.user.id).eq("status","ACTIVE");if(organizationId)query=query.eq("organization_id",organizationId);return query.order("id").range(from,to);}),
   ]);
   if(inboxResult.error||membershipsResult.error)return{status:"error",reason:"UNAVAILABLE"};
   const inbox=inboxPayload.safeParse(inboxResult.data),memberships=membershipRows.safeParse(membershipsResult.data);
   if(!inbox.success||!memberships.success)return{status:"error",reason:"INVALID_RESPONSE"};
   if(organizationId&&!memberships.data.some(row=>row.organization_id===organizationId))return{status:"error",reason:"FORBIDDEN"};
   const options:ThreadOption[]=[];
   for(const selectedOrganizationId of new Set(memberships.data.map(row=>row.organization_id))){
    let expectedTotal:number|undefined;const seen=new Set<string>();
    for(let page=1;page<=100000;page++){
     const response=await client.rpc("list_internal_message_open_options_v1",{p_organization_id:selectedOrganizationId,p_page:page});
     if(response.error)return{status:"error",reason:failure(response.error)};
     const parsed=optionPage.safeParse(response.data);
     if(!parsed.success||parsed.data.page!==page||parsed.data.hasMore!==(parsed.data.total>page*100)||expectedTotal!==undefined&&expectedTotal!==parsed.data.total)return{status:"error",reason:"INVALID_RESPONSE"};
     expectedTotal=parsed.data.total;
     for(const item of parsed.data.options){
      const key=`${item.rfqId}:${item.providerOrganizationId}`;
      if(item.senderOrganizationId!==selectedOrganizationId||seen.has(key))return{status:"error",reason:"INVALID_RESPONSE"};
      seen.add(key);options.push({...item,label:item.rfqId.slice(0,8).toUpperCase()});
     }
     if(!parsed.data.hasMore){if(seen.size!==expectedTotal)return{status:"error",reason:"INVALID_RESPONSE"};break;}
     if(parsed.data.options.length!==100||page===100000)return{status:"error",reason:"INVALID_RESPONSE"};
    }
   }
   const conversationResult=threadId?await client.rpc("get_internal_message_thread",{p_thread_id:threadId,p_limit:300}):{data:null,error:null};
   if(conversationResult.error)return{status:"error",reason:failure(conversationResult.error)};
   if(!threadId)return{status:"success",value:{inbox:inbox.data,conversation:null,options}};
   const conversation=threadPayload.safeParse(conversationResult.data);
   if(!conversation.success)return{status:"error",reason:"INVALID_RESPONSE"};
   if(organizationId&&conversation.data.thread.participant_organization_id!==organizationId)return{status:"error",reason:"FORBIDDEN"};
   return{status:"success",value:{inbox:inbox.data,conversation:conversation.data,options}};
  },
  async open(input){const{data,error}=await client.rpc("open_rfq_message_thread",{p_rfq_id:input.rfqId,p_provider_organization_id:input.providerOrganizationId,p_subject:input.subject,p_idempotency_key:input.idempotencyKey,p_correlation_id:input.correlationId});if(error)return{status:"error",reason:failure(error)};const parsed=openThreadPayload.safeParse(data);return parsed.success?{status:"success",value:{threadId:parsed.data.thread_id}}:{status:"error",reason:"INVALID_RESPONSE"};},
  async send(input){const{data,error}=await client.rpc("send_internal_message",{p_thread_id:input.threadId,p_sender_organization_id:input.senderOrganizationId,p_body:input.body,p_attachments:[],p_idempotency_key:input.idempotencyKey,p_correlation_id:input.correlationId});if(error)return{status:"error",reason:failure(error)};const parsed=sendMessagePayload.safeParse(data);return parsed.success?{status:"success",value:{threadId:parsed.data.thread_id,messageId:parsed.data.message_id}}:{status:"error",reason:"INVALID_RESPONSE"};},
 };
}

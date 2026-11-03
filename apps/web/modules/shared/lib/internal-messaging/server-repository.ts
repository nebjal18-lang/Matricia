import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import type { InternalMessagingRepository, MessagingFailure } from "./repository";
import { messageCursorSchema,threadPagePayload,inboxPayload, openThreadPayload, sendMessagePayload, threadPayload, uuidSchema, type ThreadOption } from "./model";

const membershipRows=z.array(z.object({organization_id:uuidSchema}));
const requestRows=z.array(z.object({id:uuidSchema,client_organization_id:uuidSchema}));
const rfqRows=z.array(z.object({id:uuidSchema,request_id:uuidSchema,status:z.string()}));
const providerRows=z.array(z.object({rfq_id:uuidSchema,provider_organization_id:uuidSchema,status:z.string()}));
function failure(error:{code?:string}|null):MessagingFailure{return error?.code==="42501"?"FORBIDDEN":"UNAVAILABLE";}

export async function createInternalMessagingRepository():Promise<InternalMessagingRepository>{
 const client=await getSupabaseServerClient();
 return{
  async history(threadId,cursor){const user=await client.auth.getUser();if(user.error||!user.data.user)return{status:"error",reason:"UNAUTHENTICATED"};const input=z.object({threadId:uuidSchema,cursor:messageCursorSchema.optional()}).safeParse({threadId,cursor});if(!input.success)return{status:"error",reason:"INVALID_RESPONSE"};const response=await client.rpc("get_internal_message_thread_page",{p_thread_id:input.data.threadId,p_before_created_at:input.data.cursor?.createdAt??null,p_before_message_id:input.data.cursor?.id??null,p_page_size:50});if(response.error)return{status:"error",reason:failure(response.error)};const parsed=threadPagePayload.safeParse(response.data);return parsed.success?{status:"success",value:parsed.data}:{status:"error",reason:"INVALID_RESPONSE"};},
  async search(query,organizationId,page=1){const user=await client.auth.getUser();if(user.error||!user.data.user)return{status:"error",reason:"UNAUTHENTICATED"};const input=z.object({query:z.string().trim().max(120),organizationId:uuidSchema.optional(),page:z.number().int().positive().max(100000)}).safeParse({query,organizationId,page});if(!input.success)return{status:"error",reason:"INVALID_RESPONSE"};const response=await client.rpc("search_internal_message_inbox",{p_search:input.data.query,p_organization_id:input.data.organizationId??null,p_page:input.data.page});if(response.error)return{status:"error",reason:failure(response.error)};const parsed=z.object({inbox:inboxPayload,total:z.number().int().nonnegative(),page:z.number().int().positive(),pageSize:z.literal(25)}).safeParse(response.data);return parsed.success?{status:"success",value:parsed.data}:{status:"error",reason:"INVALID_RESPONSE"};},
  async load(threadId,loadOptions){
   const{data:userData,error:userError}=await client.auth.getUser();if(userError||!userData.user)return{status:"error",reason:"UNAUTHENTICATED"};
   const[inboxResult,membershipsResult,rfqsResult]=await Promise.all([
    loadOptions?.skipInbox?Promise.resolve({data:[],error:null}):client.rpc("list_internal_message_inbox",{p_limit:100}),
    client.from("organization_memberships").select("organization_id").eq("user_id",userData.user.id).eq("status","ACTIVE").limit(100),
    client.from("rfqs").select("id,request_id,status").eq("status","OPEN").limit(200),
   ]);
   if(inboxResult.error||membershipsResult.error||rfqsResult.error)return{status:"error",reason:"UNAVAILABLE"};
   const inbox=inboxPayload.safeParse(inboxResult.data),memberships=membershipRows.safeParse(membershipsResult.data),rfqs=rfqRows.safeParse(rfqsResult.data);
   if(!inbox.success||!memberships.success||!rfqs.success)return{status:"error",reason:"INVALID_RESPONSE"};
   const requestIds=[...new Set(rfqs.data.map(row=>row.request_id))];
   const[requestsResult,providersResult,conversationResult]=await Promise.all([
    requestIds.length?client.from("service_requests").select("id,client_organization_id").in("id",requestIds).limit(200):Promise.resolve({data:[],error:null}),
    rfqs.data.length?client.from("rfq_providers").select("rfq_id,provider_organization_id,status").in("rfq_id",rfqs.data.map(row=>row.id)).not("status","in",("(WITHDRAWN,SUSPENDED)" as never)).limit(1000):Promise.resolve({data:[],error:null}),
    threadId?client.rpc("get_internal_message_thread",{p_thread_id:threadId,p_limit:300}):Promise.resolve({data:null,error:null}),
   ]);
   if(requestsResult.error||providersResult.error||conversationResult.error)return{status:"error",reason:failure(conversationResult.error)};
   const requests=requestRows.safeParse(requestsResult.data),providers=providerRows.safeParse(providersResult.data);if(!requests.success||!providers.success)return{status:"error",reason:"INVALID_RESPONSE"};
   const memberOrgs=new Set(memberships.data.map(row=>row.organization_id)),requestById=new Map(requests.data.map(row=>[row.id,row]));
   const options:ThreadOption[]=providers.data.flatMap(row=>{const rfq=rfqs.data.find(item=>item.id===row.rfq_id),request=rfq?requestById.get(rfq.request_id):undefined;if(!request)return[];const senderOrganizationId=memberOrgs.has(request.client_organization_id)?request.client_organization_id:memberOrgs.has(row.provider_organization_id)?row.provider_organization_id:null;if(!senderOrganizationId)return[];return[{rfqId:row.rfq_id,providerOrganizationId:row.provider_organization_id,senderOrganizationId,label:`${row.rfq_id.slice(0,8).toUpperCase()} · ${senderOrganizationId===request.client_organization_id?"PROVIDER":"CLIENT"}`}];});
   if(!threadId)return{status:"success",value:{inbox:inbox.data,conversation:null,options}};
   const conversation=threadPayload.safeParse(conversationResult.data);return conversation.success?{status:"success",value:{inbox:inbox.data,conversation:conversation.data,options}}:{status:"error",reason:"INVALID_RESPONSE"};
  },
  async open(input){const{data,error}=await client.rpc("open_rfq_message_thread",{p_rfq_id:input.rfqId,p_provider_organization_id:input.providerOrganizationId,p_subject:input.subject,p_idempotency_key:input.idempotencyKey,p_correlation_id:input.correlationId});if(error)return{status:"error",reason:failure(error)};const parsed=openThreadPayload.safeParse(data);return parsed.success?{status:"success",value:{threadId:parsed.data.thread_id}}:{status:"error",reason:"INVALID_RESPONSE"};},
  async send(input){const{data,error}=await client.rpc("send_internal_message",{p_thread_id:input.threadId,p_sender_organization_id:input.senderOrganizationId,p_body:input.body,p_attachments:[],p_idempotency_key:input.idempotencyKey,p_correlation_id:input.correlationId});if(error)return{status:"error",reason:failure(error)};const parsed=sendMessagePayload.safeParse(data);return parsed.success?{status:"success",value:{threadId:parsed.data.thread_id,messageId:parsed.data.message_id}}:{status:"error",reason:"INVALID_RESPONSE"};},
 };
}

import type { InternalMessagingRepository, MessagingFailure, MessagingResult } from "@/modules/shared/lib/internal-messaging/repository";
import type { MessageCursor, ThreadPage } from "@/modules/shared/lib/internal-messaging/model";

/** Organization selection narrows an already authorized session; it never grants access. */
export async function loadProviderInbox(repository:InternalMessagingRepository,input:{organizationId:string|null;threadId?:string;search:string;page:number;cursor?:MessageCursor}) {
 const denied={status:"error" as const,reason:"FORBIDDEN" as MessagingFailure};
 if(!input.organizationId)return{inbox:denied,options:denied,history:denied};
 const [inbox,options,loadedHistory]=await Promise.all([
  repository.search(input.search,input.organizationId,input.page),
  repository.load(undefined,{skipInbox:true,organizationId:input.organizationId}),
  input.threadId?repository.history(input.threadId,input.cursor,input.organizationId):Promise.resolve(null),
 ]);
 // An actor may belong to both organizations. Do not silently display the other
 // authorized organization's conversation under the currently selected company.
 const history:MessagingResult<ThreadPage>|null=loadedHistory?.status==="success"&&loadedHistory.value.thread.participant_organization_id!==input.organizationId?denied:loadedHistory;
 return{inbox,options,history};
}

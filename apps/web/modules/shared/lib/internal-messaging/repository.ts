import type { InboxThread, ThreadConversation, ThreadOption,ThreadPage,MessageCursor } from "./model";

export type MessagingFailure = "UNAUTHENTICATED" | "FORBIDDEN" | "INVALID_RESPONSE" | "UNAVAILABLE";
export type MessagingResult<T> = { status: "success"; value: T } | { status: "error"; reason: MessagingFailure };
export type InternalMessagingRepository = {
  history(threadId:string,cursor?:MessageCursor,organizationId?:string):Promise<MessagingResult<ThreadPage>>;
  search(query:string,organizationId?:string,page?:number):Promise<MessagingResult<{inbox:InboxThread[];total:number;page:number;pageSize:number}>>;
  load(threadId?: string,options?:{skipInbox?:boolean;organizationId?:string}): Promise<MessagingResult<{ inbox: InboxThread[]; conversation: ThreadConversation | null; options: ThreadOption[] }>>;
  open(input: { rfqId: string; providerOrganizationId: string; subject: string; idempotencyKey: string; correlationId: string }): Promise<MessagingResult<{ threadId: string }>>;
  send(input: { threadId: string; senderOrganizationId: string; body: string; idempotencyKey: string; correlationId: string }): Promise<MessagingResult<{ threadId: string; messageId: string }>>;
};

import{z}from"zod";
export const conversationPageSchema=z.object({messages:z.array(z.object({id:z.string().uuid(),body:z.string(),createdAt:z.string(),senderAlias:z.string(),attachments:z.array(z.object({id:z.string().uuid(),name:z.string(),scanStatus:z.string(),downloadReady:z.boolean()}))})),hasMore:z.boolean(),nextCursor:z.object({at:z.string(),id:z.string().uuid()}).nullable()});
export type ConversationPage=z.infer<typeof conversationPageSchema>;

import { z } from "zod";

export const uuidSchema = z.string().uuid();
const participantKind = z.enum(["CLIENT", "PROVIDER", "FRANCHISE"]);
const attachment = z.object({
  id: uuidSchema,
  name: z.string().min(1),
  mime_type: z.string().min(1),
  size_bytes: z.number().int().positive(),
  scan_status: z.enum(["PENDING", "CLEAN", "REJECTED", "ERROR"]),
  download_ready: z.boolean(),
});
const message = z.object({
  id: uuidSchema,
  sender_alias: participantKind,
  mine: z.boolean(),
  body: z.string().min(1),
  created_at: z.string().datetime({ offset: true }),
  attachments: z.array(attachment),
});
export const threadSummary = z.object({
  id: uuidSchema,
  object_type: z.enum(["RFQ","FRANCHISE_RFQ"]),
  franchise_id: uuidSchema.nullable().optional(),
  object_id: uuidSchema,
  service_request_id: uuidSchema,
  subject: z.string().min(1),
  status: z.enum(["OPEN", "LOCKED"]),
  contact_policy_version: z.string().min(1),
  can_send: z.boolean().optional(),
  participant_organization_id: uuidSchema,
  participant_kind: participantKind,
  counterparty_alias: participantKind,
  created_at: z.string().datetime({ offset: true }),
  last_message_at: z.string().datetime({ offset: true }),
  message_count: z.number().int().nonnegative(),
});
export const inboxPayload = z.array(threadSummary);
export const threadPayload = z.object({
  thread: threadSummary.omit({ last_message_at: true, message_count: true }),
  messages: z.array(message),
});
export const openThreadPayload = z.object({ outcome: z.literal("MESSAGE_THREAD_OPENED"), thread_id: uuidSchema });
export const sendMessagePayload = z.object({ outcome: z.literal("INTERNAL_MESSAGE_SENT"), message_id: uuidSchema, thread_id: uuidSchema });

export type InboxThread = z.infer<typeof threadSummary>;
export type ThreadConversation = z.infer<typeof threadPayload>;
export type ThreadOption = { rfqId: string; providerOrganizationId: string; senderOrganizationId: string; label: string; context?: "RFQ" | "CONTRACT" };

export const messageCursorSchema=z.object({createdAt:z.string().datetime({offset:true}),id:uuidSchema});
export const threadPagePayload=threadPayload.extend({hasMore:z.boolean(),nextCursor:messageCursorSchema.nullable(),total:z.number().int().nonnegative()});
export type MessageCursor=z.infer<typeof messageCursorSchema>;
export type ThreadPage=z.infer<typeof threadPagePayload>;

import {z} from "zod";
export const adminHistoryPageSchema=z.object({events:z.array(z.object({id:z.string().regex(/^\d+$/),action:z.string(),occurredAt:z.string(),actorType:z.string(),actorLabel:z.string().nullable().optional(),reason:z.string().optional()})),hasMore:z.boolean(),nextBefore:z.string().regex(/^\d+$/).nullable()});
export type AdminHistoryPage=z.infer<typeof adminHistoryPageSchema>;

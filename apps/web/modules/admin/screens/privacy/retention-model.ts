import {z} from "zod";
export const retentionOptionSchema=z.object({id:z.string().uuid(),organizationId:z.string().uuid(),label:z.string()});
export const retentionConsoleSchema=z.object({policies:z.array(retentionOptionSchema.extend({policyHash:z.string()})),approvals:z.array(retentionOptionSchema),actions:z.array(retentionOptionSchema),dsrs:z.array(retentionOptionSchema),subjects:z.array(retentionOptionSchema),jobs:z.array(z.object({id:z.string(),scope:z.string(),status:z.string(),affectedRows:z.number(),resultHash:z.string(),completedAt:z.string()}))});
export type RetentionConsole=z.infer<typeof retentionConsoleSchema>;

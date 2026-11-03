import {z} from "zod";
const uuid=z.string().uuid(),integer=z.string().regex(/^\d+$/u);
export const memberBoxWorkspaceSchema=z.object({
 organization_id:uuid,aal2:z.boolean(),next:uuid.nullable(),boxes:z.array(z.object({
  id:uuid,name_fr:z.string(),name_ar:z.string(),period_start:z.string().datetime({offset:true}),period_end:z.string().datetime({offset:true}),
  funding_ready:z.boolean(),credit_limit:integer,used:integer,available:integer,
  benefits:z.array(z.object({id:uuid,name_fr:z.string(),name_ar:z.string(),credit_cost:integer})),
  redemptions:z.array(z.object({id:uuid,name_fr:z.string(),name_ar:z.string(),status:z.enum(["RESERVED","SCHEDULED","IN_PROGRESS","DELIVERED","CONSUMED","CANCELLED","REFUNDED","EXPIRED"]),reserved_credits:integer,expires_at:z.string().datetime({offset:true}),row_version:z.string().regex(/^[1-9]\d*$/u)})),
 })),
});
export type MemberBoxWorkspace=z.infer<typeof memberBoxWorkspaceSchema>;
export type MemberBoxActionState={status:"idle"|"success"}|{status:"error";reason:"VALIDATION"|"UNAUTHENTICATED"|"MFA_REQUIRED"|"FORBIDDEN"|"CONFLICT"|"FAILED"};

import{z}from"zod";
const id=z.string().uuid(),integer=z.string().regex(/^\d+$/u);
export const lifecycleSchema=z.object({organization_id:id,aal2:z.boolean(),finance:z.boolean(),next:id.nullable(),next_wait:id.nullable(),next_offer:id.nullable(),
 redemptions:z.array(z.object({id,name_fr:z.string(),name_ar:z.string(),status:z.enum(["RESERVED","SCHEDULED","IN_PROGRESS","DELIVERED","CONSUMED","CANCELLED","EXPIRED","REFUNDED"]),row_version:integer,expires_at:z.string().datetime({offset:true}),executor:z.enum(["PLATFORM_ENTITLEMENT","SERVICE_POOL","RFQ_REQUEST"]).nullable(),executed:z.boolean(),library_id:id.nullable(),service_id:id.nullable(),may_execute:z.boolean()})),
 waiting:z.array(z.object({id,name_fr:z.string(),name_ar:z.string(),units:integer})),offers:z.array(z.object({id,name_fr:z.string(),name_ar:z.string(),wallet_id:id}))});
export type BenefitLifecycle=z.infer<typeof lifecycleSchema>;

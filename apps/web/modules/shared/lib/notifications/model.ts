import{z}from"zod";

const uuid=z.string().uuid();
const priority=z.enum(["INFO","NORMAL","IMPORTANT","CRITICAL"]);

export const preferenceInput=z.object({organizationId:uuid,categoryCode:z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/),channel:z.enum(["IN_APP","EMAIL"]),deliveryMode:z.enum(["IMMEDIATE","DIGEST","DISABLED"]),digestFrequency:z.union([z.enum(["DAILY","WEEKLY"]),z.literal("")]),locale:z.enum(["fr-MA","ar-MA"]),expectedRowVersion:z.coerce.number().int().nonnegative(),idempotencyKey:uuid}).refine(v=>(v.deliveryMode==="DIGEST")===(v.digestFrequency!==""),{path:["digestFrequency"]});
export const readInput=z.object({notificationId:uuid,expectedRowVersion:z.coerce.number().int().positive(),idempotencyKey:uuid});

const preference=z.object({id:uuid,category_code:z.string(),channel:z.enum(["IN_APP","EMAIL"]),delivery_mode:z.enum(["IMMEDIATE","DIGEST","DISABLED"]),digest_frequency:z.enum(["DAILY","WEEKLY"]).nullable(),locale:z.enum(["fr-MA","ar-MA"]),row_version:z.number().int().positive(),updated_at:z.string()});
const delivery=z.object({id:uuid,channel:z.enum(["IN_APP","EMAIL"]),delivery_mode:z.enum(["IMMEDIATE","DIGEST","DISABLED"]),status:z.enum(["PENDING","QUEUED_DIGEST","SENT","DELIVERED","FAILED","DEAD_LETTER","SKIPPED"]),attempt_count:z.number().int().nonnegative(),next_attempt_at:z.string().nullable(),last_error_code:z.string().nullable()});
const notification=z.object({id:uuid,category_code:z.string(),event_type:z.string(),locale:z.enum(["fr-MA","ar-MA"]),subject:z.string(),body:z.string(),cta_path:z.string().nullable(),priority,mandatory:z.boolean(),read_at:z.string().nullable(),row_version:z.number().int().positive(),created_at:z.string(),deliveries:z.array(delivery)});

export const notificationHistoryInput=z.object({q:z.string().trim().max(160).default(""),unread:z.boolean().default(false),before:z.string().datetime({offset:true}).optional(),beforeId:uuid.optional()}).refine(value=>Boolean(value.before)===Boolean(value.beforeId),{path:["beforeId"]});
export const centerPayload=z.object({preferences:z.array(preference),notifications:z.array(notification)});
export const centerPagePayload=centerPayload.extend({next:z.object({createdAt:z.string().datetime({offset:true}),id:uuid}).nullable()});
export const categoryRows=z.array(z.object({code:z.string(),label_fr:z.string(),label_ar:z.string(),mandatory:z.boolean()}));
export const templateRows=z.array(z.object({id:uuid,template_code:z.string(),version:z.number().int().positive(),event_type:z.string(),category_code:z.string(),locale:z.enum(["fr-MA","ar-MA"]),subject_template:z.string(),body_template:z.string(),cta_path_template:z.string().nullable(),priority,mandatory:z.boolean(),channels:z.array(z.enum(["IN_APP","EMAIL"])),variable_keys:z.array(z.string()),effective_from:z.string(),content_hash:z.string().regex(/^[0-9a-f]{64}$/)}));
export const platformRoleRows=z.array(z.object({role_code:z.string()}));

export type NotificationDashboard={organizationId:string;organizationName:string;canViewDeliveryOperations:boolean;categories:Array<{code:string;label:string;mandatory:boolean}>;preferences:z.infer<typeof preference>[];notifications:z.infer<typeof notification>[];templates:z.infer<typeof templateRows>;history?:z.infer<typeof notificationHistoryInput>&{next:{createdAt:string;id:string}|null}};

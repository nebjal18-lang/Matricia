import {z} from "zod";
const uuid=z.string().uuid(),hash=z.string().regex(/^[a-f0-9]{64}$/u),integer=z.string().regex(/^\d+$/u);
export const fulfillmentSchema=z.object({page:z.number().int().positive(),has_next:z.boolean(),total:integer,rows:z.array(z.object({
 id:uuid,organization_id:uuid,organization_name:z.string(),name_fr:z.string(),name_ar:z.string(),status:z.enum(["RESERVED","SCHEDULED","IN_PROGRESS","DELIVERED","CONSUMED","CANCELLED","REFUNDED","EXPIRED"]),row_version:integer,units:integer,reserved_credits:integer,reservation_expires_at:z.string(),delivery_proof_hash:hash.nullable(),can_operate:z.boolean(),execution_requires_native:z.boolean(),execution_policy_required:z.boolean(),funding_ready:z.boolean(),can_receive:z.boolean(),receipt_requires_mfa:z.boolean(),scheduled_for:z.string().nullable(),
 proposal:z.object({id:uuid,source_hash:hash,summary:z.string(),service_reference:z.string(),completed_at:z.string()}).nullable(),
 receipt:z.object({id:uuid,accepted:z.boolean(),reason:z.string(),receipt_hash:hash,created_at:z.string()}).nullable()
}))});
export type FulfillmentRow=z.infer<typeof fulfillmentSchema>["rows"][number]&{scheduled_label:string;completed_label:string;receipt_label:string;default_schedule_local:string};
export type FulfillmentState={status:"idle"|"success"|"error";reason?:"VALIDATION"|"FORBIDDEN"|"STALE"|"FUNDING"|"PENDING"|"FAILED";outcome?:string};
export const fulfillmentOutcomes=["BENEFIT_SCHEDULED","BENEFIT_STARTED","BENEFIT_DELIVERY_REVIEW_REQUIRED","BENEFIT_DELIVERY_ACCEPTED","BENEFIT_DELIVERY_REJECTED","BENEFIT_CONSUMED"]as const;

import {z} from "zod";
const uuid=z.string().uuid(),exact=z.string().regex(/^\d+$/u),hash=z.string().regex(/^[a-f0-9]{64}$/u);
export const refundPageSchema=z.object({page:z.number().int().positive(),has_next:z.boolean(),total:exact,rows:z.array(z.object({
 id:uuid,organization_id:uuid,organization_name:z.string(),name_fr:z.string(),name_ar:z.string(),status:z.enum(["CONSUMED","REFUNDED"]),row_version:exact,quantity:exact,
 policy_ready:z.boolean(),policy_reference:z.string().nullable(),expiry_treatment:z.literal("PRESERVE_ORIGINAL_DENY_EXPIRED").nullable(),can_request:z.boolean(),requires_mfa:z.boolean(),
 request:z.object({id:uuid,content_hash:hash,reason:z.string(),created_at:z.string(),approved:z.boolean().nullable(),decision_reason:z.string().nullable(),source_stale:z.boolean(),can_decide:z.boolean()}).nullable(),
 economic_reversals:z.array(z.object({id:uuid,book_id:uuid,book_organization:z.string(),library_code:z.string(),amount_minor:exact,currency:z.string().regex(/^[A-Z]{3}$/u)})).nullable(),
 original_lots:z.array(z.object({id:uuid,source_type:z.string(),quantity:exact,expires_at:z.string(),library_id:uuid.nullable()})),
 refunded:z.object({quantity:exact,created_at:z.string(),reversed_allocations:z.number().int().nonnegative()}).nullable()
}))});
export type RefundRow=z.infer<typeof refundPageSchema>["rows"][number];
export type RefundState={status:"idle"|"success"|"error";reason?:"VALIDATION"|"FORBIDDEN"|"STALE"|"POLICY"|"EXPIRED"|"FAILED";outcome?:"BENEFIT_REFUND_REQUESTED"|"BENEFIT_REFUNDED"|"BENEFIT_REFUND_REJECTED"};

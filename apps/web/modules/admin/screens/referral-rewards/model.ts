import {z} from "zod";
export const referralRewardQueueSchema=z.object({page:z.number().int().positive(),has_next:z.boolean(),rows:z.array(z.object({
 source_event_id:z.string().uuid(),rule_version_id:z.string().uuid(),approval_id:z.string().uuid().nullable(),organization_name:z.string(),referral_code:z.string(),
 audience_type:z.enum(["CLIENT_ORGANIZATION","REFERRED_CLIENT"]),rule_code:z.string(),rule_version:z.number().int().positive(),bonus_credits:z.string().regex(/^\d+$/u),granted_credits:z.string().regex(/^\d+$/u).nullable(),occurred_at:z.string(),
 state:z.enum(["AWAITING_REVIEW","APPROVED_PENDING_EXECUTION","GRANTED","REJECTED"]),can_decide:z.boolean(),can_execute:z.boolean(),blocked_reason:z.enum(["SOURCE_NOT_ACTIVE","RULE_NOT_ACTIVE"]).nullable(),
})).max(50)});
export type ReferralRewardQueue=z.infer<typeof referralRewardQueueSchema>;
export type ReferralRewardActionState={status:"idle"}|{status:"success";kind:"decision"|"execution"}|{status:"error";reason:"VALIDATION"|"UNAUTHENTICATED"|"MFA_REQUIRED"|"FORBIDDEN"|"CONFLICT"|"FAILED"};

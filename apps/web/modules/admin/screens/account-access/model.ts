import { z } from "zod";
const id = z.string().uuid(), hash = z.string().regex(/^[a-f0-9]{64}$/u);
export const accountAction = z.enum(["REVOKE_SESSIONS", "SUSPEND_ACCOUNT", "UNBLOCK_ACCOUNT", "GRANT_PLATFORM_ROLE", "REVOKE_PLATFORM_ROLE"]);
const result = z.object({outcome: z.enum(["ACCOUNT_CHANGE_EXECUTED", "ACCOUNT_CHANGE_REJECTED"]), request_id: id, sessions_revoked: z.number().int().nonnegative(), roles_changed: z.number().int().nonnegative()});
export const accountAccessSchema = z.object({user_id:id,source_hash:hash,can_request:z.boolean(),current_user_id:id,orphan:z.boolean(),suspended:z.boolean().nullable(),deleted:z.boolean(),roles:z.array(z.string()),available_roles:z.array(z.object({code:z.string(),label_fr:z.string(),label_ar:z.string()})),requests:z.array(z.object({id,action:accountAction,role_code:z.string().nullable(),source_hash:hash,created_by:id,created_at:z.string(),expires_at:z.string(),expired:z.boolean(),reason:z.string(),decision:z.enum(["APPROVE","REJECT"]).nullable(),result:result.nullable()}))});
export type AccountAccess = z.infer<typeof accountAccessSchema>;
export type AccountAccessState = {status:"idle"|"success"|"error";outcome?:"ACCOUNT_CHANGE_REQUESTED"|"ACCOUNT_CHANGE_EXECUTED"|"ACCOUNT_CHANGE_REJECTED";reason?:"INVALID"|"FORBIDDEN"|"CONFLICT"|"ENVIRONMENT"|"LAST_ADMIN"|"MEMBERSHIP"|"FAILED"};
export const accountReviewQueueSchema=z.object({rows:z.array(z.object({id,user_id:id,action:accountAction,role_code:z.string().nullable(),created_at:z.string(),created_by:id,reason:z.string()})),page:z.number().int(),has_next:z.boolean(),total:z.number().int().nonnegative()});
export function accountActionLabel(action:z.infer<typeof accountAction>,ar:boolean):string {
 const labels={REVOKE_SESSIONS:ar?"إلغاء جميع جلسات الحساب":"Révoquer toutes les sessions du compte",SUSPEND_ACCOUNT:ar?"تعليق حساب بدون عضوية":"Suspendre ce compte sans adhésion",UNBLOCK_ACCOUNT:ar?"رفع تعليق الحساب":"Débloquer le compte",GRANT_PLATFORM_ROLE:ar?"منح دور على المنصة":"Accorder un rôle plateforme",REVOKE_PLATFORM_ROLE:ar?"سحب دور على المنصة":"Retirer un rôle plateforme"};return labels[action];
}

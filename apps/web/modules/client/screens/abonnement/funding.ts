import{z}from"zod";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
export const subscriptionFundingSchema=z.object({status:z.enum(["PAID_CYCLE_VERIFIED","TRIAL_ACTIVE","NO_ACTIVE_PAID_CYCLE","PAYMENT_FUNDING_REVIEW_REQUIRED"]),new_request_admissible:z.boolean(),funded_cycle:z.object({subscription_id:z.string().uuid(),cycle_id:z.string().uuid(),funded_plan_version_id:z.string().uuid(),period_start:z.string(),period_end:z.string()}).nullable()});
export type SubscriptionFunding=z.infer<typeof subscriptionFundingSchema>;
export async function loadSubscriptionFunding(organizationId:string):Promise<SubscriptionFunding|null>{const c=await getSupabaseServerClient(),result=await c.rpc("get_client_subscription_funding_v1",{p_organization_id:organizationId});if(result.error)return null;const p=subscriptionFundingSchema.safeParse(result.data);return p.success?p.data:null;}

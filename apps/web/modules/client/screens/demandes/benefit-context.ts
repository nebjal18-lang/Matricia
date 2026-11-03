import{z}from"zod";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
const uuid=z.string().uuid();
const contextSchema=z.object({redemption_id:uuid,organization_id:uuid,row_version:z.string().regex(/^[1-9]\d*$/u),service_name_fr:z.string(),service_name_ar:z.string(),benefit_name_fr:z.string(),benefit_name_ar:z.string(),existing_request_id:uuid.nullable()});
export async function loadBenefitRequestContext(redemptionId:string,organizationId:string|null){
 if(!uuid.safeParse(redemptionId).success||!uuid.safeParse(organizationId).success)return null;
 const c=await getSupabaseServerClient(),r=await c.rpc("get_client_benefit_rfq_context_v1",{p_redemption_id:redemptionId,p_organization_id:organizationId}),p=contextSchema.safeParse(r.data);
 return r.error||!p.success||p.data.organization_id!==organizationId||p.data.redemption_id!==redemptionId?null:p.data;
}
export async function createRequestFromBenefit(input:{redemptionId:string;rowVersion:string;idempotencyKey:string;description:string;urgency:string;desiredDate:string|null;budgetMinor:string|null;regionCode:string;siteId:string|null}){
 const c=await getSupabaseServerClient(),a=await c.auth.getUser();if(a.error||!a.data.user)return{status:"error"as const,reason:"UNAUTHENTICATED"as const};
 const assurance=await c.auth.mfa.getAuthenticatorAssuranceLevel();if(assurance.error)return{status:"error"as const,reason:"UNAVAILABLE"as const};if(assurance.data.currentLevel!=="aal2")return{status:"error"as const,reason:"MFA_REQUIRED"as const};
 const r=await c.rpc("create_client_benefit_rfq_v1",{p_redemption_id:input.redemptionId,p_expected_row_version:input.rowVersion,p_payload:{description:input.description,urgency:input.urgency,desired_date:input.desiredDate,budget_minor:input.budgetMinor,currency_code:"MAD",region_code:input.regionCode,site_id:input.siteId},p_idempotency_key:input.idempotencyKey});
 if(r.error)return{status:"error"as const,reason:r.error.code==="42501"?"FORBIDDEN"as const:"UNAVAILABLE"as const};
 const p=z.object({outcome:z.literal("SERVICE_REQUEST_CREATED"),request_id:uuid,status:z.enum(["INFORMATION_REQUIRED","DRAFT"])}).safeParse(r.data);
 return p.success?{status:"success"as const,requestId:p.data.request_id}:{status:"error"as const,reason:"UNAVAILABLE"as const};
}

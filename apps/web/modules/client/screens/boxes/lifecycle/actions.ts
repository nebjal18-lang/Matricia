"use server";
import{z}from"zod";
import{revalidatePath}from"next/cache";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import{classifyCommandFailure}from"@/modules/shared/lib/auth/command-failure";
import type{MemberBoxActionState}from"../member/model";
const uuid=z.string().uuid(),positive=z.string().regex(/^[1-9]\d{0,17}$/u);
const schema=z.discriminatedUnion("operation",[
 z.object({operation:z.literal("join"),organizationId:uuid,walletId:uuid,benefitId:uuid,units:positive}),
 z.object({operation:z.enum(["confirm","cancel"]),requestId:uuid,expiresAt:z.string().optional()}),
 z.object({operation:z.enum(["execute","expire"]),redemptionId:uuid,rowVersion:positive}),
]);
export async function benefitLifecycleAction(_:MemberBoxActionState,form:FormData):Promise<MemberBoxActionState>{
 const fields=Object.fromEntries(form.entries()),base=z.object({locale:z.enum(["fr","ar"]),idempotencyKey:uuid}).safeParse(fields),p=schema.safeParse(fields);
 if(!base.success||!p.success)return{status:"error",reason:"VALIDATION"};
 let rpc:string,args:Record<string,unknown>,expected:string[];
 const key=base.data.idempotencyKey;
 if(p.data.operation==="join"){rpc="join_benefit_waitlist_v1";args={p_organization_id:p.data.organizationId,p_wallet_id:p.data.walletId,p_benefit_version_id:p.data.benefitId,p_units:p.data.units,p_idempotency_key:key};expected=["BENEFIT_WAITLISTED"];}
 else if(p.data.operation==="confirm"||p.data.operation==="cancel"){
  let expiry:string|null=null;if(p.data.operation==="confirm"){const raw=p.data.expiresAt??"";if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u.test(raw))return{status:"error",reason:"VALIDATION"};const date=new Date(`${raw}:00Z`);if(Number.isNaN(date.getTime())||date.toISOString().slice(0,16)!==raw)return{status:"error",reason:"VALIDATION"};expiry=date.toISOString();}
  rpc="resolve_benefit_waitlist_v1";args={p_request_id:p.data.requestId,p_cancel:p.data.operation==="cancel",p_reservation_expires_at:expiry,p_idempotency_key:key};expected=[p.data.operation==="cancel"?"BENEFIT_WAITLIST_CANCELLED":"BENEFIT_WAITLIST_RESERVED"];
 }else if("redemptionId"in p.data){rpc=p.data.operation==="expire"?"expire_my_benefit_reservation_v1":"execute_benefit_native_v1";args={p_redemption_id:p.data.redemptionId,p_expected_row_version:p.data.rowVersion,p_idempotency_key:key,...(p.data.operation==="execute"?{p_request_context:{}}:{})};expected=p.data.operation==="expire"?["BENEFIT_EXPIRED"]:["PLATFORM_ENTITLEMENT_ACTIVATED","SERVICE_UNITS_RESERVED"];}else return{status:"error",reason:"VALIDATION"};
 try{const c=await getSupabaseServerClient(),a=await c.auth.getUser();if(a.error||!a.data.user)return{status:"error",reason:a.error&&a.error.status!==401?"FAILED":"UNAUTHENTICATED"};const assurance=await c.auth.mfa.getAuthenticatorAssuranceLevel();if(assurance.error)return{status:"error",reason:"FAILED"};if(assurance.data.currentLevel!=="aal2")return{status:"error",reason:"MFA_REQUIRED"};
 const r=await c.rpc(rpc,args);if(r.error)return{status:"error",reason:classifyCommandFailure(r.error)};
 const response=z.object({outcome:z.string(),redemption_id:uuid.nullable().optional(),request_id:uuid.optional(),binding_id:uuid.optional()}).safeParse(r.data);
 if(!response.success||!expected.includes(response.data.outcome)||(p.data.operation==="execute"&&(!response.data.redemption_id||!response.data.binding_id))||(p.data.operation==="expire"&&!response.data.redemption_id)||(["join","confirm","cancel"].includes(p.data.operation)&&!response.data.request_id))return{status:"error",reason:"FAILED"};
 for(const path of["/client/avantages/execution","/client/credits","/client/boxes/mon-enveloppe"])revalidatePath(`/${base.data.locale}${path}`);return{status:"success"};
 }catch{return{status:"error",reason:"FAILED"};}
}

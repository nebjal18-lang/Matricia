"use server";
import{z}from"zod";
import{revalidatePath}from"next/cache";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
export type WorkflowState={status:"idle"|"success"|"error"};
const uuid=z.string().uuid();
export async function providerFinanceWorkflow(_:WorkflowState,form:FormData):Promise<WorkflowState>{
 const value=Object.fromEntries(form.entries()),common=z.object({locale:z.enum(["fr","ar"]),operation:z.enum(["review","confirm","dispute","resolve","policy","policyDecision","admit","reversalCredit"]),reason:z.string().trim().min(10).max(2000)}).safeParse(value);if(!common.success)return{status:"error"};if(["review","confirm","resolve","policyDecision"].includes(common.data.operation)&&!["yes","no"].includes(String(value.approved)))return{status:"error"};const v=common.data,id=uuid.safeParse(value.id),yes=value.approved==="yes";let name:string,args:Record<string,unknown>;
 if(v.operation==="policy"){
  const p=z.object({org:uuid,currency:z.string().regex(/^[A-Z]{3}$/),receivable:uuid,revenue:uuid,tax:uuid,dueDays:z.coerce.number().int().min(1).max(365),disputeDays:z.coerce.number().int().min(1).max(31),effectiveFrom:z.string().date(),reference:z.string().trim().min(3).max(500)}).safeParse(value);if(!p.success)return{status:"error"};name="propose_provider_closing_policy_v1";args={p_org:p.data.org,p_currency:p.data.currency,p_receivable:p.data.receivable,p_revenue:p.data.revenue,p_tax:p.data.tax,p_due_days:p.data.dueDays,p_dispute_days:p.data.disputeDays,p_effective_from:p.data.effectiveFrom,p_reference:`${p.data.reference} — ${v.reason}`};
 }else{
  if(!id.success)return{status:"error"};if(v.operation==="review"){name="review_provider_financial_declaration_v1";args={p_declaration_id:id.data,p_approved:yes,p_reason:v.reason};}
  else if(v.operation==="confirm"){name="confirm_provider_receipt_declaration_v1";args={p_declaration_id:id.data,p_confirmed:yes,p_reason:v.reason};}
  else if(v.operation==="dispute"){const event=uuid.safeParse(value.eventId);if(!event.success)return{status:"error"};name="dispute_provider_billing_line_v1";args={p_period_id:id.data,p_event_id:event.data,p_reason:v.reason};}
  else if(v.operation==="resolve"){name="resolve_provider_billing_line_v1";args={p_dispute_id:id.data,p_release:yes,p_reason:v.reason};}
  else if(v.operation==="reversalCredit"){const key=z.string().uuid().safeParse(value.idempotencyKey);if(!key.success)return{status:"error"};name="issue_provider_dispute_reversal_credit_v1";args={p_reversal_id:id.data,p_reason:v.reason,p_idempotency_key:key.data};}
  else if(v.operation==="admit"){name="admit_provider_payable_v1";args={p_event_id:id.data,p_reason:v.reason};}
  else{name="decide_provider_closing_policy_v1";args={p_policy_id:id.data,p_approved:yes,p_reason:v.reason};}
 }
 const c=await getSupabaseServerClient(),{data:a}=await c.auth.getUser();if(!a.user)return{status:"error"};const result=await c.rpc(name,args);if(result.error)return{status:"error"};revalidatePath(`/${v.locale}/sous-traitant/facturation`);revalidatePath(`/${v.locale}/sous-traitant/facturation/pre-releve`);revalidatePath(`/${v.locale}/administration/finance/prestataires`);revalidatePath(`/${v.locale}/client/finances/encaissements-prestataire`);return{status:"success"};
}

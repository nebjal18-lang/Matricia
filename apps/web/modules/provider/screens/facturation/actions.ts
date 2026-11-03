"use server";

import{classifyAuthReadFailure}from"@/modules/shared/lib/auth/read-failure";
import { uploadPaymentProof } from "./payment-proof";
import { finalizeBillingIntent,persistBillingIntent,type BillingIntentResult } from "./billing-intents";
import { z } from "zod";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { invoiceInput, payableInput, paymentInput, paymentPlanRequestInput, reconciliationInput, statementInput } from "@/modules/provider/data/billing/model";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { parseMoneyToMinor } from "../devis/money";

export type BillingActionState=BillingIntentResult|{status:"idle"}|{status:"success";outcome:string}|{status:"error";reason:"VALIDATION"|"UNAUTHENTICATED"|"FORBIDDEN"|"CONFLICT"|"POLICY_REQUIRED"|"FAILED"};
const output=z.object({outcome:z.string().min(3)}).passthrough(),payableForm=payableInput.omit({proofHash:true}),paymentForm=paymentInput.omit({proofHash:true});
const t=(form:FormData,key:string)=>String(form.get(key)??"");
function err(error:{code?:string;message?:string}|null):BillingActionState{if(error?.message?.includes("BILLING_POLICY_REQUIRED"))return{status:"error",reason:"POLICY_REQUIRED"};if(error?.code==="42501")return{status:"error",reason:"FORBIDDEN"};if(error?.code==="23514"||error?.code==="23505"||error?.code==="55000"||error?.message?.includes("IDEMPOTENCY")||error?.message?.includes("OVERALLOCATED"))return{status:"error",reason:"CONFLICT"};return{status:"error",reason:"FAILED"}}
function response(data:unknown):BillingActionState{const parsed=output.safeParse(data);return parsed.success?{status:"success",outcome:parsed.data.outcome}:{status:"error",reason:"FAILED"}}
async function authenticated(){const client=await getSupabaseServerClient(),{data,error}=await client.auth.getUser();return{client,user:data.user,unavailable:classifyAuthReadFailure(error)==="UNAVAILABLE"}}
async function call(name:string,args:Record<string,unknown>):Promise<BillingActionState>{const{client,user,unavailable}=await authenticated();if(unavailable)return{status:"error",reason:"FAILED"};if(!user)return{status:"error",reason:"UNAUTHENTICATED"};const result=await client.rpc(name,args);return result.error?err(result.error):response(result.data)}
function locale(form:FormData){return isLocale(t(form,"locale"))}

export async function recordPayable(previous:BillingActionState,form:FormData):Promise<BillingActionState>{
 const {client,user,unavailable}=await authenticated();if(unavailable)return{status:"error",reason:"FAILED"};if(!user)return{status:"error",reason:"UNAUTHENTICATED"};
 if(previous.status==="pending_scan")return finalizeBillingIntent(client,previous.intentId);
 if(!locale(form))return{status:"error",reason:"VALIDATION"};
 const organization=z.string().uuid().safeParse(t(form,"organizationId")),missionId=z.string().uuid().safeParse(t(form,"missionId"));
 if(!organization.success||!missionId.success)return{status:"error",reason:"VALIDATION"};
 const mission=await client.from("missions").select("contract_version_id").eq("id",t(form,"missionId")).eq("provider_organization_id",t(form,"organizationId")).maybeSingle();
 const missionValue=z.object({contract_version_id:z.string().uuid()}).safeParse(mission.data);if(mission.error)return{status:"error",reason:"FAILED"};if(!missionValue.success)return{status:"error",reason:"FORBIDDEN"};
 const contract=await client.from("contract_versions").select("currency").eq("id",missionValue.data.contract_version_id).maybeSingle(),contractValue=z.object({currency:z.string().regex(/^[A-Z]{3}$/u)}).safeParse(contract.data);if(contract.error)return{status:"error",reason:"FAILED"};if(!contractValue.success)return{status:"error",reason:"FORBIDDEN"};const currency=contractValue.data.currency;
 const parsed=payableForm.safeParse({missionId:t(form,"missionId"),paymentMethod:t(form,"paymentMethod"),eventType:t(form,"eventType"),occurredOn:t(form,"occurredOn"),currency,grossAmountMinor:parseMoneyToMinor(t(form,"grossAmount"),currency),clientReceiptReference:t(form,"clientReceiptReference"),idempotencyKey:t(form,"idempotencyKey")});
 if(!organization.success||!parsed.success)return{status:"error",reason:"VALIDATION"};
 const uploaded=await uploadPaymentProof(client,organization.data,parsed.data.idempotencyKey,form.get("proofFile"),"PAYABLE");if(uploaded.status==="error")return uploaded;
 return persistBillingIntent(client,organization.data,"PAYABLE",{...parsed.data,proofHash:uploaded.proofHash},parsed.data.idempotencyKey);
}

export async function issueStatement(_:BillingActionState,form:FormData):Promise<BillingActionState>{if(!locale(form))return{status:"error",reason:"VALIDATION"};const parsed=statementInput.safeParse({organizationId:t(form,"organizationId"),statementNumber:t(form,"statementNumber"),periodStart:t(form,"periodStart"),periodEnd:t(form,"periodEnd"),currency:t(form,"currency").toUpperCase(),idempotencyKey:t(form,"idempotencyKey")});if(!parsed.success)return{status:"error",reason:"VALIDATION"};const value=parsed.data;return call("issue_provider_statement",{p_provider_organization_id:value.organizationId,p_statement_number:value.statementNumber,p_period_start:value.periodStart,p_period_end:value.periodEnd,p_currency:value.currency,p_idempotency_key:value.idempotencyKey})}
export async function issueInvoice(_:BillingActionState,form:FormData):Promise<BillingActionState>{if(!locale(form))return{status:"error",reason:"VALIDATION"};const parsed=invoiceInput.safeParse({statementId:t(form,"statementId"),invoiceNumber:t(form,"invoiceNumber"),issuedOn:t(form,"issuedOn"),dueOn:t(form,"dueOn"),receivableAccountId:t(form,"receivableAccountId"),revenueAccountId:t(form,"revenueAccountId"),taxLiabilityAccountId:t(form,"taxLiabilityAccountId"),idempotencyKey:t(form,"idempotencyKey")});if(!parsed.success)return{status:"error",reason:"VALIDATION"};const value=parsed.data;return call("issue_provider_invoice",{p_statement_id:value.statementId,p_invoice_number:value.invoiceNumber,p_issued_on:value.issuedOn,p_due_on:value.dueOn,p_receivable_account_id:value.receivableAccountId,p_revenue_account_id:value.revenueAccountId,p_tax_liability_account_id:value.taxLiabilityAccountId,p_idempotency_key:value.idempotencyKey})}
export async function recordPayment(previous:BillingActionState,form:FormData):Promise<BillingActionState>{
 const {client,user,unavailable}=await authenticated();if(unavailable)return{status:"error",reason:"FAILED"};if(!user)return{status:"error",reason:"UNAUTHENTICATED"};
 if(previous.status==="pending_scan")return finalizeBillingIntent(client,previous.intentId);
 if(!locale(form))return{status:"error",reason:"VALIDATION"};
 const invoiceId=z.string().uuid().safeParse(t(form,"invoiceId"));if(!invoiceId.success)return{status:"error",reason:"VALIDATION"};
 const invoice=await client.from("provider_invoices").select("currency").eq("id",invoiceId.data).eq("provider_organization_id",t(form,"organizationId")).maybeSingle(),invoiceValue=z.object({currency:z.string().regex(/^[A-Z]{3}$/u)}).safeParse(invoice.data);if(invoice.error)return{status:"error",reason:"FAILED"};if(!invoiceValue.success)return{status:"error",reason:"FORBIDDEN"};const currency=invoiceValue.data.currency;
 const parsed=paymentForm.safeParse({organizationId:t(form,"organizationId"),paymentReference:t(form,"paymentReference"),paidOn:t(form,"paidOn"),paymentMethod:t(form,"paymentMethod"),currency,amountMinor:parseMoneyToMinor(t(form,"amount"),currency),cashAccountId:t(form,"cashAccountId"),receivableAccountId:t(form,"receivableAccountId"),idempotencyKey:t(form,"idempotencyKey")});
 if(!parsed.success)return{status:"error",reason:"VALIDATION"};
 const uploaded=await uploadPaymentProof(client,parsed.data.organizationId,parsed.data.idempotencyKey,form.get("proofFile"));if(uploaded.status==="error")return uploaded;
 return persistBillingIntent(client,parsed.data.organizationId,"PAYMENT",{...parsed.data,proofHash:uploaded.proofHash},parsed.data.idempotencyKey);
}
export async function resumeBillingIntent(_:BillingActionState,form:FormData):Promise<BillingActionState>{
 const {client,user,unavailable}=await authenticated();if(unavailable)return{status:"error",reason:"FAILED"};if(!user)return{status:"error",reason:"UNAUTHENTICATED"};return finalizeBillingIntent(client,t(form,"intentId"));
}
export async function cancelBillingIntent(_:BillingActionState,form:FormData):Promise<BillingActionState>{
 const id=z.string().uuid().safeParse(t(form,"intentId"));if(!id.success)return{status:"error",reason:"VALIDATION"};
 return call("cancel_my_provider_billing_intent",{p_intent_id:id.data});
}

export async function reconcilePayment(_:BillingActionState,form:FormData):Promise<BillingActionState>{
  if(!locale(form))return{status:"error",reason:"VALIDATION"};const{client,user,unavailable}=await authenticated();if(unavailable)return{status:"error",reason:"FAILED"};if(!user)return{status:"error",reason:"UNAUTHENTICATED"};const paymentId=t(form,"paymentId"),currencyResult=await client.from("provider_payments").select("currency").eq("id",paymentId).maybeSingle();if(currencyResult.error)return{status:"error",reason:"FAILED"};const currency=z.object({currency:z.string().regex(/^[A-Z]{3}$/u)}).safeParse(currencyResult.data);if(!currency.success)return{status:"error",reason:"FORBIDDEN"};const amount=parseMoneyToMinor(t(form,"amount"),currency.data.currency);
  const parsed=reconciliationInput.safeParse({paymentId,invoiceId:t(form,"invoiceId"),amountMinor:amount,idempotencyKey:t(form,"idempotencyKey")});if(!parsed.success)return{status:"error",reason:"VALIDATION"};const value=parsed.data,result=await client.rpc("reconcile_provider_payment",{p_payment_id:value.paymentId,p_allocations:[{invoice_id:value.invoiceId,amount_minor:value.amountMinor}],p_idempotency_key:value.idempotencyKey});return result.error?err(result.error):response(result.data);
}
export async function requestPaymentPlan(_:BillingActionState,form:FormData):Promise<BillingActionState>{
  if(!locale(form))return{status:"error",reason:"VALIDATION"};
  const {client,user,unavailable}=await authenticated();if(unavailable)return{status:"error",reason:"FAILED"};if(!user)return{status:"error",reason:"UNAUTHENTICATED"};
  const invoiceId=z.string().uuid().safeParse(t(form,"invoiceId"));if(!invoiceId.success)return{status:"error",reason:"VALIDATION"};
  const invoice=await client.from("provider_invoices").select("currency").eq("id",invoiceId.data).maybeSingle();const currencyValue=z.object({currency:z.string().regex(/^[A-Z]{3}$/u)}).safeParse(invoice.data);if(invoice.error)return{status:"error",reason:"FAILED"};if(!currencyValue.success)return{status:"error",reason:"FORBIDDEN"};const currency=currencyValue.data.currency;
  const first=parseMoneyToMinor(t(form,"amount1"),currency),second=parseMoneyToMinor(t(form,"amount2"),currency);
  const parsed=paymentPlanRequestInput.safeParse({invoiceId:t(form,"invoiceId"),reason:t(form,"reason"),dueOn1:t(form,"dueOn1"),dueOn2:t(form,"dueOn2"),amountMinor1:first,amountMinor2:second,idempotencyKey:t(form,"idempotencyKey")});
  if(!parsed.success)return{status:"error",reason:"VALIDATION"};
  const value=parsed.data;
  return call("request_provider_payment_plan",{p_invoice_id:value.invoiceId,p_installments:[{due_on:value.dueOn1,amount_minor:value.amountMinor1},{due_on:value.dueOn2,amount_minor:value.amountMinor2}],p_reason:value.reason,p_idempotency_key:value.idempotencyKey});
}

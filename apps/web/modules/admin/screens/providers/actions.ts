"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { companyDecisionInput, documentDecisionInput, qualificationDecisionInput } from "@/modules/admin/data/providers/model";
import { collectionAdvanceInput, collectionOpenInput, creditNoteInput, invoiceInput, paymentInput, paymentPlanDecisionInput, reconciliationInput, statementInput } from "@/modules/provider/data/billing/model";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { parseMoneyToMinor } from "@/modules/provider/screens/devis/money";

export type AdminProviderActionState = { status: "pending_scan"; payment: z.infer<typeof paymentInput>; intentId?: string } | { status: "idle" } | { status: "success"; outcome: string } | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "CONFLICT" | "FAILED" | "BILLING_POLICY_REQUIRED" };
const output = z.object({ outcome: z.string().min(3) }).passthrough(); const text = (data: FormData, key: string) => String(data.get(key) ?? ""); const nullable = (value: string) => value.trim() || null;
function percentageToBasisPoints(value: string): number | null { const normalized = value.trim().replace(",", "."); if (!/^(?:\d{1,2}(?:\.\d{1,2})?|100(?:\.0{1,2})?)$/u.test(normalized)) return null; const [whole = "0", decimals = ""] = normalized.split("."); return Number(whole) * 100 + Number(decimals.padEnd(2, "0")); }
function optionalIso(value: string): string | null { if (!value.trim()) return null; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString(); }
function failure(error: { code?: string; message?: string } | null): AdminProviderActionState { if(error?.message?.includes("BILLING_POLICY_REQUIRED"))return{status:"error",reason:"BILLING_POLICY_REQUIRED"}; if (error?.code === "42501") return { status: "error", reason: "FORBIDDEN" }; if (["40001", "23505", "23514", "55000"].includes(error?.code ?? "") || error?.message?.includes("IDEMPOTENCY") || error?.message?.includes("OVERALLOCATED")) return { status: "error", reason: "CONFLICT" }; return { status: "error", reason: "FAILED" }; }
function refreshProviderDossiers(){
  revalidatePath("/[locale]/administration/providers","page");
  revalidatePath("/[locale]/sous-traitant/qualification","page");
  revalidatePath("/[locale]/sous-traitant/services","page");
  revalidatePath("/[locale]/sous-traitant/documents","page");
  revalidatePath("/[locale]/sous-traitant/facturation","page");
}
async function rpc(name: string, args: Record<string, unknown>): Promise<AdminProviderActionState> { const client = await getSupabaseServerClient(); const { data } = await client.auth.getUser(); if (!data.user) return { status: "error", reason: "UNAUTHENTICATED" }; const result = await client.rpc(name, args); if (result.error) return failure(result.error); const parsed = output.safeParse(result.data); if(!parsed.success)return{status:"error",reason:"FAILED"};refreshProviderDossiers();return{status:"success",outcome:parsed.data.outcome}; }

async function paymentProof(value: FormDataEntryValue | null): Promise<{ bytes: Buffer; hash: string; mimeType: string; size: number; fileName: string } | null> {
  if (!(value instanceof File) || value.size < 1 || value.size > 10 * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png"].includes(value.type)) return null;
  if (value.name.length < 3 || value.name.length > 255 || /[\\/\u0000-\u001f\u007f]/u.test(value.name)) return null;
  let bytes: Buffer;
  try { bytes = Buffer.from(await value.arrayBuffer()); } catch { return null; }
  const signatures: Record<string, number[]> = { "application/pdf": [0x25, 0x50, 0x44, 0x46, 0x2d], "image/jpeg": [0xff, 0xd8, 0xff], "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] };
  return signatures[value.type]?.every((byte, index) => bytes[index] === byte)
    ? { bytes, hash: createHash("sha256").update(bytes).digest("hex"), mimeType: value.type, size: value.size, fileName: value.name }
    : null;
}

export async function decideCompany(_: AdminProviderActionState, data: FormData): Promise<AdminProviderActionState> { const parsed = companyDecisionInput.safeParse({ organizationId: text(data, "organizationId"), companyStatus: text(data, "companyStatus"), partnerContractStatus: text(data, "partnerContractStatus"), partnerContractExpiresAt: nullable(text(data, "partnerContractExpiresAt")), reason: text(data, "reason"), ruleVersion: text(data, "ruleVersion").toUpperCase(), expectedRowVersion: text(data, "expectedRowVersion"), idempotencyKey: text(data, "idempotencyKey") }); if (!parsed.success) return { status: "error", reason: "VALIDATION" }; const value = parsed.data; return rpc("decide_provider_company", { p_provider_organization_id: value.organizationId, p_company_status: value.companyStatus, p_partner_contract_status: value.partnerContractStatus, p_partner_contract_expires_at: value.partnerContractExpiresAt, p_reason: value.reason, p_rule_version: value.ruleVersion, p_expected_row_version: value.expectedRowVersion, p_idempotency_key: value.idempotencyKey }); }
export async function reviewDocument(_: AdminProviderActionState, data: FormData): Promise<AdminProviderActionState> { const parsed = documentDecisionInput.safeParse({ documentVersionId: text(data, "documentVersionId"), status: text(data, "status"), rationale: text(data, "rationale"), ruleVersion: text(data, "ruleVersion").toUpperCase(), idempotencyKey: text(data, "idempotencyKey") }); if (!parsed.success) return { status: "error", reason: "VALIDATION" }; const value = parsed.data; return rpc("review_provider_document", { p_document_version_id: value.documentVersionId, p_status: value.status, p_rationale: value.rationale, p_rule_version: value.ruleVersion, p_idempotency_key: value.idempotencyKey }); }
export async function decideQualification(_: AdminProviderActionState, data: FormData): Promise<AdminProviderActionState> {
  const status=text(data,"status"),needsEvidence=status==="APPROVED"||status==="CONDITIONAL";
  const reviewed=z.object({sessionId:z.string().uuid(),hash:z.string().regex(/^[a-f0-9]{64}$/u),confirmed:z.literal("yes")}).safeParse({sessionId:text(data,"questionnaireSessionId"),hash:text(data,"reviewedManifestHash"),confirmed:text(data,"evidenceConfirmed")});
  const scoreBasisPoints=needsEvidence?percentageToBasisPoints(text(data,"scorePercent")):null;
  if(needsEvidence&&(!reviewed.success||scoreBasisPoints===null))return{status:"error",reason:"VALIDATION"};
  const conditions=text(data,"blockingConditions").split(/\r?\n/u).map(value=>value.trim()).filter(Boolean).slice(0,100).map(condition=>({condition}));
  const parsed=qualificationDecisionInput.safeParse({qualificationId:text(data,"qualificationId"),status,questionnaireSessionId:needsEvidence&&reviewed.success?reviewed.data.sessionId:null,scoreBasisPoints,mandatoryChecks:needsEvidence&&reviewed.success?[{check:"SUBMITTED_PROVIDER_QUESTIONNAIRE",passed:true},{check:"HUMAN_EVIDENCE_REVIEW",passed:true,review_context_hash:reviewed.data.hash}]:[],blockingConditions:conditions,rationale:text(data,"rationale"),ruleVersion:"PROVIDER-QUALIFICATION-V1",expiresAt:optionalIso(text(data,"expiresAt")),expectedRowVersion:text(data,"expectedRowVersion"),idempotencyKey:text(data,"idempotencyKey")});
  if(!parsed.success)return{status:"error",reason:"VALIDATION"};const value=parsed.data;
  return rpc("decide_provider_qualification",{p_qualification_id:value.qualificationId,p_status:value.status,p_questionnaire_session_id:value.questionnaireSessionId,p_score_basis_points:value.scoreBasisPoints,p_mandatory_checks:value.mandatoryChecks,p_blocking_conditions:value.blockingConditions,p_rationale:value.rationale,p_rule_version:value.ruleVersion,p_expires_at:value.expiresAt,p_expected_row_version:value.expectedRowVersion,p_idempotency_key:value.idempotencyKey});
}

export async function issueAdminStatement(_: AdminProviderActionState, data: FormData): Promise<AdminProviderActionState> { const parsed = statementInput.safeParse({ organizationId: text(data, "organizationId"), statementNumber: text(data, "statementNumber"), periodStart: text(data, "periodStart"), periodEnd: text(data, "periodEnd"), currency: text(data, "currency").toUpperCase(), idempotencyKey: text(data, "idempotencyKey") }); if (!parsed.success) return { status: "error", reason: "VALIDATION" }; const value = parsed.data; return rpc("issue_provider_statement", { p_provider_organization_id: value.organizationId, p_statement_number: value.statementNumber, p_period_start: value.periodStart, p_period_end: value.periodEnd, p_currency: value.currency, p_idempotency_key: value.idempotencyKey }); }
export async function issueAdminInvoice(_: AdminProviderActionState, data: FormData): Promise<AdminProviderActionState> { const parsed = invoiceInput.safeParse({ statementId: text(data, "statementId"), invoiceNumber: text(data, "invoiceNumber"), issuedOn: text(data, "issuedOn"), dueOn: text(data, "dueOn"), receivableAccountId: text(data, "receivableAccountId"), revenueAccountId: text(data, "revenueAccountId"), taxLiabilityAccountId: text(data, "taxLiabilityAccountId"), idempotencyKey: text(data, "idempotencyKey") }); if (!parsed.success) return { status: "error", reason: "VALIDATION" }; const value = parsed.data; return rpc("issue_provider_invoice", { p_statement_id: value.statementId, p_invoice_number: value.invoiceNumber, p_issued_on: value.issuedOn, p_due_on: value.dueOn, p_receivable_account_id: value.receivableAccountId, p_revenue_account_id: value.revenueAccountId, p_tax_liability_account_id: value.taxLiabilityAccountId, p_idempotency_key: value.idempotencyKey }); }
export async function recordAdminPayment(previous: AdminProviderActionState, data: FormData): Promise<AdminProviderActionState> {
  if (text(data, "intent") === "RESET_PAYMENT") {
    if (previous.status === "pending_scan" && previous.intentId) {
      const client=await getSupabaseServerClient();const cancelled=await client.rpc("cancel_my_provider_billing_intent",{p_intent_id:previous.intentId});if(cancelled.error)return failure(cancelled.error);
    }
    return {status:"idle"};
  }
  const client=await getSupabaseServerClient(),{data:auth}=await client.auth.getUser();if(!auth.user)return{status:"error",reason:"UNAUTHENTICATED"};
  let currency=previous.status==="pending_scan"?previous.payment.currency:"";
  if(previous.status!=="pending_scan"){
   const invoiceId=z.string().uuid().safeParse(text(data,"invoiceId"));if(!invoiceId.success)return{status:"error",reason:"VALIDATION"};
   const invoice=await client.from("provider_invoices").select("currency,provider_organization_id").eq("id",invoiceId.data).maybeSingle(),parsedInvoice=z.object({currency:z.string().regex(/^[A-Z]{3}$/u),provider_organization_id:z.string().uuid()}).safeParse(invoice.data);if(invoice.error)return failure(invoice.error);if(!parsedInvoice.success||parsedInvoice.data.provider_organization_id!==text(data,"organizationId"))return{status:"error",reason:"FORBIDDEN"};currency=parsedInvoice.data.currency;
  }
  const amountMinor=parseMoneyToMinor(text(data,"amount"),currency),proof=await paymentProof(data.get("proofFile"));
  const parsed = paymentInput.safeParse(previous.status === "pending_scan" ? previous.payment : { organizationId: text(data, "organizationId"), paymentReference: text(data, "paymentReference"), paidOn: text(data, "paidOn"), paymentMethod: text(data, "paymentMethod"), currency, amountMinor, proofHash: proof?.hash, cashAccountId: text(data, "cashAccountId"), receivableAccountId: text(data, "receivableAccountId"), idempotencyKey: text(data, "idempotencyKey") });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const value = parsed.data;
  if (previous.status !== "pending_scan") {
  if (!proof) return { status: "error", reason: "VALIDATION" };
  const reservationResult = await client.rpc("begin_provider_payment_proof_upload", { p_provider_organization_id: value.organizationId, p_original_file_name: proof.fileName, p_declared_mime_type: proof.mimeType, p_declared_size_bytes: proof.size, p_declared_sha256: proof.hash, p_idempotency_key: `${value.idempotencyKey}:proof` });
  if (reservationResult.error) return failure(reservationResult.error);
  const reservation = z.object({ outcome: z.literal("PROVIDER_PAYMENT_PROOF_UPLOAD_RESERVED"), storage_bucket: z.literal("provider-qualification"), storage_object_path: z.string().min(40).max(400) }).passthrough().safeParse(reservationResult.data);
  if (!reservation.success) return { status: "error", reason: "FAILED" };
  const uploaded = await client.storage.from(reservation.data.storage_bucket).upload(reservation.data.storage_object_path, proof.bytes, { contentType: proof.mimeType, cacheControl: "3600", upsert: false });
  if (uploaded.error && String((uploaded.error as { statusCode?: unknown }).statusCode ?? "") !== "409") return { status: "error", reason: "FAILED" };
  }
  let intentId=previous.status==="pending_scan"?previous.intentId:undefined;
  if(!intentId){
    const saved=await client.rpc("save_my_provider_billing_intent",{p_provider_organization_id:value.organizationId,p_kind:"PAYMENT",p_payload:value,p_idempotency_key:value.idempotencyKey});
    if(saved.error)return failure(saved.error);
    const parsedIntent=z.object({intent_id:z.string().uuid()}).safeParse(saved.data);if(!parsedIntent.success)return{status:"error",reason:"FAILED"};intentId=parsedIntent.data.intent_id;
  }
  const finalized=await client.rpc("finalize_my_provider_billing_intent",{p_intent_id:intentId});if(finalized.error)return failure(finalized.error);
  const result=output.safeParse(finalized.data);if(!result.success)return{status:"error",reason:"FAILED"};
  if(result.data.outcome==="PROVIDER_BILLING_SCAN_PENDING")return{status:"pending_scan",payment:value,intentId};
  return ["PROVIDER_PAYMENT_RECORDED","PROVIDER_FINANCIAL_DECLARATION_SUBMITTED"].includes(result.data.outcome)?{status:"success",outcome:result.data.outcome}:{status:"error",reason:["PROVIDER_BILLING_PROOF_EXPIRED","PROVIDER_BILLING_PROOF_REJECTED"].includes(result.data.outcome)?"CONFLICT":"FAILED"};
}
export async function reconcileAdminPayment(_: AdminProviderActionState, data: FormData): Promise<AdminProviderActionState> {
  const client = await getSupabaseServerClient(), { data: auth } = await client.auth.getUser();
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const paymentId = text(data, "paymentId"), result = await client.from("provider_payments").select("currency").eq("id", paymentId).maybeSingle();
  if (result.error) return failure(result.error);
  const currency = z.object({ currency: z.string().regex(/^[A-Z]{3}$/u) }).safeParse(result.data);
  if (!currency.success) return { status: "error", reason: "FORBIDDEN" };
  const parsed = reconciliationInput.safeParse({ paymentId, invoiceId: text(data, "invoiceId"), amountMinor: parseMoneyToMinor(text(data, "amount"), currency.data.currency), idempotencyKey: text(data, "idempotencyKey") });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const value = parsed.data, rpcResult = await client.rpc("reconcile_provider_payment", { p_payment_id: value.paymentId, p_allocations: [{ invoice_id: value.invoiceId, amount_minor: value.amountMinor }], p_idempotency_key: value.idempotencyKey });
  return rpcResult.error ? failure(rpcResult.error) : output.safeParse(rpcResult.data).success ? { status: "success", outcome: output.parse(rpcResult.data).outcome } : { status: "error", reason: "FAILED" };
}
export async function issueAdminCreditNote(_: AdminProviderActionState, data: FormData): Promise<AdminProviderActionState> {
  const invoiceId = text(data, "invoiceId"), client = await getSupabaseServerClient(), { data: auth } = await client.auth.getUser();
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const invoiceResult = await client.from("provider_invoice_balances").select("currency").eq("id", invoiceId).maybeSingle();
  if (invoiceResult.error) return failure(invoiceResult.error);
  const currency = z.object({ currency: z.string().regex(/^[A-Z]{3}$/u) }).safeParse(invoiceResult.data);
  if (!currency.success) return { status: "error", reason: "FORBIDDEN" };
  const parsed = creditNoteInput.safeParse({ invoiceId, creditNumber: text(data, "creditNumber"), issuedOn: text(data, "issuedOn"), subtotalMinor: parseMoneyToMinor(text(data, "subtotal"), currency.data.currency), reason: text(data, "reason"), idempotencyKey: text(data, "idempotencyKey") });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const value = parsed.data;
  return rpc("issue_provider_credit_note", { p_invoice_id: value.invoiceId, p_credit_number: value.creditNumber, p_issued_on: value.issuedOn, p_subtotal_minor: value.subtotalMinor, p_tax_minor: "0", p_reason: value.reason, p_idempotency_key: value.idempotencyKey });
}
export async function decideAdminPaymentPlan(_: AdminProviderActionState, data: FormData): Promise<AdminProviderActionState> {
  const parsed = paymentPlanDecisionInput.safeParse({ planId: text(data, "planId"), status: text(data, "status"), reason: text(data, "reason"), idempotencyKey: text(data, "idempotencyKey") });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const value = parsed.data;
  return rpc("decide_provider_payment_plan", { p_plan_id: value.planId, p_status: value.status, p_reason: value.reason, p_idempotency_key: value.idempotencyKey });
}
export async function openAdminCollectionCase(_: AdminProviderActionState, data: FormData): Promise<AdminProviderActionState> {
  const parsed = collectionOpenInput.safeParse({ invoiceId: text(data, "invoiceId"), reason: text(data, "reason"), idempotencyKey: text(data, "idempotencyKey") });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const value = parsed.data;
  return rpc("open_provider_collection_case", { p_invoice_id: value.invoiceId, p_reason: value.reason, p_idempotency_key: value.idempotencyKey });
}
export async function advanceAdminCollectionCase(_: AdminProviderActionState, data: FormData): Promise<AdminProviderActionState> {
  const parsed = collectionAdvanceInput.safeParse({ caseId: text(data, "caseId"), status: text(data, "status"), reason: text(data, "reason"), idempotencyKey: text(data, "idempotencyKey") });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const value = parsed.data;
  return rpc("advance_provider_collection_case", { p_case_id: value.caseId, p_status: value.status, p_reason: value.reason, p_idempotency_key: value.idempotencyKey });
}

export type AdminBillingIntentState={status:"idle"|"success"|"pending_scan"|"error"};
export async function resumeAdminBillingIntent(_:AdminBillingIntentState,form:FormData):Promise<AdminBillingIntentState>{
 const id=z.string().uuid().safeParse(text(form,"intentId"));if(!id.success)return{status:"error"};const client=await getSupabaseServerClient();const{data:auth}=await client.auth.getUser();if(!auth.user)return{status:"error"};
 const result=await client.rpc("finalize_my_provider_billing_intent",{p_intent_id:id.data});if(result.error)return{status:"error"};const parsed=output.safeParse(result.data);if(!parsed.success)return{status:"error"};return parsed.data.outcome==="PROVIDER_BILLING_SCAN_PENDING"?{status:"pending_scan"}:["PROVIDER_PAYMENT_RECORDED","PROVIDER_PAYABLE_RECORDED","PROVIDER_FINANCIAL_DECLARATION_SUBMITTED"].includes(parsed.data.outcome)?{status:"success"}:{status:"error"};
}
export async function cancelAdminBillingIntent(_:AdminBillingIntentState,form:FormData):Promise<AdminBillingIntentState>{const id=z.string().uuid().safeParse(text(form,"intentId"));if(!id.success)return{status:"error"};const client=await getSupabaseServerClient();const{data:auth}=await client.auth.getUser();if(!auth.user)return{status:"error"};const result=await client.rpc("cancel_my_provider_billing_intent",{p_intent_id:id.data});return result.error?{status:"error"}:{status:"success"};}

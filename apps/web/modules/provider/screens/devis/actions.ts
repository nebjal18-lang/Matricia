"use server";

import {QUOTE_OPTION_PRICING_V1} from "@/modules/shared/lib/contracts-missions/quote-option-pricing";
import {classifyAuthReadFailure} from "@/modules/shared/lib/auth/read-failure";
import { businessLocalToInstant } from "./business-time";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { invitationDecisionInput, lines, quoteDraftInput, submitQuoteIdentityInput } from "@/modules/provider/data/quotes/model";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { parseMoneyToMinor } from "./money";

export type QuoteActionState =
  | { status: "idle" }
  | { status: "success"; outcome: string }
  | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "CONFLICT" | "IDENTITY_REQUIRED" | "ATTACHMENT_UNAVAILABLE" | "FAILED" };

const quoteLine = z.object({
  label: z.string().trim().min(2).max(500),
  quantity: z.string().regex(/^\d{1,14}(?:\.\d{1,4})?$/u),
  unitCode: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9_]{0,31}$/u),
  unitPriceMinor: z.string().regex(/^\d{1,18}$/u),
  taxRuleVersionId: z.string().uuid(),
  itemKind: z.enum(["ONE_TIME", "RECURRING"]),
  recurrenceInterval: z.enum(["", "MONTH", "QUARTER", "YEAR"]),
}).superRefine((value, context) => {
  if ((value.itemKind === "RECURRING") !== (value.recurrenceInterval !== "")) context.addIssue({ code: "custom", path: ["recurrenceInterval"], message: "RECURRENCE_MISMATCH" });
});
const rfqScope = z.object({ provider_organization_id: z.string().uuid(), rfqs: z.object({ request_version_id: z.string().uuid() }) });
const requestBasis = z.object({ currency_code: z.string().regex(/^[A-Z]{3}$/u) });
const taxRule = z.object({ id: z.string().uuid() });
const text = (form: FormData, key: string) => String(form.get(key) ?? "");
const texts = (form: FormData, key: string) => form.getAll(key).map((value) => String(value));

function actionError(value: { code?: string; message?: string } | null): QuoteActionState {
  if(value?.message&&["PROVIDER_CURRENT_IDENTITY_REVIEW_REQUIRED","QUOTE_IDENTITY_CONFIRMATION_REQUIRED","QUOTE_IDENTITY_REPUBLICATION_REQUIRED"].some(reason=>value.message!.includes(reason)))return{status:"error",reason:"IDENTITY_REQUIRED"};
  if(value?.message?.includes("QUOTE_ATTACHMENT_QUARANTINED"))return{status:"error",reason:"ATTACHMENT_UNAVAILABLE"};
  if(value?.code==="22023")return{status:"error",reason:"VALIDATION"};
  if (value?.code === "42501") return { status: "error", reason: "FORBIDDEN" };
  if (["40001", "55000", "22000"].includes(value?.code ?? "")) return { status: "error", reason: "CONFLICT" };
  return { status: "error", reason: "FAILED" };
}
async function client() { const supabase = await getSupabaseServerClient(); const { data,error } = await supabase.auth.getUser(); const authFailure=classifyAuthReadFailure(error); return { supabase, user:authFailure?null:data.user,authFailure }; }
const refresh = (locale: string) => revalidatePath(`/${locale}/sous-traitant/devis`);

export async function decideInvitation(_: QuoteActionState, form: FormData): Promise<QuoteActionState> {
  const parsed = invitationDecisionInput.safeParse({ locale: text(form, "locale"), invitationId: text(form, "invitationId"), decision: text(form, "decision"), reason: text(form, "reason"), rowVersion: text(form, "rowVersion"), idempotencyKey: text(form, "idempotencyKey"), correlationId: text(form, "correlationId") });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const { supabase, user,authFailure } = await client(); if (!user) return { status: "error", reason:authFailure==="UNAVAILABLE"?"FAILED":"UNAUTHENTICATED" };
  const result = await supabase.rpc("respond_to_rfq_invitation", { p_rfq_provider_id: parsed.data.invitationId, p_decision: parsed.data.decision, p_reason: parsed.data.reason || null, p_expected_row_version: parsed.data.rowVersion, p_idempotency_key: parsed.data.idempotencyKey, p_correlation_id: parsed.data.correlationId });
  if (result.error) return actionError(result.error); refresh(parsed.data.locale);
  return { status: "success", outcome: String((result.data as { outcome?: string })?.outcome ?? "RFQ_INVITATION_UPDATED") };
}

export async function saveQuoteRevision(_: QuoteActionState, form: FormData): Promise<QuoteActionState> {
  let validUntil = text(form, "validUntil");
  try { validUntil = businessLocalToInstant(validUntil); } catch { return { status: "error", reason: "VALIDATION" }; }
  const locale = text(form, "locale"), currency = text(form, "currency").toUpperCase();
  const labels = texts(form, "lineLabel"), quantities = texts(form, "quantity"), units = texts(form, "unitCode"), prices = texts(form, "unitPrice"), taxes = texts(form, "taxRuleVersionId"), kinds = texts(form, "itemKind"), intervals = texts(form, "recurrenceInterval");
  if (!labels.length || labels.length > 50 || [quantities, units, prices, taxes, kinds, intervals].some((values) => values.length !== labels.length)) return { status: "error", reason: "VALIDATION" };
  const parsedLines = labels.map((label, index) => quoteLine.safeParse({ label, quantity: quantities[index], unitCode: units[index], unitPriceMinor: parseMoneyToMinor(prices[index] ?? "", currency), taxRuleVersionId: taxes[index], itemKind: kinds[index], recurrenceInterval: intervals[index] }));
  const lineValues: z.infer<typeof quoteLine>[] = [];
  for (const line of parsedLines) { if (!line.success) return { status: "error", reason: "VALIDATION" }; lineValues.push(line.data); }
  const optionLabels = texts(form,"optionLabel"), optionPrices = texts(form,"optionPrice");
  if (optionLabels.length > 20 || optionLabels.length !== optionPrices.length) return {status:"error",reason:"VALIDATION"};
  const options: {option_key:string;label_fr:string;label_ar:string|null;amount_minor:string;currency:string;included_by_default:false}[] = [];
  for (let index=0; index<optionLabels.length; index++) {
    const label = z.string().trim().min(2).max(500).safeParse(optionLabels[index]);
    const amount = z.string().regex(/^\d{1,18}$/u).safeParse(parseMoneyToMinor(optionPrices[index]??"",currency));
    if (!label.success || !amount.success) return {status:"error",reason:"VALIDATION"};
    options.push({option_key:`OPTION_${index+1}`,label_fr:label.data,label_ar:locale==="ar"?label.data:null,amount_minor:amount.data,currency,included_by_default:false});
  }
  const attachmentDocuments = texts(form,"attachmentDocumentId"), attachmentTitles = texts(form,"attachmentTitle");
  if (attachmentDocuments.length > 20 || attachmentDocuments.length !== attachmentTitles.length || new Set(attachmentDocuments).size !== attachmentDocuments.length) return {status:"error",reason:"VALIDATION"};
  const attachments: {document_version_id:string;title:string;share_confirmed:true}[]=[];
  for(let index=0;index<attachmentDocuments.length;index++) {
    const attachment=z.object({document_version_id:z.string().uuid(),title:z.string().trim().min(2).max(255),share_confirmed:z.literal(true)}).safeParse({document_version_id:attachmentDocuments[index],title:attachmentTitles[index],share_confirmed:form.get("shareAttachmentsConfirmed")==="yes"});
    if(!attachment.success)return{status:"error",reason:"VALIDATION"};
    attachments.push(attachment.data);
  }
  const firstLine = lineValues[0];
  if (!firstLine) return { status: "error", reason: "VALIDATION" };
  const sourceSolution = text(form, "solution"), sourceWarranty = text(form, "warranty"), sourceCorrections = text(form, "correctionTerms");
  const parsed = quoteDraftInput.safeParse({ paymentTerms:text(form,"paymentTerms"),maintenanceTerms:text(form,"maintenanceTerms"),locale, rfqProviderId: text(form, "rfqProviderId"), currency, solutionFr: sourceSolution, solutionAr: locale === "ar" ? sourceSolution : "", deliverables: text(form, "deliverables"), inclusions: text(form, "inclusions"), exclusions: text(form, "exclusions"), prerequisites: text(form, "prerequisites"), warrantyFr: sourceWarranty, warrantyAr: locale === "ar" ? sourceWarranty : "", correctionTermsFr: sourceCorrections, correctionTermsAr: locale === "ar" ? sourceCorrections : "", proposedStartDate: text(form, "proposedStartDate"), durationDays: text(form, "durationDays"), validUntil, lineLabelFr: firstLine.label, lineLabelAr: locale === "ar" ? firstLine.label : "", quantity: firstLine.quantity, unitCode: firstLine.unitCode, unitPriceMinor: firstLine.unitPriceMinor, taxRuleVersionId: firstLine.taxRuleVersionId, itemKind: firstLine.itemKind, recurrenceInterval: firstLine.recurrenceInterval, changeReason: text(form, "changeReason"), idempotencyKey: text(form, "idempotencyKey"), correlationId: text(form, "correlationId") });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const { supabase, user,authFailure } = await client(); if (!user) return { status: "error", reason:authFailure==="UNAVAILABLE"?"FAILED":"UNAUTHENTICATED" };
  const value = parsed.data;
  const scopeResult = await supabase.from("rfq_providers").select("provider_organization_id,rfqs!inner(request_version_id)").eq("id", value.rfqProviderId).maybeSingle();
  if (scopeResult.error) return { status: "error", reason: "FAILED" };
  const scope = rfqScope.safeParse(scopeResult.data); if (!scope.success) return { status: "error", reason: "VALIDATION" };
  const basisResult = await supabase.from("service_request_versions").select("currency_code").eq("id", scope.data.rfqs.request_version_id).maybeSingle();
  if (basisResult.error) return { status: "error", reason: "FAILED" };
  const basis = requestBasis.safeParse(basisResult.data); if (!basis.success || basis.data.currency_code !== value.currency) return { status: "error", reason: "VALIDATION" };
  // Resolve the same approved, immutable service mapping used by the command.
  // Legacy request JSON is not a fiscal authority.
  const policyResult = await supabase.rpc("list_provider_quote_service_tax_policies_v1", {
    p_provider_organization_id: scope.data.provider_organization_id,
    p_rfq_provider_ids: [value.rfqProviderId],
  });
  if (policyResult.error) return actionError(policyResult.error);
  const policies = z.array(z.object({ invitation_id: z.string().uuid(), category_code: z.string().regex(/^[A-Z][A-Z0-9_]{2,79}$/u).nullable(), blocked_reason: z.string().nullable() })).length(1).safeParse(policyResult.data);
  const policy = policies.success ? policies.data[0] : undefined;
  if (!policy || policy.invitation_id !== value.rfqProviderId || !policy.category_code || policy.blocked_reason) return { status: "error", reason: "VALIDATION" };
  const category = policy.category_code;
  for (const item of lineValues) {
    const taxResult = await supabase.from("tax_rule_versions").select("id").eq("id", item.taxRuleVersionId).eq("jurisdiction_code", "MA").eq("status", "ACTIVE").eq("professional_validation_status", "VALIDATED").eq("category_code", category).lte("effective_from", value.proposedStartDate).or(`effective_to.is.null,effective_to.gte.${value.proposedStartDate}`).maybeSingle();
    if (taxResult.error) return { status: "error", reason: "FAILED" };
    if (!taxRule.safeParse(taxResult.data).success) return { status: "error", reason: "VALIDATION" };
  }
  const payload = { currency: value.currency, solution_fr: value.solutionFr, solution_ar: value.solutionAr || null, deliverables: lines(value.deliverables), inclusions: lines(value.inclusions), exclusions: lines(value.exclusions), prerequisites: lines(value.prerequisites), warranty_fr: value.warrantyFr, warranty_ar: value.warrantyAr || null, correction_terms_fr: value.correctionTermsFr, correction_terms_ar: value.correctionTermsAr || null, sla: {quote_options_repricing_confirmed_v1:form.get("confirmHistoricalOptionBasis")==="yes",quote_options_pricing_v1:QUOTE_OPTION_PRICING_V1,commercial_terms_v1:{source_locale:value.locale,payment_terms:value.paymentTerms,maintenance_terms:value.maintenanceTerms}}, proposed_start_date: value.proposedStartDate, duration_days: String(value.durationDays), valid_until: value.validUntil, items: lineValues.map((line, index) => ({ line_number: String(index + 1), item_kind: line.itemKind, label_fr: line.label, label_ar: locale === "ar" ? line.label : null, quantity: line.quantity, unit_code: line.unitCode, unit_price_minor: line.unitPriceMinor, tax_rule_version_id: line.taxRuleVersionId, ...(line.itemKind === "RECURRING" ? { recurrence_interval: line.recurrenceInterval } : {}) })), options, attachments };
  const expectedVersion=z.string().uuid().nullable().safeParse(text(form,"expectedCurrentVersionId")||null);
  if(!expectedVersion.success)return{status:"error",reason:"VALIDATION"};
  const checkedPayload={...payload,expected_current_version_id:expectedVersion.data};
  const result = await supabase.rpc("create_quote_revision", { p_rfq_provider_id: value.rfqProviderId, p_payload: checkedPayload, p_change_reason: value.changeReason, p_idempotency_key: value.idempotencyKey, p_correlation_id: value.correlationId });
  if (result.error) return actionError(result.error); refresh(value.locale);
  const created=z.object({outcome:z.literal("QUOTE_REVISION_CREATED"),quote_id:z.string().uuid(),quote_version_id:z.string().uuid(),version_number:z.number().int().positive()}).safeParse(result.data);
  return created.success ? { status: "success", outcome: "QUOTE_REVISION_CREATED" } : {status:"error",reason:"FAILED"};
}

export async function submitQuote(_: QuoteActionState, form: FormData): Promise<QuoteActionState> {
  const parsed = submitQuoteIdentityInput.safeParse({expectedIdentityHash:text(form,"expectedIdentityHash"),registeredAddress:text(form,"registeredAddress"),confirmed:text(form,"confirmed"), locale: text(form, "locale"), quoteId: text(form, "quoteId"), quoteVersionId: text(form, "quoteVersionId"), idempotencyKey: text(form, "idempotencyKey"), correlationId: text(form, "correlationId") });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const { supabase, user,authFailure } = await client(); if (!user) return { status: "error", reason:authFailure==="UNAVAILABLE"?"FAILED":"UNAUTHENTICATED" };
  const result = await supabase.rpc("submit_provider_quote_with_identity_v1", {p_expected_identity_hash:parsed.data.expectedIdentityHash,p_registered_address:parsed.data.registeredAddress, p_quote_id: parsed.data.quoteId, p_expected_version_id: parsed.data.quoteVersionId, p_idempotency_key: parsed.data.idempotencyKey, p_correlation_id: parsed.data.correlationId ?? randomUUID() });
  if (result.error) return actionError(result.error); refresh(parsed.data.locale);
  return z.object({outcome:z.literal("QUOTE_SUBMITTED")}).safeParse(result.data).success?{status:"success",outcome:"QUOTE_SUBMITTED"}:{status:"error",reason:"FAILED"};
}

export async function reopenQuoteIdentity(_:QuoteActionState,form:FormData):Promise<QuoteActionState>{
 const parsed=z.object({locale:z.enum(["fr","ar"]),quoteId:z.string().uuid(),versionId:z.string().uuid(),reason:z.string().trim().min(10).max(1000),key:z.string().uuid()}).safeParse({locale:text(form,"locale"),quoteId:text(form,"quoteId"),versionId:text(form,"quoteVersionId"),reason:text(form,"reason"),key:text(form,"idempotencyKey")});if(!parsed.success)return{status:"error",reason:"VALIDATION"};
 const{supabase,user,authFailure}=await client();if(!user)return{status:"error",reason:authFailure==="UNAVAILABLE"?"FAILED":"UNAUTHENTICATED"};const value=parsed.data,result=await supabase.rpc("reopen_provider_quote_for_identity_review_v1",{p_quote_id:value.quoteId,p_expected_version_id:value.versionId,p_reason:value.reason,p_idempotency_key:value.key});if(result.error)return actionError(result.error);if(!z.object({outcome:z.literal("QUOTE_IDENTITY_REPUBLICATION_REQUESTED")}).safeParse(result.data).success)return{status:"error",reason:"FAILED"};refresh(value.locale);return{status:"success",outcome:"QUOTE_IDENTITY_REPUBLICATION_REQUESTED"};
}

export async function searchQuoteAttachmentChoices(organizationId:string,search:string,page:number) {
  const input=z.object({organizationId:z.string().uuid(),search:z.string().trim().max(200),page:z.number().int().min(1).max(100000)}).safeParse({organizationId,search,page});
  if(!input.success)return{status:"error"as const};
  const {supabase,user}=await client();if(!user)return{status:"error"as const};
  const result=await supabase.rpc("list_provider_quote_attachment_choices_v1",{p_organization_id:organizationId,p_query:input.data.search,p_page:page});
  const parsed=z.object({items:z.array(z.object({id:z.string().uuid(),code:z.string(),version_number:z.number().int().positive(),review_status:z.string(),scan_status:z.literal("CLEAN")})).max(25),total:z.number().int().nonnegative(),page:z.number().int().positive()}).safeParse(result.data);
  return result.error||!parsed.success?{status:"error"as const}:{status:"success"as const,...parsed.data};
}

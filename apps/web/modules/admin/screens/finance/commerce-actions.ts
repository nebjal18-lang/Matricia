"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { callBoxesCommand } from "@/modules/admin/data/boxes/repository";
import { closeAdminProfitPeriod } from "@/modules/admin/data/pnl/repository";
import { issueAdminProviderStatement, sweepAdminExceptions } from "@/modules/admin/data/closure/repository";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { applyMarginBps, sumWholesaleCosts } from "@/modules/admin/data/wholesale/margin";

import {planBoxRuleFromChoice} from "./box-approval-model";
import type {CommerceActionState}from"./commerce-state";
export type {CommerceActionState}from"./commerce-state";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const emptyToNull = (value: string) => (value.length ? value : null);

function fail(reason: string): CommerceActionState {
  if (reason === "FORBIDDEN") return { status: "error", reason: "FORBIDDEN" };
  if (reason === "MFA_REQUIRED") return { status: "error", reason: "MFA_REQUIRED" };
  if (reason === "UNAUTHENTICATED") return { status: "error", reason: "UNAUTHENTICATED" };
  if (reason === "INVALID_INPUT") return { status: "error", reason: "VALIDATION" };
  if (reason === "CONFLICT") return { status: "error", reason: "CONFLICT" };
  return { status: "error", reason: "FAILED" };
}

function localeOrFail(form: FormData): string | null {
  const locale = text(form, "locale");
  return isLocale(locale) ? locale : null;
}

async function boxed(locale: string, name: string, args: Record<string, unknown>): Promise<CommerceActionState> {
  const result = await callBoxesCommand(name, args);
  if (result.status === "error") return fail(result.reason);
  revalidatePath(`/${locale}/administration/finance`);
  revalidatePath(`/${locale}/administration/finance/offres`);
  revalidatePath(`/${locale}/administration/finance/credits`);
  return { status: "success", outcome: result.value.outcome };
}

export async function createBenefitAction(_: CommerceActionState, form: FormData): Promise<CommerceActionState> {
  const locale = localeOrFail(form);
  if (!locale) return { status: "error", reason: "VALIDATION" };
  const effectiveFrom=preparedEffectiveFrom(form);
  if(!effectiveFrom)return {status:"error",reason:"VALIDATION"};
  const creditCost=exactMinor(text(form,"creditCost")),reference=exactMinor(text(form,"referenceValueMinor")),cost=exactMinor(text(form,"internalCostMinor"));
  const quotaRaw=text(form,"quota"),quota=quotaRaw?positive(quotaRaw):null;
  if(creditCost===null||reference===null||cost===null||(quotaRaw!==""&&quota===null))return {status:"error",reason:"VALIDATION"};
  return boxed(locale, "create_benefit_version", {
    p_audit_organization_id: text(form, "auditOrganizationId"),
    p_code: text(form, "code").toUpperCase(),
    p_benefit_type: text(form, "benefitType"),
    p_fulfillment_mode: text(form, "fulfillmentMode"),
    p_name_fr: text(form, "nameFr"),
    p_name_ar: text(form, "nameAr"),
    p_description_fr: text(form, "descriptionFr"),
    p_description_ar: text(form, "descriptionAr"),
    p_credit_cost: creditCost,
    p_reference_value_minor: reference,
    p_internal_cost_minor: cost,
    p_currency: text(form, "currency").toUpperCase(),
    p_library_id: emptyToNull(text(form, "libraryId")),
    p_service_id: emptyToNull(text(form, "serviceId")),
    p_quota: quota,
    p_capacity_rule: {},
    p_eligibility_rule: {},
    p_cancellation_rule_version: text(form, "cancellationRuleVersion") || "CANCEL_V1",
    p_effective_from: effectiveFrom,
    p_idempotency_key: text(form, "idempotencyKey"),
    p_correlation_id: randomUUID(),
  });
}

export async function activateBenefitAction(_: CommerceActionState, form: FormData): Promise<CommerceActionState> {
  const locale = localeOrFail(form);
  if (!locale) return { status: "error", reason: "VALIDATION" };
  return boxed(locale, "activate_benefit_version", {
    p_audit_organization_id: text(form, "auditOrganizationId"),
    p_benefit_version_id: text(form, "benefitVersionId"),
    p_idempotency_key: text(form, "idempotencyKey"),
    p_correlation_id: randomUUID(),
  });
}

export async function createBoxAction(_: CommerceActionState, form: FormData): Promise<CommerceActionState> {
  const locale = localeOrFail(form);
  if (!locale) return { status: "error", reason: "VALIDATION" };
  const effectiveFrom=preparedEffectiveFrom(form);
  if(!effectiveFrom)return {status:"error",reason:"VALIDATION"};
  const budget=exactMinor(text(form,"creditBudget")),low=exactMinor(text(form,"costLowMinor")),expected=exactMinor(text(form,"costExpectedMinor")),full=exactMinor(text(form,"costFullMinor"));
  const rollover=boundedInteger(text(form,"rolloverMonths")||"0",0,2147483647);
  if(budget===null||low===null||expected===null||full===null||rollover===null)return {status:"error",reason:"VALIDATION"};
  const slots = parseBoxSlots(form);
  if (slots === null) return { status: "error", reason: "VALIDATION" };
  return boxed(locale, "create_box_version", {
    p_audit_organization_id: text(form, "auditOrganizationId"),
    p_code: text(form, "code").toUpperCase(),
    p_box_type: text(form, "boxType"),
    p_name_fr: text(form, "nameFr"),
    p_name_ar: text(form, "nameAr"),
    p_credit_budget: budget,
    p_rollover_months: rollover,
    p_rules_snapshot: {},
    p_cost_low_minor: low,
    p_cost_expected_minor: expected,
    p_cost_full_minor: full,
    p_currency: text(form, "currency").toUpperCase(),
    p_effective_from: effectiveFrom,
    p_slots: slots,
    p_idempotency_key: text(form, "idempotencyKey"),
    p_correlation_id: randomUUID(),
  });
}

/** Box combo depuis tarifs de gros territoriaux (coût + marge versionnée). */
export async function createBoxFromWholesaleAction(_: CommerceActionState, form: FormData): Promise<CommerceActionState> {
  const locale = localeOrFail(form);
  if (!locale) return { status: "error", reason: "VALIDATION" };
  const budget = exactMinor(text(form, "creditBudget") || "0");
  const wholesaleDeclared = exactMinor(text(form, "wholesaleTotalMinor"));
  const proposedDeclared = exactMinor(text(form, "proposedTotalMinor"));
  const marginBps = boundedInteger(text(form, "marginBps") || "1500", 1, 10000);
  const currency = text(form, "currency").toUpperCase();
  const territory = text(form, "territoryCode").toUpperCase();
  const code = text(form, "code").toUpperCase();
  const nameFr = text(form, "nameFr");
  const nameAr = text(form, "nameAr");
  if (
    budget === null
    || wholesaleDeclared === null
    || proposedDeclared === null
    || marginBps === null
    || !/^[A-Z]{3}$/u.test(currency)
    || !/^[A-Z][A-Z0-9_-]{0,63}$/u.test(territory)
    || !/^[A-Z][A-Z0-9_]{2,79}$/u.test(code)
    || nameFr.length < 2
    || nameAr.length < 2
  ) {
    return { status: "error", reason: "VALIDATION" };
  }

  let offers: Array<{
    commitment_id: string;
    category_code: string;
    sku_code: string;
    wholesale_unit_price_minor: string;
    provider_organization_id: string;
    service_name_fr: string;
    service_name_ar: string;
  }>;
  try {
    const parsed = JSON.parse(text(form, "offersJson")) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return { status: "error", reason: "VALIDATION" };
    offers = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") return { status: "error", reason: "VALIDATION" };
      const row = item as Record<string, unknown>;
      const price = String(row.wholesale_unit_price_minor ?? "");
      if (!/^\d+$/u.test(price)) return { status: "error", reason: "VALIDATION" };
      const category = String(row.category_code ?? "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
      if (!/^[A-Z][A-Z0-9_]{1,39}$/u.test(category)) return { status: "error", reason: "VALIDATION" };
      offers.push({
        commitment_id: String(row.commitment_id ?? ""),
        category_code: category,
        sku_code: String(row.sku_code ?? ""),
        wholesale_unit_price_minor: price,
        provider_organization_id: String(row.provider_organization_id ?? ""),
        service_name_fr: String(row.service_name_fr ?? ""),
        service_name_ar: String(row.service_name_ar ?? ""),
      });
    }
  } catch {
    return { status: "error", reason: "VALIDATION" };
  }

  let wholesaleTotal: bigint;
  let proposedTotal: bigint;
  try {
    wholesaleTotal = sumWholesaleCosts(offers.map((offer) => offer.wholesale_unit_price_minor));
    proposedTotal = applyMarginBps(wholesaleTotal, marginBps);
  } catch {
    return { status: "error", reason: "VALIDATION" };
  }
  if (wholesaleTotal.toString() !== wholesaleDeclared || proposedTotal.toString() !== proposedDeclared) {
    return { status: "error", reason: "VALIDATION" };
  }

  const categorySlots = [...new Set(offers.map((offer) => offer.category_code))];
  const slots = categorySlots.map((slotCode) => ({
    slot_code: slotCode,
    slot_kind: "MANDATORY",
    minimum_selections: 1,
    maximum_selections: 1,
    allowed_benefit_version_ids: [] as string[],
  }));

  return boxed(locale, "create_box_version", {
    p_audit_organization_id: text(form, "auditOrganizationId"),
    p_code: code,
    p_box_type: "MULTI_LIBRARY",
    p_name_fr: nameFr,
    p_name_ar: nameAr,
    p_credit_budget: budget,
    p_rollover_months: 0,
    p_rules_snapshot: {
      source: "WHOLESALE_TERRITORY_V1",
      territory_code: territory,
      subject: emptyToNull(text(form, "subject")),
      margin_bps: marginBps,
      wholesale_total_minor: wholesaleTotal.toString(),
      proposed_total_minor: proposedTotal.toString(),
      lines: offers,
    },
    p_cost_low_minor: wholesaleTotal.toString(),
    p_cost_expected_minor: proposedTotal.toString(),
    p_cost_full_minor: proposedTotal.toString(),
    p_currency: currency,
    p_effective_from: new Date().toISOString(),
    p_slots: slots,
    p_idempotency_key: text(form, "idempotencyKey"),
    p_correlation_id: randomUUID(),
  });
}

export async function activateBoxAction(_: CommerceActionState, form: FormData): Promise<CommerceActionState> {
  const locale = localeOrFail(form);
  if (!locale) return { status: "error", reason: "VALIDATION" };
  return boxed(locale, "activate_box_version", {
    p_audit_organization_id: text(form, "auditOrganizationId"),
    p_box_version_id: text(form, "boxVersionId"),
    p_approval_reference: emptyToNull(text(form, "approvalReference")),
    p_idempotency_key: text(form, "idempotencyKey"),
    p_correlation_id: randomUUID(),
  });
}

export async function linkPlanBoxAction(_: CommerceActionState, form: FormData): Promise<CommerceActionState> {
  const locale = localeOrFail(form);
  if (!locale) return { status: "error", reason: "VALIDATION" };
  const effectiveFrom=preparedEffectiveFrom(form);
  if(!effectiveFrom)return {status:"error",reason:"VALIDATION"};
  let rule:ReturnType<typeof planBoxRuleFromChoice>;
  try{rule=planBoxRuleFromChoice(text(form,"budgetRule"));}catch{return {status:"error",reason:"VALIDATION"};}
  return boxed(locale, "link_plan_box_rule", {
    p_audit_organization_id: text(form, "auditOrganizationId"),
    p_plan_version_id: text(form, "planVersionId"),
    p_box_version_id: text(form, "boxVersionId"),
    p_rule_snapshot: rule,
    p_effective_from: effectiveFrom,
    p_idempotency_key: text(form, "idempotencyKey"),
    p_correlation_id: randomUUID(),
  });
}

export async function issueCreditsAction(_: CommerceActionState, form: FormData): Promise<CommerceActionState> {
  const locale = localeOrFail(form);
  if (!locale) return { status: "error", reason: "VALIDATION" };
  const expires = text(form, "expiresAt");
  const date = new Date(expires.includes("T") ? expires : `${expires}T23:59:59.000Z`);
  if (!Number.isFinite(date.getTime())) return { status: "error", reason: "VALIDATION" };
  const expiresAt = date.toISOString();
  return boxed(locale, "request_manual_credit_grant_v1", {
    p_organization_id: text(form, "organizationId"), p_wallet_id: text(form, "walletId"),
    p_source_type: text(form, "sourceType"), p_quantity: text(form, "quantity"), p_expires_at: expiresAt,
    p_library_id: emptyToNull(text(form, "libraryId")), p_source_reference: text(form, "sourceReference"),
    p_reason: text(form, "reason"), p_idempotency_key: text(form, "idempotencyKey"),
  });
}

export async function ensureWalletAction(_: CommerceActionState, form: FormData): Promise<CommerceActionState> {
  const locale = localeOrFail(form);
  if (!locale) return { status: "error", reason: "VALIDATION" };
  return boxed(locale, "ensure_client_credit_wallet", {
    p_organization_id: text(form, "organizationId"),
    p_idempotency_key: text(form, "idempotencyKey"),
    p_correlation_id: randomUUID(),
  });
}

export async function closePnlAction(_: CommerceActionState, form: FormData): Promise<CommerceActionState> {
  const locale = localeOrFail(form);
  if (!locale) return { status: "error", reason: "VALIDATION" };
  const cutoff = text(form, "entryCutoffAt");
  const result = await closeAdminProfitPeriod({
    bookId: text(form, "bookId"),
    periodStart: text(form, "periodStart"),
    periodEnd: text(form, "periodEnd"),
    ruleVersionId: text(form, "ruleVersionId"),
    entryCutoffAt: cutoff.includes("T") ? new Date(cutoff).toISOString() : new Date().toISOString(),
    reason: text(form, "reason"),
    idempotencyKey: text(form, "idempotencyKey"),
    correlationId: randomUUID(),
  });
  if (result.status === "error") return fail(result.reason);
  revalidatePath(`/${locale}/administration/finance`);
  return { status: "success", outcome: result.value.outcome };
}

export async function issueStatementAction(_: CommerceActionState, form: FormData): Promise<CommerceActionState> {
  const locale = localeOrFail(form);
  if (!locale) return { status: "error", reason: "VALIDATION" };
  const result = await issueAdminProviderStatement({
    providerOrganizationId: text(form, "providerOrganizationId"),
    statementNumber: text(form, "statementNumber"),
    periodStart: text(form, "periodStart"),
    periodEnd: text(form, "periodEnd"),
    currency: text(form, "currency").toUpperCase(),
    idempotencyKey: text(form, "idempotencyKey"),
    correlationId: randomUUID(),
  });
  if (result.status === "error") return fail(result.reason);
  revalidatePath(`/${locale}/administration/finance`);
  return { status: "success", outcome: result.value.outcome };
}

export async function sweepExceptionsAction(_: CommerceActionState, form: FormData): Promise<CommerceActionState> {
  const locale = localeOrFail(form);
  if (!locale) return { status: "error", reason: "VALIDATION" };
  const result = await sweepAdminExceptions();
  if (result.status === "error") return fail(result.reason);
  revalidatePath(`/${locale}/administration/command-center`);
  revalidatePath(`/${locale}/administration/finance`);
  return { status: "success", outcome: `${result.value.outcome}:${result.value.opened}:${result.value.skipped}` };
}

export async function createFrameworkAction(_: CommerceActionState, form: FormData): Promise<CommerceActionState> {
  const locale = localeOrFail(form);
  if (!locale) return { status: "error", reason: "VALIDATION" };
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const unitPrice = exactMinor(text(form, "unitPriceMinor"));
  if(unitPrice===null)return {status:"error",reason:"VALIDATION"};
  const response = await client.rpc("create_framework_agreement_draft", {
    p_owner_organization_id: text(form, "ownerOrganizationId"),
    p_sku_id: text(form, "skuId"),
    p_agreement_code: text(form, "agreementCode"),
    p_valid_from: text(form, "validFrom"),
    p_valid_to: text(form, "validTo"),
    p_forecast_units: text(form, "forecastUnits"),
    p_minimum_commitment_units: text(form, "minimumCommitmentUnits") || "0",
    p_maximum_units: text(form, "maximumUnits"),
    p_payment_model: text(form, "paymentModel"),
    p_currency: text(form, "currency").toUpperCase(),
    p_price_tiers: [{ min_units: 1, unit_price_minor: unitPrice }],
    p_rebate_rules: [],
    p_sla_snapshot: { version: "FRAMEWORK_SLA_V1" },
    p_penalty_rules: [],
    p_exit_rules: { version: "FRAMEWORK_EXIT_V1" },
    p_idempotency_key: text(form, "idempotencyKey"),
    p_correlation_id: randomUUID(),
  });
  if (response.error) {
    if (response.error.code === "42501") return { status: "error", reason: "FORBIDDEN" };
    if (response.error.code === "22023") return { status: "error", reason: "VALIDATION" };
    return { status: "error", reason: "FAILED" };
  }
  revalidatePath(`/${locale}/administration/achats-groupes`);
  return { status: "success", outcome: "FRAMEWORK_DRAFT_CREATED" };
}

function preparedEffectiveFrom(form:FormData):string|null{
  const value=text(form,"effectiveFrom");
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u.test(value))return null;
  const timestamp=new Date(value);
  return Number.isFinite(timestamp.getTime())?timestamp.toISOString():null;
}

function exactMinor(value: string | null): string | null {
  if(!value||!/^[0-9]{1,19}$/u.test(value))return null;
  const parsed=BigInt(value);
  return parsed<=BigInt("9223372036854775807")?parsed.toString():null;
}
function boundedInteger(value:string,minimum:number,maximum:number):number|null{
  const exact=exactMinor(value);
  if(exact===null||BigInt(exact)<BigInt(minimum)||BigInt(exact)>BigInt(maximum))return null;
  return Number(exact);
}

/** Multi-services Box: slotsJson preferred; legacy single slotCode kept for tests/compat. */
function parseBoxSlots(form: FormData): Array<{
  slot_code: string;
  slot_kind: string;
  minimum_selections: number;
  maximum_selections: number;
  allowed_benefit_version_ids: string[];
}> | null {
  const raw = text(form, "slotsJson");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) return null;
      const slots = [];
      for (const item of parsed) {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        const code = String(row.slot_code ?? "").trim().toUpperCase();
        if (!/^[A-Z][A-Z0-9_]{1,39}$/u.test(code)) return null;
        const minimum = boundedInteger(String(row.minimum_selections ?? "0"), 0, 2147483647);
        const maximum = boundedInteger(String(row.maximum_selections ?? "1"), 0, 2147483647);
        if (minimum === null || maximum === null || maximum < minimum) return null;
        const ids = Array.isArray(row.allowed_benefit_version_ids)
          ? [...new Set(row.allowed_benefit_version_ids.map((value) => String(value).trim()).filter(Boolean))]
          : [];
        slots.push({
          slot_code: code,
          slot_kind: String(row.slot_kind ?? "MANDATORY").trim() || "MANDATORY",
          minimum_selections: minimum,
          maximum_selections: maximum,
          allowed_benefit_version_ids: ids,
        });
      }
      return slots;
    } catch {
      return null;
    }
  }
  const slotCode = text(form, "slotCode").toUpperCase();
  if (!slotCode) return [];
  const minimum = boundedInteger(text(form, "slotMin") || "0", 0, 2147483647);
  const maximum = boundedInteger(text(form, "slotMax") || "1", 0, 2147483647);
  if (minimum === null || maximum === null || maximum < minimum) return null;
  const benefitIds = [...new Set(form.getAll("allowedBenefitVersionIds").flatMap((value) => String(value).split(/[\s,]+/u)).filter(Boolean))];
  return [{
    slot_code: slotCode,
    slot_kind: text(form, "slotKind") || "MANDATORY",
    minimum_selections: minimum,
    maximum_selections: maximum,
    allowed_benefit_version_ids: benefitIds,
  }];
}

export async function activateFrameworkPoolAction(_: CommerceActionState, form: FormData): Promise<CommerceActionState> {
  const locale = localeOrFail(form);
  if (!locale) return { status: "error", reason: "VALIDATION" };
  const ttlHours = boundedInteger(text(form, "reservationTtlHours") || "168",1,2160);
  if (ttlHours === null || ttlHours < 1 || ttlHours > 2160) return { status: "error", reason: "VALIDATION" };
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const provider = emptyToNull(text(form, "providerOrganizationId"));
  const price=provider?exactMinor(text(form,"unitPriceMinor")):null;
  if(provider&&price===null)return {status:"error",reason:"VALIDATION"};
  const contracted = emptyToNull(text(form, "contractedUnits"));
  const response = await client.rpc("activate_framework_pool", {
    p_agreement_id: text(form, "agreementId"),
    p_contracted_units: contracted,
    p_low_stock_threshold_units: text(form, "lowStockThresholdUnits") || "0",
    p_reservation_ttl_hours: ttlHours,
    p_provider_organization_id: provider,
    p_provider_capacity_units: provider ? emptyToNull(text(form, "providerCapacityUnits")) : null,
    p_unit_price_minor: price,
    p_idempotency_key: text(form, "idempotencyKey"),
    p_correlation_id: randomUUID(),
  });
  if (response.error) {
    if (response.error.code === "42501") return { status: "error", reason: "FORBIDDEN" };
    if (response.error.code === "22023") return { status: "error", reason: "VALIDATION" };
    if (response.error.code === "55000" || response.error.code === "23505") return { status: "error", reason: "CONFLICT" };
    return { status: "error", reason: "FAILED" };
  }
  revalidatePath(`/${locale}/administration/achats-groupes`);
  return { status: "success", outcome: "POOL_ACTIVE" };
}

function positive(value: string): string | null {
  const parsed = exactMinor(value);
  return parsed !== null && BigInt(parsed) > BigInt(0) ? parsed : null;
}

function dayStart(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value) ? `${value}T00:00:00.000Z` : null;
}

export async function createCreditPackAction(_: CommerceActionState, form: FormData): Promise<CommerceActionState> {
  const locale = localeOrFail(form);
  const quantity = positive(text(form, "quantity"));
  const price = exactMinor(text(form, "priceMinor"));
  const days = boundedInteger(text(form, "validityDays"),1,3660);
  if (!locale || quantity === null || price === null || days === null || days > 3660) return { status: "error", reason: "VALIDATION" };
  return boxed(locale, "create_credit_pack_version", {
    p_audit_organization_id: text(form, "auditOrganizationId"),
    p_code: text(form, "code").toUpperCase(),
    p_name_fr: text(form, "nameFr"),
    p_name_ar: text(form, "nameAr"),
    p_quantity: quantity,
    p_price_minor: price,
    p_currency: text(form, "currency").toUpperCase(),
    p_validity_days: days,
    p_idempotency_key: text(form, "idempotencyKey"),
    p_correlation_id: randomUUID(),
  });
}

export async function activateCreditPackAction(_: CommerceActionState, form: FormData): Promise<CommerceActionState> {
  const locale = localeOrFail(form);
  if (!locale) return { status: "error", reason: "VALIDATION" };
  return boxed(locale, "activate_credit_pack_version", {
    p_audit_organization_id: text(form, "auditOrganizationId"),
    p_pack_version_id: text(form, "packVersionId"),
    p_idempotency_key: text(form, "idempotencyKey"),
    p_correlation_id: randomUUID(),
  });
}

export async function grantCreditPackAction(_: CommerceActionState, form: FormData): Promise<CommerceActionState> {
  const locale = localeOrFail(form);
  if (!locale || text(form, "paymentReference").length < 3) return { status: "error", reason: "VALIDATION" };
  return boxed(locale, "grant_credit_pack", {
    p_pack_version_id: text(form, "packVersionId"),
    p_organization_id: text(form, "organizationId"),
    p_wallet_id: text(form, "walletId"),
    p_payment_reference: text(form, "paymentReference"),
    p_idempotency_key: text(form, "idempotencyKey"),
    p_correlation_id: randomUUID(),
  });
}

export async function createCreditPromotionAction(_: CommerceActionState, form: FormData): Promise<CommerceActionState> {
  const locale = localeOrFail(form);
  const bonus = positive(text(form, "bonusCredits"));
  const days = boundedInteger(text(form, "validityDays"),1,3660);
  const from = dayStart(text(form, "effectiveFrom"));
  const untilRaw = text(form, "effectiveUntil");
  const until = untilRaw ? dayStart(untilRaw) : null;
  if (!locale || bonus === null || days === null || days > 3660 || !from || (untilRaw.length > 0 && !until)) return { status: "error", reason: "VALIDATION" };
  return boxed(locale, "create_credit_promotion_version", {
    p_audit_organization_id: text(form, "auditOrganizationId"),
    p_code: text(form, "code").toUpperCase(),
    p_name_fr: text(form, "nameFr"),
    p_name_ar: text(form, "nameAr"),
    p_bonus_credits: bonus,
    p_validity_days: days,
    p_effective_from: from,
    p_effective_until: until,
    p_idempotency_key: text(form, "idempotencyKey"),
    p_correlation_id: randomUUID(),
  });
}

export async function activateCreditPromotionAction(_: CommerceActionState, form: FormData): Promise<CommerceActionState> {
  const locale = localeOrFail(form);
  if (!locale || text(form, "approvalReference").length < 3) return { status: "error", reason: "VALIDATION" };
  return boxed(locale, "activate_credit_promotion_version", {
    p_audit_organization_id: text(form, "auditOrganizationId"),
    p_promotion_version_id: text(form, "promotionVersionId"),
    p_approval_reference: text(form, "approvalReference"),
    p_idempotency_key: text(form, "idempotencyKey"),
    p_correlation_id: randomUUID(),
  });
}

export async function grantCreditPromotionAction(_: CommerceActionState, form: FormData): Promise<CommerceActionState> {
  const locale = localeOrFail(form);
  if (!locale) return { status: "error", reason: "VALIDATION" };
  return boxed(locale, "grant_credit_promotion", {
    p_promotion_version_id: text(form, "promotionVersionId"),
    p_organization_id: text(form, "organizationId"),
    p_wallet_id: text(form, "walletId"),
    p_idempotency_key: text(form, "idempotencyKey"),
    p_correlation_id: randomUUID(),
  });
}

export async function createPlatformParameterAction(_: CommerceActionState, form: FormData): Promise<CommerceActionState> {
  const locale = localeOrFail(form);
  const value = positive(text(form, "valueInteger"));
  if (!locale || value === null || text(form, "changeReason").length < 10) return { status: "error", reason: "VALIDATION" };
  return boxed(locale, "create_platform_parameter_version", {
    p_audit_organization_id: text(form, "auditOrganizationId"),
    p_parameter_key: text(form, "parameterKey"),
    p_value_integer: value,
    p_change_reason: text(form, "changeReason"),
    p_idempotency_key: text(form, "idempotencyKey"),
    p_correlation_id: randomUUID(),
  });
}

export async function activatePlatformParameterAction(_: CommerceActionState, form: FormData): Promise<CommerceActionState> {
  const locale = localeOrFail(form);
  if (!locale) return { status: "error", reason: "VALIDATION" };
  return boxed(locale, "activate_platform_parameter_version", {
    p_audit_organization_id: text(form, "auditOrganizationId"),
    p_parameter_version_id: text(form, "parameterVersionId"),
    p_idempotency_key: text(form, "idempotencyKey"),
    p_correlation_id: randomUUID(),
  });
}

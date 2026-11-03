"use server";

import { z } from "zod";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { taxDecisionSchema, taxProposalSchema, taxSimulationSchema, type TaxSimulation } from "@/modules/shared/lib/morocco-tax/model";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

export type TaxActionState = { status: "idle" } | { status: "success"; outcome: string; simulation?: TaxSimulation } | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "AAL2_REQUIRED" | "CONFLICT" | "FAILED" };
const outcomeSchema = z.object({ outcome: z.string().min(3) }).passthrough();
const simulationSchema = z.object({ category_code: z.string(), tax_rule_version_id: z.string().uuid(), rule_type: z.string(), line_net_minor: z.string(), tax_amount_minor: z.string(), line_gross_minor: z.string(), tax_rate_basis_points: z.number().int(), professional_validation_status: z.string(), legal_reference: z.string() });
const text = (form: FormData, key: string) => String(form.get(key) ?? "");
const validLocale = (form: FormData) => isLocale(text(form, "locale"));
function contextFromForm(form: FormData) {
  const kind = text(form, "contextKind"), organizationId = text(form, "organizationId");
  if (kind === "PLATFORM") return organizationId ? null : { kind: "PLATFORM" as const };
  return kind === "ORGANIZATION" ? { kind: "ORGANIZATION" as const, organizationId } : null;
}


async function rpc(name: string, args: Record<string, unknown>): Promise<TaxActionState> {
  const client = await getSupabaseServerClient();
  const { data } = await client.auth.getUser();
  if (!data.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const result = await client.rpc(name, args);
  if (result.error) {
    if (result.error.code === "42501" && /AAL2|MFA/i.test(result.error.message ?? "")) return { status: "error", reason: "AAL2_REQUIRED" };
    if (result.error.code === "42501") return { status: "error", reason: "FORBIDDEN" };
    if (["40001", "23505", "23P01", "55000"].includes(result.error.code ?? "")) return { status: "error", reason: "CONFLICT" };
    return { status: "error", reason: "FAILED" };
  }
  const parsed = outcomeSchema.safeParse(result.data);
  return parsed.success ? { status: "success", outcome: parsed.data.outcome } : { status: "error", reason: "FAILED" };
}

export async function simulateTax(_: TaxActionState, form: FormData): Promise<TaxActionState> {
  if (!validLocale(form)) return { status: "error", reason: "VALIDATION" };
  const parsed = taxSimulationSchema.safeParse({ categoryCode: text(form, "categoryCode"), effectiveOn: text(form, "effectiveOn"), netMinor: text(form, "netMinor"), sourceRuleVersionId: text(form, "sourceRuleVersionId") });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const result = await client.rpc("simulate_morocco_tax", { p_category_code: parsed.data.categoryCode, p_effective_on: parsed.data.effectiveOn, p_net_minor: parsed.data.netMinor, p_source_rule_version_id: parsed.data.sourceRuleVersionId || null });
  if (result.error) return { status: "error", reason: result.error.code === "42501" ? (/AAL2/i.test(result.error.message ?? "") ? "AAL2_REQUIRED" : "FORBIDDEN") : "FAILED" };
  const value = simulationSchema.safeParse(result.data);
  return value.success ? { status: "success", outcome: "MOROCCO_TAX_SIMULATED", simulation: { categoryCode: value.data.category_code, taxRuleVersionId: value.data.tax_rule_version_id, ruleType: value.data.rule_type, netMinor: value.data.line_net_minor, taxMinor: value.data.tax_amount_minor, grossMinor: value.data.line_gross_minor, rateBasisPoints: value.data.tax_rate_basis_points, validationStatus: value.data.professional_validation_status, legalReference: value.data.legal_reference } } : { status: "error", reason: "FAILED" };
}

export async function proposeTaxRule(_: TaxActionState, form: FormData): Promise<TaxActionState> {
  if (!validLocale(form)) return { status: "error", reason: "VALIDATION" };
  const parsed = taxProposalSchema.safeParse({ context: contextFromForm(form), categoryCode: text(form, "categoryCode"), ruleType: text(form, "ruleType"), rateBasisPoints: text(form, "rateBasisPoints"), priority: text(form, "priority"), legalReference: text(form, "legalReference"), effectiveFrom: text(form, "effectiveFrom"), effectiveTo: text(form, "effectiveTo"), changeReason: text(form, "changeReason"), idempotencyKey: text(form, "idempotencyKey") });
  return parsed.success ? rpc("propose_morocco_tax_rule", { p_audit_organization_id: parsed.data.context.kind === "ORGANIZATION" ? parsed.data.context.organizationId : null, p_category_code: parsed.data.categoryCode, p_rule_type: parsed.data.ruleType, p_rate_basis_points: parsed.data.rateBasisPoints, p_priority: parsed.data.priority, p_conditions: { source: "ADMIN_UI", requires_accountant_validation: true }, p_legal_reference: parsed.data.legalReference, p_effective_from: parsed.data.effectiveFrom, p_effective_to: parsed.data.effectiveTo || null, p_change_reason: parsed.data.changeReason, p_idempotency_key: parsed.data.idempotencyKey }) : { status: "error", reason: "VALIDATION" };
}

export async function decideTaxRule(_: TaxActionState, form: FormData): Promise<TaxActionState> {
  if (!validLocale(form)) return { status: "error", reason: "VALIDATION" };
  const parsed = taxDecisionSchema.safeParse({ context: contextFromForm(form), taxRuleVersionId: text(form, "taxRuleVersionId"), decision: text(form, "decision"), professionalValidationStatus: text(form, "professionalValidationStatus"), validationReference: text(form, "validationReference"), reason: text(form, "reason"), rowVersion: text(form, "rowVersion"), idempotencyKey: text(form, "idempotencyKey") });
  return parsed.success ? rpc("decide_morocco_tax_rule", { p_audit_organization_id: parsed.data.context.kind === "ORGANIZATION" ? parsed.data.context.organizationId : null, p_tax_rule_version_id: parsed.data.taxRuleVersionId, p_decision: parsed.data.decision, p_professional_validation_status: parsed.data.professionalValidationStatus, p_validation_reference: parsed.data.validationReference, p_reason: parsed.data.reason, p_expected_row_version: parsed.data.rowVersion, p_idempotency_key: parsed.data.idempotencyKey }) : { status: "error", reason: "VALIDATION" };
}

"use server";
import { createHash } from "node:crypto";
import { unstable_rethrow } from "next/navigation";
import { loadMyPlatformAccess } from "@/modules/shared/lib/account-security/platform-access";
import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { z } from "zod";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { acceptInvitationSchema, closePeriodSchema, decideGovernanceSchema, entryFeeSchema, payoutSchema } from "@/modules/franchise/data/governance/model";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

export type FranchiseActionState = { status: "idle" } | { status: "success"; outcome: string } | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "CONFLICT" | "AAL2_REQUIRED" | "MFA_REQUIRED" | "FAILED" };
const outcome = z.object({ outcome: z.string().min(3) }).passthrough(), text = (form: FormData, key: string) => String(form.get(key) ?? "");
async function rpc(name: string, args: Record<string, unknown>): Promise<FranchiseActionState> {
  try {
    let client: Awaited<ReturnType<typeof getSupabaseServerClient>>;
    if (name === "accept_franchise_invitation") {
      // The legacy invitation command retains its own mandate/mode-specific requirements.
      client = await getSupabaseServerClient();
      const auth = await client.auth.getUser();
      if (auth.error) return { status: "error", reason: classifyAuthReadFailure(auth.error) === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "FAILED" };
      if (!auth.data.user) return { status: "error", reason: "UNAUTHENTICATED" };
    } else {
      const access = await loadMyPlatformAccess();
      if (access.status === "error") return { status: "error", reason: access.reason === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "FAILED" };
      const finance = name !== "decide_franchise_governance";
      // These are exactly the allow-lists of the corresponding SQL commands.
      const allowed = finance ? ["SUPER_ADMIN", "FINANCE_MANAGER"] : ["SUPER_ADMIN", "MATRICIA_ADMIN"];
      if (!allowed.some(role => access.roles.has(role))) return { status: "error", reason: "FORBIDDEN" };
      if (!access.requirementSatisfied) return { status: "error", reason: "MFA_REQUIRED" };
      client = access.client;
      if (finance) {
        // Financial SQL requires AAL2 even if an account policy does not demand MFA.
        const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
        if (assurance.error) return { status: "error", reason: classifyAuthReadFailure(assurance.error) === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "FAILED" };
        if (assurance.data?.currentLevel !== "aal2") return { status: "error", reason: "MFA_REQUIRED" };
      }
    }
    const result = await client.rpc(name, args);
    if (result.error) {
      if (result.error.code === "42501" && /AAL|MFA/i.test(result.error.message ?? "")) return { status: "error", reason: "MFA_REQUIRED" };
      if (result.error.code === "42501") return { status: "error", reason: "FORBIDDEN" };
      if (["40001", "23505", "23514", "55000"].includes(result.error.code ?? "") || /IDEMPOTENCY|BALANCE|STALE/i.test(result.error.message ?? "")) return { status: "error", reason: "CONFLICT" };
      return { status: "error", reason: "FAILED" };
    }
    const parsed = outcome.safeParse(result.data);
    return parsed.success ? { status: "success", outcome: parsed.data.outcome } : { status: "error", reason: "FAILED" };
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", reason: "FAILED" };
  }
}
function localeValid(form: FormData) { return isLocale(text(form, "locale")); }

export async function decideGovernance(_: FranchiseActionState, form: FormData): Promise<FranchiseActionState> { if (!localeValid(form)) return { status: "error", reason: "VALIDATION" }; const parsed = decideGovernanceSchema.safeParse({ approvalRequestId: text(form, "approvalRequestId"), decision: text(form, "decision"), reason: text(form, "reason"), rowVersion: text(form, "rowVersion"), idempotencyKey: text(form, "idempotencyKey") }); return parsed.success ? rpc("decide_franchise_governance", { p_approval_request_id: parsed.data.approvalRequestId, p_decision: parsed.data.decision, p_reason: parsed.data.reason, p_expected_row_version: parsed.data.rowVersion, p_idempotency_key: parsed.data.idempotencyKey }) : { status: "error", reason: "VALIDATION" }; }
export async function acceptInvitation(_: FranchiseActionState, form: FormData): Promise<FranchiseActionState> { if (!localeValid(form)) return { status: "error", reason: "VALIDATION" }; const parsed = acceptInvitationSchema.safeParse({ invitationId: text(form, "invitationId"), invitationToken: text(form, "invitationToken"), rowVersion: text(form, "rowVersion"), idempotencyKey: text(form, "idempotencyKey") }); if (!parsed.success) return { status: "error", reason: "VALIDATION" }; const tokenHash = createHash("sha256").update(parsed.data.invitationToken, "utf8").digest("hex"); return rpc("accept_franchise_invitation", { p_invitation_id: parsed.data.invitationId, p_token_hash: tokenHash, p_expected_row_version: parsed.data.rowVersion, p_idempotency_key: parsed.data.idempotencyKey }); }
export async function createEntryFee(_: FranchiseActionState, form: FormData): Promise<FranchiseActionState> { if (!localeValid(form)) return { status: "error", reason: "VALIDATION" }; const parsed = entryFeeSchema.safeParse({ bookId: text(form, "bookId"), mode: text(form, "mode"), principalMinor: text(form, "principalMinor"), depositMinor: text(form, "depositMinor"), withholdingBps: text(form, "withholdingBps"), installmentCount: text(form, "installmentCount"), startsOn: text(form, "startsOn"), dueOn: text(form, "dueOn"), idempotencyKey: text(form, "idempotencyKey") }); if (!parsed.success) return { status: "error", reason: "VALIDATION" }; const value = parsed.data; return rpc("create_franchise_entry_fee_schedule", { p_book_id: value.bookId, p_mode: value.mode, p_principal_minor: value.principalMinor, p_deposit_minor: value.depositMinor, p_withholding_bps: value.mode === "REVENUE_WITHHOLDING" ? Number.parseInt(value.withholdingBps, 10) : null, p_installment_count: value.mode === "INSTALLMENT" ? Number.parseInt(value.installmentCount, 10) : null, p_starts_on: value.startsOn, p_due_on: value.dueOn, p_terms_snapshot: { source: "FRANCHISE_GOVERNANCE_UI", version: 1 }, p_idempotency_key: value.idempotencyKey }); }
export async function closeProfitPeriod(_: FranchiseActionState, form: FormData): Promise<FranchiseActionState> { if (!localeValid(form)) return { status: "error", reason: "VALIDATION" }; const cutoff = text(form, "cutoffAt"), parsed = closePeriodSchema.safeParse({ bookId: text(form, "bookId"), periodStart: text(form, "periodStart"), periodEnd: text(form, "periodEnd"), ruleVersionId: text(form, "ruleVersionId"), cutoffAt: cutoff ? `${cutoff}:00.000Z` : "", reason: text(form, "reason"), idempotencyKey: text(form, "idempotencyKey") }); return parsed.success ? rpc("close_franchise_profit_period", { p_book_id: parsed.data.bookId, p_period_start: parsed.data.periodStart, p_period_end: parsed.data.periodEnd, p_rule_version_id: parsed.data.ruleVersionId, p_entry_cutoff_at: parsed.data.cutoffAt, p_reason: parsed.data.reason, p_idempotency_key: parsed.data.idempotencyKey }) : { status: "error", reason: "VALIDATION" }; }
export async function recordPayout(_: FranchiseActionState, form: FormData): Promise<FranchiseActionState> { if (!localeValid(form)) return { status: "error", reason: "VALIDATION" }; const parsed = payoutSchema.safeParse({ bookId: text(form, "bookId"), beneficiaryCode: text(form, "beneficiaryCode"), amountMinor: text(form, "amountMinor"), journalId: text(form, "journalId"), reference: text(form, "reference"), proofHash: text(form, "proofHash").toLowerCase(), idempotencyKey: text(form, "idempotencyKey") }); return parsed.success ? rpc("record_franchise_distribution_payout", { p_book_id: parsed.data.bookId, p_beneficiary_code: parsed.data.beneficiaryCode, p_amount_minor: parsed.data.amountMinor, p_financial_journal_id: parsed.data.journalId, p_reference: parsed.data.reference, p_proof_hash: parsed.data.proofHash, p_idempotency_key: parsed.data.idempotencyKey }) : { status: "error", reason: "VALIDATION" }; }

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { parseMoneyInput } from "@/modules/shared/lib/money-input";

export type PolicyActionState = { status: "idle" | "proposed" | "activated" } | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "MFA_REQUIRED" | "FORBIDDEN" | "CONFLICT" | "FAILED" };
const common = z.object({ organizationId: z.string().uuid(), idempotencyKey: z.string().uuid() });
const proposal = common.extend({
  resourceType: z.enum(["QUOTE_SELECTION", "CONTRACT_GENERATION", "COST_ALLOCATION"]),
  minimumApprovals: z.coerce.number().int().min(1).max(5),
  roles: z.array(z.enum(["CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_BUYER", "CLIENT_ACCOUNTING"])).min(1).max(4),
  currency: z.string().regex(/^[A-Z]{3}$/u), threshold: z.string(), buyerLimit: z.string(),
  effectiveFrom: z.string().datetime({ offset: true }), reason: z.string().trim().min(10).max(1000),
});
function errorReason(code: string) { return code === "42501" ? "FORBIDDEN" as const : code === "40001" ? "CONFLICT" as const : code === "22023" ? "VALIDATION" as const : "FAILED" as const; }

export async function proposeClientApprovalPolicy(_previous: PolicyActionState, form: FormData): Promise<PolicyActionState> {
  const locale = String(form.get("locale") ?? "");
  if (!isLocale(locale)) return { status: "error", reason: "VALIDATION" };
  const value = proposal.safeParse({ organizationId: form.get("organizationId"), idempotencyKey: form.get("idempotencyKey"), resourceType: form.get("resourceType"), minimumApprovals: form.get("minimumApprovals"), roles: form.getAll("roles"), currency: String(form.get("currency") ?? "").trim().toUpperCase(), threshold: form.get("threshold"), buyerLimit: String(form.get("buyerLimit") ?? ""), effectiveFrom: form.get("effectiveFrom"), reason: form.get("reason") });
  if (!value.success) return { status: "error", reason: "VALIDATION" };
  const v = value.data;
  const threshold = parseMoneyInput(v.threshold, v.currency);
  const buyerLimit = v.buyerLimit.trim() ? parseMoneyInput(v.buyerLimit, v.currency) : null;
  if (threshold === null || (v.buyerLimit.trim() && buyerLimit === null)) return { status: "error", reason: "VALIDATION" };
  try {
    const client = await getSupabaseServerClient();
    const user = await client.auth.getUser();
    if (!user.data.user) return { status: "error", reason: "UNAUTHENTICATED" };
    const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error) return { status: "error", reason: "FAILED" };
    if (assurance.data.currentLevel !== "aal2") return { status: "error", reason: "MFA_REQUIRED" };
    const response = await client.rpc("propose_client_approval_policy_v1", { p_organization_id: v.organizationId, p_resource_type: v.resourceType, p_minimum_approvals: v.minimumApprovals, p_required_role_codes: v.roles, p_minimum_amount_minor: threshold, p_currency: v.currency, p_buyer_limit_minor: buyerLimit, p_effective_from: v.effectiveFrom, p_change_reason: v.reason, p_idempotency_key: v.idempotencyKey });
    if (response.error) return { status: "error", reason: errorReason(response.error.code) };
    if (!z.object({ outcome: z.literal("BUSINESS_APPROVAL_POLICY_PROPOSED"), policy_version_id: z.string().uuid() }).safeParse(response.data).success) return { status: "error", reason: "FAILED" };
    revalidatePath(`/${locale}/client/actions`);
    return { status: "proposed" };
  } catch { return { status: "error", reason: "FAILED" }; }
}

export async function activateClientApprovalPolicy(_previous: PolicyActionState, form: FormData): Promise<PolicyActionState> {
  const locale = String(form.get("locale") ?? "");
  const parsed = common.extend({ policyVersionId: z.string().uuid(), contentHash: z.string().regex(/^[0-9a-f]{64}$/u) }).safeParse({ organizationId: form.get("organizationId"), idempotencyKey: form.get("idempotencyKey"), policyVersionId: form.get("policyVersionId"), contentHash: form.get("contentHash") });
  if (!isLocale(locale) || !parsed.success) return { status: "error", reason: "VALIDATION" };
  try {
    const client = await getSupabaseServerClient();
    const user = await client.auth.getUser();
    if (!user.data.user) return { status: "error", reason: "UNAUTHENTICATED" };
    const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error) return { status: "error", reason: "FAILED" };
    if (assurance.data.currentLevel !== "aal2") return { status: "error", reason: "MFA_REQUIRED" };
    const scope = await client.from("business_approval_policy_versions").select("id").eq("id", parsed.data.policyVersionId).eq("organization_id", parsed.data.organizationId).maybeSingle();
    if (scope.error || !scope.data) return { status: "error", reason: "FORBIDDEN" };
    const response = await client.rpc("activate_business_approval_policy", { p_policy_version_id: parsed.data.policyVersionId, p_expected_hash: parsed.data.contentHash, p_idempotency_key: parsed.data.idempotencyKey });
    if (response.error) return { status: "error", reason: errorReason(response.error.code) };
    if (!z.object({ outcome: z.literal("BUSINESS_APPROVAL_POLICY_ACTIVATED") }).safeParse(response.data).success) return { status: "error", reason: "FAILED" };
    revalidatePath(`/${locale}/client/actions`);
    return { status: "activated" };
  } catch { return { status: "error", reason: "FAILED" }; }
}

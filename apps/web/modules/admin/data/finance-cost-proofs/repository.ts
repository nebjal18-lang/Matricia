import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import { hasPlatformRole, loadMyPlatformAccess, type PlatformAccess } from "@/modules/shared/lib/account-security/platform-access";
import { financeCostComponentSchema } from "@/modules/shared/lib/finance-cost-proofs/browser-upload";
import type { FinanceCostTarget } from "@/modules/shared/lib/finance-cost-proofs/review-commands";

export const financeCostReadRoles = ["SUPER_ADMIN", "MATRICIA_ADMIN", "FINANCE_MANAGER", "READ_ONLY_AUDITOR"] as const;
const querySchema = z.object({ locale: z.enum(["fr", "ar"]), page: z.coerce.number().int().min(1).max(10000).default(1), search: z.string().trim().max(100).optional() });
const targetSchema = z.object({ id: z.string().uuid(), component: financeCostComponentSchema, label: z.string().min(1).max(1000) });
const pageSchema = z.object({ targets: z.array(targetSchema).max(20), canUpload: z.boolean(), page: z.number().int().min(1).max(10000), page_size: z.literal(20), has_more: z.boolean() });
export type FinanceCostTargetPage = { targets: FinanceCostTarget[]; canUpload: boolean; page: number; pageSize: 20; hasMore: boolean; search: string };
export type FinanceCostTargetResult = { status: "success"; value: FinanceCostTargetPage } | { status: "error"; reason: "UNAUTHENTICATED" | "MFA_REQUIRED" | "FORBIDDEN" | "QUERY_FAILED" | "INVALID_RESPONSE" | "CONFIGURATION" | "VALIDATION" };

/** The bounded SQL projection owns target eligibility and user capabilities. */
export async function loadAdminFinanceCostTargets(input: unknown, verifiedAccess?: Extract<PlatformAccess, { status: "ok" }>): Promise<FinanceCostTargetResult> {
  const query = querySchema.safeParse(input);
  if (!query.success) return { status: "error", reason: "VALIDATION" };
  try {
    const access = verifiedAccess ?? await loadMyPlatformAccess();
    if (access.status === "error") return access;
    if (!hasPlatformRole(access.roles, financeCostReadRoles)) return { status: "error", reason: "FORBIDDEN" };
    if (!access.requirementSatisfied) return { status: "error", reason: "MFA_REQUIRED" };
    const response = await access.client.rpc("list_finance_cost_reconciliation_targets_v1", { p_locale: query.data.locale, p_page: query.data.page, p_search: query.data.search || null });
    if (response.error) {
      const code = response.error.code;
      if (code === "42501") return { status: "error", reason: response.error.message === "FINANCE_COST_MFA_REQUIRED" ? "MFA_REQUIRED" : response.error.message === "FINANCE_COST_UNAUTHENTICATED" ? "UNAUTHENTICATED" : "FORBIDDEN" };
      if (code === "PGRST301" || code === "PGRST303") return { status: "error", reason: "UNAUTHENTICATED" };
      if (["PGRST202", "PGRST205", "42883", "42P01"].includes(code ?? "")) return { status: "error", reason: "CONFIGURATION" };
      return { status: "error", reason: "QUERY_FAILED" };
    }
    const parsed = pageSchema.safeParse(response.data);
    if (!parsed.success || parsed.data.page !== query.data.page || parsed.data.has_more && parsed.data.targets.length !== 20) return { status: "error", reason: "INVALID_RESPONSE" };
    const keys = parsed.data.targets.map(target => `${target.component}:${target.id}`);
    if (new Set(keys).size !== keys.length || parsed.data.canUpload && (!hasPlatformRole(access.roles, ["SUPER_ADMIN", "FINANCE_MANAGER"]) || access.roles.has("READ_ONLY_AUDITOR"))) return { status: "error", reason: "INVALID_RESPONSE" };
    return { status: "success", value: { targets: parsed.data.targets, canUpload: parsed.data.canUpload, page: parsed.data.page, pageSize: parsed.data.page_size, hasMore: parsed.data.has_more, search: query.data.search ?? "" } };
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", reason: "QUERY_FAILED" };
  }
}

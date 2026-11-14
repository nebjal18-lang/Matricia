import { hasPlatformRole, loadMyPlatformAccess } from "@/modules/shared/lib/account-security/platform-access";
import { ingestPlatformCorePotSourceOutputSchema, ingestPlatformCorePotSourceSchema, type AdminCorePotResult } from "./model";

const writeRoles = ["SUPER_ADMIN", "FINANCE_MANAGER"] as const;

function mapError(code?: string): AdminCorePotResult<never>["reason"] {
  if (code === "42501") return "FORBIDDEN";
  if (code === "22023") return "INVALID_INPUT";
  if (["22000", "23505", "23514", "40001", "55000"].includes(code ?? "")) return "CONFLICT";
  return "UNAVAILABLE";
}

export async function ingestAdminPlatformCorePotSource(input: unknown): Promise<
  AdminCorePotResult<{ outcome: string; entryId: string; sourceType: string; sourceId: string; category: string; amountMinor: string }>
> {
  const parsed = ingestPlatformCorePotSourceSchema.safeParse(input);
  if (!parsed.success) return { status: "error", reason: "INVALID_INPUT" };
  const access = await loadMyPlatformAccess();
  if (access.status === "error") {
    return { status: "error", reason: access.reason === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : access.reason === "INVALID_RESPONSE" ? "INVALID_RESPONSE" : "UNAVAILABLE" };
  }
  if (!hasPlatformRole(access.roles, writeRoles)) return { status: "error", reason: "FORBIDDEN" };
  if (!access.requirementSatisfied) return { status: "error", reason: "MFA_REQUIRED" };

  const value = parsed.data;
  const response = await access.client.rpc("ingest_platform_core_pot_sources_v1", {
    p_book_id: value.bookId,
    p_financial_journal_id: value.financialJournalId,
    // Keep exact decimal strings — Number() would round bigint > MAX_SAFE_INTEGER.
    p_credit_revenue_ledger_id: value.creditRevenueLedgerId ?? null,
    p_franchise_entry_fee_ledger_id: value.franchiseEntryFeeLedgerId ?? null,
    p_reason: value.reason,
    p_idempotency_key: value.idempotencyKey,
    p_correlation_id: value.correlationId,
  });
  if (response.error) return { status: "error", reason: mapError(response.error.code) };

  const output = ingestPlatformCorePotSourceOutputSchema.safeParse(response.data);
  if (!output.success) return { status: "error", reason: "INVALID_RESPONSE" };
  return {
    status: "success",
    value: {
      outcome: output.data.outcome,
      entryId: output.data.post.entry_id,
      sourceType: output.data.source_type,
      sourceId: output.data.source_id,
      category: output.data.category,
      amountMinor: String(output.data.amount_minor),
    },
  };
}

import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { adminPnlDashboardSchema, type AdminPnlDashboard, type AdminPnlErrorReason, type AdminPnlResult } from "./model";

function mapError(code?: string): AdminPnlErrorReason {
  if (code === "42501") return "FORBIDDEN";
  if (code === "22023") return "INVALID_INPUT";
  if (["22000", "23505", "23514", "40001", "PT409", "55000"].includes(code ?? "")) return "CONFLICT";
  return "UNAVAILABLE";
}

export async function loadAdminPnlDashboard(): Promise<AdminPnlResult<AdminPnlDashboard>> {
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const response = await client.rpc("list_admin_pnl_dashboard", { p_limit: 100 });
  if (response.error) return { status: "error", reason: mapError(response.error.code) };
  const parsed = adminPnlDashboardSchema.safeParse(response.data);
  return parsed.success ? { status: "success", value: parsed.data } : { status: "error", reason: "INVALID_RESPONSE" };
}

export async function closeAdminProfitPeriod(input: {
  bookId: string; periodStart: string; periodEnd: string; ruleVersionId: string; entryCutoffAt: string; reason: string; idempotencyKey: string; correlationId: string;
}): Promise<AdminPnlResult<{ outcome: string }>> {
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const response = await client.rpc("close_franchise_profit_period", {
    p_book_id: input.bookId,
    p_period_start: input.periodStart,
    p_period_end: input.periodEnd,
    p_rule_version_id: input.ruleVersionId,
    p_entry_cutoff_at: input.entryCutoffAt,
    p_reason: input.reason,
    p_idempotency_key: input.idempotencyKey,
    p_correlation_id: input.correlationId,
  });
  if (response.error) return { status: "error", reason: mapError(response.error.code) };
  const outcome = response.data && typeof response.data === "object" && "outcome" in response.data ? String((response.data as { outcome: unknown }).outcome) : "";
  return outcome ? { status: "success", value: { outcome } } : { status: "error", reason: "INVALID_RESPONSE" };
}

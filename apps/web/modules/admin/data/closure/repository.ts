import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { adminClosureDashboardSchema, type AdminClosureDashboard, type AdminClosureErrorReason, type AdminClosureResult } from "./model";

function mapError(code?: string): AdminClosureErrorReason {
  if (code === "42501") return "FORBIDDEN";
  if (code === "22023" || code === "P0002") return "INVALID_INPUT";
  if (["22000", "23505", "23514", "40001", "PT409", "55000"].includes(code ?? "")) return "CONFLICT";
  return "UNAVAILABLE";
}

export async function loadAdminClosureDashboard(): Promise<AdminClosureResult<AdminClosureDashboard>> {
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const response = await client.rpc("list_admin_provider_closure_dashboard", { p_limit: 100 });
  if (response.error) return { status: "error", reason: mapError(response.error.code) };
  const parsed = adminClosureDashboardSchema.safeParse(response.data);
  return parsed.success ? { status: "success", value: parsed.data } : { status: "error", reason: "INVALID_RESPONSE" };
}

export async function issueAdminProviderStatement(input: {
  providerOrganizationId: string; statementNumber: string; periodStart: string; periodEnd: string; currency: string; idempotencyKey: string; correlationId: string;
}): Promise<AdminClosureResult<{ outcome: string }>> {
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const response = await client.rpc("issue_provider_statement", {
    p_provider_organization_id: input.providerOrganizationId,
    p_statement_number: input.statementNumber,
    p_period_start: input.periodStart,
    p_period_end: input.periodEnd,
    p_currency: input.currency,
    p_idempotency_key: input.idempotencyKey,
    p_correlation_id: input.correlationId,
  });
  if (response.error) return { status: "error", reason: mapError(response.error.code) };
  const outcome = response.data && typeof response.data === "object" && "outcome" in response.data ? String((response.data as { outcome: unknown }).outcome) : "";
  return outcome ? { status: "success", value: { outcome } } : { status: "error", reason: "INVALID_RESPONSE" };
}

export async function sweepAdminExceptions(): Promise<AdminClosureResult<{ outcome: string; opened: number; skipped: number }>> {
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const response = await client.rpc("sweep_admin_exceptions");
  if (response.error) return { status: "error", reason: mapError(response.error.code) };
  const data = response.data as { outcome?: unknown; opened?: unknown; skipped?: unknown } | null;
  if (!data || typeof data.outcome !== "string") return { status: "error", reason: "INVALID_RESPONSE" };
  return { status: "success", value: { outcome: data.outcome, opened: Number(data.opened ?? 0), skipped: Number(data.skipped ?? 0) } };
}

import { z } from "zod";
import { hasPlatformRole, loadMyPlatformAccess } from "@/modules/shared/lib/account-security/platform-access";
import { adminFinanceDashboardSchema, adminFinanceUuid, exactMinor, reconciliationSchema, type AdminFinanceDashboard, type AdminFinanceResult } from "./model";

const paymentRow = z.object({ id: adminFinanceUuid, provider_organization_id: adminFinanceUuid, currency: z.string().regex(/^[A-Z]{3}$/u), amount_minor: exactMinor }).strict();
const allocationRow = z.object({ amount_minor: exactMinor }).strict();
const invoiceRow = z.object({ id: adminFinanceUuid, provider_organization_id: adminFinanceUuid, currency: z.string().regex(/^[A-Z]{3}$/u), outstanding_minor: exactMinor }).strict();
const reconciliationOutput = z.object({ outcome: z.literal("PROVIDER_PAYMENT_RECONCILED"), payment_id: adminFinanceUuid, reconciliation_batch_id: adminFinanceUuid, allocated_minor: z.union([exactMinor, z.number().int().positive()]), unallocated_minor: z.union([exactMinor, z.number().int().nonnegative()]) }).passthrough();
const platformRoles = ["SUPER_ADMIN", "MATRICIA_ADMIN", "FINANCE_MANAGER"] as const;

async function authorizedClient() {
  const access = await loadMyPlatformAccess();
  if (access.status === "error") {
    return { status: "error", reason: access.reason === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : access.reason === "INVALID_RESPONSE" ? "INVALID_RESPONSE" : "UNAVAILABLE" } as const;
  }
  if (!hasPlatformRole(access.roles, platformRoles)) return { status: "error", reason: "FORBIDDEN" } as const;
  if (!access.requirementSatisfied) return { status: "error", reason: "MFA_REQUIRED" } as const;
  return { status: "success", client: access.client } as const;
}

export async function loadAdminFinanceDashboard(): Promise<AdminFinanceResult<AdminFinanceDashboard>> {
  const access = await authorizedClient();
  if (access.status === "error") return access;
  const response = await access.client.rpc("list_admin_finance_dashboard", { p_limit: 100 });
  if (response.error) return { status: "error", reason: response.error.code === "42501" ? "FORBIDDEN" : "UNAVAILABLE" };
  const parsed = adminFinanceDashboardSchema.safeParse(response.data);
  if (!parsed.success) return { status: "error", reason: "INVALID_RESPONSE" };
  if (parsed.data.provider_payments.some((payment) => BigInt(payment.allocated_minor) + BigInt(payment.unallocated_minor) !== BigInt(payment.amount_minor))) return { status: "error", reason: "INVALID_RESPONSE" };
  return { status: "success", value: parsed.data };
}

export async function reconcileAdminProviderPayment(input: unknown): Promise<AdminFinanceResult<{ batchId: string }>> {
  const parsed = reconciliationSchema.safeParse(input);
  if (!parsed.success) return { status: "error", reason: "INVALID_INPUT" };
  const access = await authorizedClient();
  if (access.status === "error") return access;
  const value = parsed.data;
  const [paymentQuery, allocationsQuery, invoiceQuery] = await Promise.all([
    access.client.from("provider_payments").select("id,provider_organization_id,currency,amount_minor::text").eq("id", value.paymentId).limit(1).maybeSingle(),
    access.client.from("provider_payment_allocations").select("amount_minor::text").eq("payment_id", value.paymentId).limit(201),
    access.client.from("provider_invoice_balances").select("id,provider_organization_id,currency,outstanding_minor::text").eq("id", value.invoiceId).limit(1).maybeSingle(),
  ]);
  if (paymentQuery.error || allocationsQuery.error || invoiceQuery.error) return { status: "error", reason: "UNAVAILABLE" };
  const payment = paymentRow.safeParse(paymentQuery.data), allocations = z.array(allocationRow).max(201).safeParse(allocationsQuery.data), invoice = invoiceRow.safeParse(invoiceQuery.data);
  if (!payment.success || !allocations.success || !invoice.success) return { status: "error", reason: "INVALID_INPUT" };
  // Fail closed when the pre-check page is saturated — never undercount allocated totals.
  if (allocations.data.length > 200) return { status: "error", reason: "UNAVAILABLE" };
  if (payment.data.provider_organization_id !== invoice.data.provider_organization_id || payment.data.currency !== invoice.data.currency) return { status: "error", reason: "INVALID_INPUT" };
  const allocated = allocations.data.reduce((total, item) => total + BigInt(item.amount_minor), BigInt(0));
  const amount = BigInt(value.amountMinor);
  if (amount > BigInt(payment.data.amount_minor) - allocated || amount > BigInt(invoice.data.outstanding_minor)) return { status: "error", reason: "CONFLICT" };
  const response = await access.client.rpc("reconcile_provider_payment", { p_payment_id: value.paymentId, p_allocations: [{ invoice_id: value.invoiceId, amount_minor: value.amountMinor }], p_idempotency_key: value.idempotencyKey, p_correlation_id: value.correlationId });
  if (response.error) {
    if (response.error.code === "42501") return { status: "error", reason: "FORBIDDEN" };
    if (["22000", "23505", "23514", "40001", "55000"].includes(response.error.code ?? "")) return { status: "error", reason: "CONFLICT" };
    return { status: "error", reason: "UNAVAILABLE" };
  }
  const output = reconciliationOutput.safeParse(response.data);
  return output.success && output.data.payment_id === value.paymentId ? { status: "success", value: { batchId: output.data.reconciliation_batch_id } } : { status: "error", reason: "INVALID_RESPONSE" };
}

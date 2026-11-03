"use server";
import { decimalToMinor } from "@matricia/infrastructure";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasPlatformRole, loadMyPlatformAccess } from "@/modules/shared/lib/account-security/platform-access";
export type RefundState = { status: "idle" | "success" | "error" };
export async function submitRefundAction(_state: RefundState, form: FormData): Promise<RefundState> {
  const access = await loadMyPlatformAccess();
  if (access.status !== "ok" || !access.requirementSatisfied || !hasPlatformRole(access.roles, ["SUPER_ADMIN", "FINANCE_MANAGER"])) return { status: "error" };
  const locale = z.enum(["fr", "ar"]).safeParse(form.get("locale"));
  if (!locale.success) return { status: "error" };
  const action = form.get("action");
  let result;
  if (action === "request") {
    const input = z.object({ paymentId: z.string().regex(/^[1-9]\d*$/u), amount: z.string().regex(/^(?:0|[1-9]\d*)\.\d{2}$/u), reason: z.string().trim().min(10).max(1000), key: z.string().uuid() }).safeParse(Object.fromEntries(form));
    if (!input.success) return { status: "error" };
    let amount: string; try { amount = decimalToMinor(input.data.amount); } catch { return { status: "error" }; }
    result = await access.client.rpc("request_subscription_refund_v1", { p_payment_event_id: input.data.paymentId, p_amount_minor: amount, p_reason: input.data.reason, p_idempotency_key: input.data.key });
  } else if (action === "approve" || action === "cancel") {
    const id = z.string().uuid().safeParse(form.get("requestId"));
    if (!id.success) return { status: "error" };
    result = await access.client.rpc("decide_subscription_refund_v1", { p_request_id: id.data, p_approve: action === "approve" });
  } else return { status: "error" };
  if (result.error || (action === "request" ? !z.string().uuid().safeParse(result.data).success : !z.object({ outcome: z.enum(["REFUND_AUTHORIZED", "REFUND_CANCELLED", "REFUND_ALREADY_DECIDED"]) }).safeParse(result.data).success)) return { status: "error" };
  revalidatePath(`/${locale.data}/administration/operations`);
  return { status: "success" };
}

export async function submitRefundReconciliationAction(_state: RefundState, form: FormData): Promise<RefundState> {
  const access = await loadMyPlatformAccess();
  if (access.status !== "ok" || !access.requirementSatisfied || !hasPlatformRole(access.roles, ["SUPER_ADMIN", "FINANCE_MANAGER"])) return { status: "error" };
  const locale = z.enum(["fr", "ar"]).safeParse(form.get("locale"));
  if (!locale.success) return { status: "error" };
  const action = form.get("action");
  let result;
  if (action === "request") {
    const input = z.object({ refundRequestId: z.string().uuid(), providerRefundId: z.string().regex(/^[A-Z0-9-]{8,200}$/u), reason: z.string().trim().min(10).max(1000), key: z.string().uuid() }).safeParse(Object.fromEntries(form));
    if (!input.success) return { status: "error" };
    result = await access.client.rpc("request_refund_reconciliation_v1", { p_refund_request_id: input.data.refundRequestId, p_provider_refund_id: input.data.providerRefundId, p_reason: input.data.reason, p_idempotency_key: input.data.key });
    if (!z.string().uuid().safeParse(result.data).success) return { status: "error" };
  } else if (action === "approve" || action === "cancel") {
    const id = z.string().uuid().safeParse(form.get("reconciliationId"));
    if (!id.success) return { status: "error" };
    result = await access.client.rpc("decide_refund_reconciliation_v1", { p_request_id: id.data, p_approve: action === "approve" });
    if (!z.object({ outcome: z.enum(["REFUND_RECONCILIATION_DECIDED", "REFUND_RECONCILIATION_ALREADY_DECIDED"]) }).safeParse(result.data).success) return { status: "error" };
  } else return { status: "error" };
  if (result.error) return { status: "error" };
  revalidatePath(`/${locale.data}/administration/operations`);
  return { status: "success" };
}

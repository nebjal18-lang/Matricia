"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
import {dsrScopes, type DsrDeliveryState} from "./model";

export async function manageDsrDelivery(_: DsrDeliveryState, form: FormData): Promise<DsrDeliveryState> {
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const locale = z.enum(["fr", "ar"]).safeParse(text("locale"));
  const key = z.string().uuid().safeParse(text("idempotencyKey"));
  if (!locale.success || !key.success) return {status: "error", reason: "VALIDATION"};
  let rpc: string, expected: string[];
  let args: Record<string, unknown>;
  const uuid = (name: string) => z.string().uuid().safeParse(text(name));
  if (text("intent") === "scope") {
    const request = uuid("requestId"), scopes = z.array(z.enum(dsrScopes)).min(1).max(7).safeParse(form.getAll("scopes"));
    if (!request.success || !scopes.success || form.get("scopeConfirmed") !== "on" || (scopes.data.includes("ALL") && scopes.data.length !== 1)) return {status: "error", reason: "VALIDATION"};
    rpc = "confirm_my_dsr_scope_v1";
    args = {p_request_id: request.data, p_requested_scopes: scopes.data, p_idempotency_key: key.data};
    expected = ["DSR_SCOPE_CONFIRMED"];
  } else if (text("intent") === "prepare") {
    const request = uuid("requestId"), scope = uuid("scopeVersionId");
    if (!request.success || !scope.success) return {status: "error", reason: "VALIDATION"};
    rpc = "prepare_admin_dsr_private_response_v1";
    args = {p_request_id: request.data, p_expected_scope_version_id: scope.data, p_idempotency_key: key.data};
    expected = ["DSR_RESPONSE_PREPARED"];
  } else if (["approve", "reject"].includes(text("intent"))) {
    const response = uuid("responseId"), sha = z.string().regex(/^[a-f0-9]{64}$/u).safeParse(text("sha256")), reason = z.string().min(10).max(2000).safeParse(text("reason"));
    const approve = text("intent") === "approve", confirmed = form.get("reviewConfirmed") === "on";
    if (!response.success || !sha.success || !reason.success || (approve && !confirmed)) return {status: "error", reason: "VALIDATION"};
    rpc = "review_admin_dsr_private_response_v1";
    args = {p_response_id: response.data, p_expected_sha256: sha.data, p_approve: approve, p_review_confirmed: confirmed, p_reason: reason.data};
    expected = ["DSR_RESPONSE_REJECTED", "DSR_COMPLETE_RESPONSE_PUBLISHED", "DSR_PARTIAL_RESPONSE_PUBLISHED"];
  } else if (text("intent") === "ack") {
    const response = uuid("responseId"), scope = uuid("scopeVersionId"), sha = z.string().regex(/^[a-f0-9]{64}$/u).safeParse(text("sha256"));
    if (!response.success || !scope.success || !sha.success || form.get("receiptConfirmed") !== "on") return {status: "error", reason: "VALIDATION"};
    rpc = "acknowledge_my_dsr_response_v1";
    args = {p_response_id: response.data, p_scope_version_id: scope.data, p_sha256: sha.data};
    expected = ["DSR_RESPONSE_ACKNOWLEDGED"];
  } else if (text("intent") === "fulfil") {
    const request = uuid("requestId"), response = uuid("responseId"), version = z.coerce.number().int().positive().safeParse(text("rowVersion"));
    if (!request.success || !response.success || !version.success || form.get("completionConfirmed") !== "on") return {status: "error", reason: "VALIDATION"};
    rpc = "transition_data_subject_request";
    args = {p_request_id: request.data, p_expected_version: version.data, p_new_status: "FULFILLED", p_decision_reason_code: "SCOPE_DELIVERED_ACK", p_export_storage_reference: `privacy-response:${response.data}`, p_correlation_id: key.data};
    expected = [];
  } else return {status: "error", reason: "VALIDATION"};
  const client = await getSupabaseServerClient();
  const {data: auth} = await client.auth.getUser();
  if (!auth.user) return {status: "error", reason: "UNAUTHENTICATED"};
  const result = await client.rpc(rpc, args);
  if (result.error) return {status: "error", reason: result.error.code === "40001" ? "STALE" : result.error.code === "42501" ? "FORBIDDEN" : result.error.code === "55000" ? "REVIEW_REQUIRED" : "FAILED"};
  if (expected.length ? !z.object({outcome: z.string().refine((value) => expected.includes(value))}).safeParse(result.data).success : !z.number().int().positive().safeParse(result.data).success) return {status: "error", reason: "FAILED"};
  revalidatePath(`/${locale.data}/confidentialite/demandes`);
  revalidatePath(`/${locale.data}/administration/confidentialite/remise`);
  revalidatePath(`/${locale.data}/administration/confidentialite`);
  return {status: "success"};
}

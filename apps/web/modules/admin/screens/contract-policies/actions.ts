"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
import type {ContractPolicyState} from "./model";

export async function manageContractPolicy(_: ContractPolicyState, form: FormData): Promise<ContractPolicyState> {
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const common = z.object({locale: z.enum(["fr", "ar"]), key: z.string().uuid()}).safeParse({locale: text("locale"), key: text("idempotencyKey")});
  if (!common.success) return {status: "error", reason: "VALIDATION"};
  let rpc: string;
  let args: Record<string, unknown>;
  if (text("intent") === "create") {
    const parsed = z.object({kind: z.enum(["TEMPLATE", "COMMISSION"]), code: z.string().regex(/^[A-Z][A-Z0-9_-]{2,79}$/u), version: z.coerce.number().int().positive(), library_id: z.string().uuid(), service_id: z.union([z.string().uuid(), z.literal("")]), country_code: z.string().regex(/^[A-Z]{2}$/u), title_fr: z.string().min(3).max(240), title_ar: z.string().min(3).max(240), valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u), valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).or(z.literal("")), approval_reference: z.string().min(8).max(500), supersedes_policy_version_id: z.string().uuid().or(z.literal(""))}).safeParse({kind: text("kind"), code: text("code"), version: text("version"), library_id: text("libraryId"), service_id: text("serviceId"), country_code: text("countryCode").toUpperCase(), title_fr: text("titleFr"), title_ar: text("titleAr"), valid_from: text("validFrom"), valid_until: text("validUntil"), approval_reference: text("approvalReference"), supersedes_policy_version_id: text("supersedes")});
    if (!parsed.success) return {status: "error", reason: "VALIDATION"};
    const payload: Record<string, unknown> = {...parsed.data, service_id: parsed.data.service_id || null, valid_until: parsed.data.valid_until || null, supersedes_policy_version_id: parsed.data.supersedes_policy_version_id || null};
    if (parsed.data.kind === "TEMPLATE") {
      const clauses = z.object({fr: z.string().min(10).max(100000), ar: z.string().min(10).max(100000)}).safeParse({fr: text("clausesFr"), ar: text("clausesAr")});
      if (!clauses.success) return {status: "error", reason: "VALIDATION"};
      payload.clauses = clauses.data;
    } else {
      const commission = z.object({basis_points: z.coerce.number().int().min(0).max(10000), currency: z.string().regex(/^[A-Z]{3}$/u)}).safeParse({basis_points: text("basisPoints"), currency: text("currency").toUpperCase()});
      if (!commission.success || !/^\d{1,5}$/u.test(text("basisPoints")) || !parsed.data.service_id) return {status: "error", reason: "VALIDATION"};
      Object.assign(payload, commission.data, {basis_code: "CONFIRMED_CLIENT_RECEIPT_AMOUNT"});
    }
    rpc = "create_contract_policy_version_v1";
    args = {p_payload: payload, p_idempotency_key: common.data.key};
  } else {
    const parsed = z.object({id: z.string().uuid(), decision: z.enum(["approve", "reject"]), reason: z.string().min(10).max(2000)}).safeParse({id: text("policyId"), decision: text("intent"), reason: text("reason")});
    if (!parsed.success || (parsed.data.decision === "approve" && form.get("reviewConfirmed") !== "on")) return {status: "error", reason: "VALIDATION"};
    rpc = "decide_contract_policy_version_v1";
    args = {p_policy_version_id: parsed.data.id, p_approve: parsed.data.decision === "approve", p_reason: parsed.data.reason, p_idempotency_key: common.data.key};
  }
  const client = await getSupabaseServerClient();
  const {data: auth} = await client.auth.getUser();
  if (!auth.user) return {status: "error", reason: "UNAUTHENTICATED"};
  const result = await client.rpc(rpc, args);
  if (result.error) return {status: "error", reason: result.error.message?.includes("COMMISSION_POLICY_EFFECTIVE_WINDOW_OVERLAP") ? "OVERLAP" : result.error.code === "42501" ? "FORBIDDEN" : "FAILED"};
  const expected = rpc === "create_contract_policy_version_v1" ? "CONTRACT_POLICY_VERSION_PROPOSED" : "CONTRACT_POLICY_VERSION_DECIDED";
  if (!z.object({outcome: z.literal(expected), policy_version_id: z.string().uuid()}).safeParse(result.data).success) return {status: "error", reason: "FAILED"};
  revalidatePath(`/${common.data.locale}/administration/politiques-contrats`);
  return {status: "success"};
}

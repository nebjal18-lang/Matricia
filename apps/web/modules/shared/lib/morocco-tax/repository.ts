import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import { hasPlatformRole, loadMyPlatformAccess } from "@/modules/shared/lib/account-security/platform-access";
import {taxContextSchema,type MoroccoTaxDashboard} from "./model";

const uuid = z.string().uuid();
const payloadSchema = z.object({
  categories: z.array(z.object({ code: z.string(), name_fr: z.string(), name_ar: z.string(), category_kind: z.string(), requires_source_rule: z.boolean() })),
  rules: z.array(z.object({ id: uuid, category_code: z.string(), version: z.number().int(), rate_basis_points: z.number().int(), status: z.string(), professional_validation_status: z.string(), rule_type: z.string(), effective_from: z.string(), effective_to: z.string().nullable(), legal_reference: z.string(), row_version: z.number().int() })),
});

export async function loadMoroccoTaxDashboard(): Promise<{ status: "success"; dashboard: MoroccoTaxDashboard } | { status: "error"; reason: "UNAUTHENTICATED" | "FORBIDDEN" | "AAL2_REQUIRED" | "QUERY_FAILED" | "INVALID_RESPONSE" }> {
  try {
  const access = await loadMyPlatformAccess();
  if (access.status === "error") return { status: "error", reason: access.reason };
  if (!hasPlatformRole(access.roles, ["SUPER_ADMIN", "FINANCE_MANAGER"])) return { status: "error", reason: "FORBIDDEN" };
  if (!access.requirementSatisfied) return { status: "error", reason: "AAL2_REQUIRED" };
  const client = access.client;
  const contextResult=await client.rpc("get_morocco_tax_context_v1");
  if(contextResult.error)return{status:"error",reason:contextResult.error.code==="42501"?"FORBIDDEN":"QUERY_FAILED"};
  const context=taxContextSchema.safeParse(contextResult.data);
  if(!context.success)return{status:"error",reason:"INVALID_RESPONSE"};
  const result = await client.rpc("list_morocco_tax_rules");
  if (result.error) {
    if (result.error.code === "42501") return { status: "error", reason: "FORBIDDEN" };
    return { status: "error", reason: "QUERY_FAILED" };
  }
  const parsed = payloadSchema.safeParse(result.data);
  if (!parsed.success) return { status: "error", reason: "INVALID_RESPONSE" };
  return { status: "success", dashboard: { context:context.data, categories: parsed.data.categories.map((item) => ({ code: item.code, nameFr: item.name_fr, nameAr: item.name_ar, kind: item.category_kind, requiresSourceRule: item.requires_source_rule })), rules: parsed.data.rules.map((item) => ({ id: item.id, categoryCode: item.category_code, version: item.version, rateBasisPoints: item.rate_basis_points, status: item.status, validationStatus: item.professional_validation_status, ruleType: item.rule_type, effectiveFrom: item.effective_from, effectiveTo: item.effective_to, legalReference: item.legal_reference, rowVersion: item.row_version })) } };
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", reason: "QUERY_FAILED" };
  }
}

import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { loadMyPlatformAccess, hasPlatformRole } from "@/modules/shared/lib/account-security/platform-access";
import { readAllPages } from "@/modules/shared/lib/data/read-pages";
import { economicContextSchema, type DecisionContext } from "./model";

const rowSchema = z.object({ id: z.string().uuid(), status: z.string(), response_due_at: z.string(), client_organization_id: z.string().uuid(), provider_organization_id: z.string().uuid(), policy_snapshot: z.record(z.string(), z.unknown()) });
const policySchema = z.object({ version: z.union([z.string().min(1), z.number().int()]).transform(String), content_hash: z.string().regex(/^[a-f0-9]{64}$/u) });
const evidenceSchema = z.array(z.object({ id: z.string().uuid(), statement: z.string().nullable(), evidence_type: z.string() }));
const decisionRoles = ["SUPER_ADMIN", "MATRICIA_ADMIN", "DISPUTE_MANAGER"];
export async function loadDisputeDecisionContext(caseId: string): Promise<DecisionContext> {
  try { return await loadContext(caseId); } catch (error) { unstable_rethrow(error); return { status: "error", reason: "UNAVAILABLE" }; }
}
async function loadContext(caseId: string): Promise<DecisionContext> {
  if (!z.string().uuid().safeParse(caseId).success) return { status: "error", reason: "FORBIDDEN" };
  const access = await loadMyPlatformAccess();
  if (access.status === "error") return { status: "error", reason: access.reason === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "UNAVAILABLE" };
  if (!hasPlatformRole(access.roles, [...decisionRoles, "READ_ONLY_AUDITOR"])) return { status: "error", reason: "FORBIDDEN" };
  if (!access.requirementSatisfied) return { status: "error", reason: "MFA_REQUIRED" };
  const query = await access.client.from("dispute_cases").select("id,status,response_due_at,client_organization_id,provider_organization_id,policy_snapshot").eq("id", caseId).maybeSingle();
  if (query.error) return { status: "error", reason: query.error.code === "42501" ? "FORBIDDEN" : "UNAVAILABLE" };
  if (!query.data) return { status: "error", reason: "FORBIDDEN" };
  const row = rowSchema.safeParse(query.data);
  if (!row.success) return { status: "error", reason: "UNAVAILABLE" };
  const [members, economic, evidence] = await Promise.all([
    readAllPages((from,to) => access.client.from("organization_memberships").select("id").eq("user_id", access.userId).eq("status", "ACTIVE").in("organization_id", [row.data.client_organization_id, row.data.provider_organization_id]).order("id").range(from,to)),
    access.client.rpc("get_mission_dispute_economic_context_v1", { p_dispute_case_id: caseId }),
    readAllPages((from,to) => access.client.from("dispute_evidence").select("id,statement,evidence_type").eq("dispute_case_id", caseId).order("id").range(from,to)),
  ]);
  const economics = economicContextSchema.safeParse(economic.data), proofs = evidenceSchema.safeParse(evidence.data);
  if (members.error || !Array.isArray(members.data) || economic.error || !economics.success || economics.data.dispute_case_id !== caseId || evidence.error || !proofs.success) return { status: "error", reason: "UNAVAILABLE" };
  const partyMember = members.data.length > 0, role = hasPlatformRole(access.roles, decisionRoles);
  const eligible = ["MEDIATION_REVIEW", "APPEALED"].includes(row.data.status) || (row.data.status === "WARNING_LEVEL_1" && Date.parse(row.data.response_due_at) < Date.now());
  const policy = policySchema.safeParse(row.data.policy_snapshot);
  return { status: "ready", authorized: role && !partyMember, canDecide: role && !partyMember && eligible, restriction: !role ? "READ_ONLY" : partyMember ? "PARTY_MEMBER" : !eligible ? "STATE" : null, policy: policy.success ? policy.data : null, economics: economics.data, evidence: proofs.data };
}

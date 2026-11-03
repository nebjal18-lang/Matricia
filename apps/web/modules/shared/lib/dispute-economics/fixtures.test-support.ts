import type { DecisionContext, EconomicContext } from "./model";
export const caseId = "00000000-0000-4000-8000-000000000001";
export const versionId = "00000000-0000-4000-8000-000000000002";
export const evidenceId = "00000000-0000-4000-8000-000000000003";
export const economics: EconomicContext = {
  dispute_case_id: caseId, contract_version_id: versionId, obligation_key: "SIGNED_REPORT", economic_status: "AUTHORIZED_SIGNED_TEMPLATE", caller_amounts_accepted: false,
  rule: { economic_status: "AUTHORIZED_SIGNED_TEMPLATE", contract_version_id: versionId, contract_content_hash: "a".repeat(64), template_policy_version_id: versionId, template_content_hash: "b".repeat(64), obligation_key: "SIGNED_REPORT", currency: "TND", penalty_minor: "9223372036854775807", commission_minor: "700", penalty_beneficiary: "CLIENT", commission_beneficiary: "MATRICIA", calculation: "FIXED_CONTRACTUAL_AMOUNT" },
};
export const context: Extract<DecisionContext, { status: "ready" }> = { status: "ready", authorized: true, canDecide: true, restriction: null, policy: { version: "FROZEN-1", content_hash: "c".repeat(64) }, economics, evidence: [{ id: evidenceId, statement: "Motif libre non traduit", evidence_type: "DOCUMENT" }] };

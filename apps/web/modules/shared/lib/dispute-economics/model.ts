import { z } from "zod";

const minor = z.string().regex(/^(0|[1-9][0-9]{0,18})$/u).refine(value => BigInt(value) <= BigInt("9223372036854775807"));
export const economicRuleSchema = z.object({
  economic_status: z.literal("AUTHORIZED_SIGNED_TEMPLATE"),
  contract_version_id: z.string().uuid(), contract_content_hash: z.string().regex(/^[a-f0-9]{64}$/u),
  template_policy_version_id: z.string().uuid(), template_content_hash: z.string().regex(/^[a-f0-9]{64}$/u),
  obligation_key: z.string().min(1), currency: z.string().regex(/^[A-Z]{3}$/u),
  penalty_minor: minor, commission_minor: minor,
  penalty_beneficiary: z.literal("CLIENT"), commission_beneficiary: z.literal("MATRICIA"),
  calculation: z.literal("FIXED_CONTRACTUAL_AMOUNT"),
}).strict();
export const economicContextSchema = z.object({
  dispute_case_id: z.string().uuid(), contract_version_id: z.string().uuid(), obligation_key: z.string().min(1),
  economic_status: z.enum(["AUTHORIZED_SIGNED_TEMPLATE", "APPROVED_SIGNED_ECONOMIC_RULE_REQUIRED"]),
  rule: economicRuleSchema.nullable(), caller_amounts_accepted: z.literal(false),
}).strict().superRefine((value, ctx) => {
  if ((value.economic_status === "AUTHORIZED_SIGNED_TEMPLATE") !== (value.rule !== null) || (value.rule && (value.rule.contract_version_id !== value.contract_version_id || value.rule.obligation_key !== value.obligation_key))) ctx.addIssue({ code: "custom", message: "Inconsistent economic context" });
});
export type EconomicContext = z.infer<typeof economicContextSchema>;
export type DecisionContext = {
  status: "ready"; authorized: boolean; canDecide: boolean;
  restriction: "READ_ONLY" | "PARTY_MEMBER" | "STATE" | null;
  policy: { version: string; content_hash: string } | null;
  economics: EconomicContext;
  evidence: Array<{ id: string; statement: string | null; evidence_type: string }>;
} | { status: "error"; reason: "UNAUTHENTICATED" | "MFA_REQUIRED" | "FORBIDDEN" | "UNAVAILABLE" };

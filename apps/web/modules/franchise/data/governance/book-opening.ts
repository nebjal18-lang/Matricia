import { z } from "zod";
const id = z.string().uuid();
export const bookOpeningInput = z.object({
  locale: z.enum(["fr", "ar"]), franchiseId: id, approvedMandateVersionId: id,
  expectedMandateHash: z.string().regex(/^[0-9a-f]{64}$/), financeRuleId: id,
  currency: z.string().regex(/^[A-Z]{3}$/), idempotencyKey: id,
});
export const bookOpeningContext = z.object({
  complete: z.literal(true), reviewRequired: z.boolean(),
  choices: z.array(z.object({
    franchiseId: id, franchiseStatus: z.string(), approvedMandateVersionId: id,
    expectedMandateHash: z.string().regex(/^[0-9a-f]{64}$/), mandateVersion: z.number().int().positive(),
    financeRuleId: id, financeRuleVersion: z.number().int().positive(), libraryCode: z.string(),
    territoryCode: z.string(), organizationName: z.string(), entryFeeMinor: z.string().regex(/^\d+$/),
    currency: z.string().regex(/^[A-Z]{3}$/), feeCurrency: z.string().regex(/^[A-Z]{3}$/), effectiveFrom: z.string(), effectiveUntil: z.string().nullable(),
    boundBookId: id.nullable(),
  })).max(128),
});
export type BookOpeningContext = z.infer<typeof bookOpeningContext>;
export type BookOpeningFailure = "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "MFA_REQUIRED" | "CHANGED" | "RECONCILIATION" | "SCOPE_REQUIRED" | "UNAVAILABLE";
export type BookOpeningState = { status: "idle" } | { status: "error"; reason: BookOpeningFailure } | { status: "success"; bookId: string; franchiseId: string };
export function classifyBookOpeningFailure(error: { code?: string; message?: string }): BookOpeningFailure {
  const message = error.message ?? "";
  if (/AAL2|MFA/.test(message)) return "MFA_REQUIRED";
  if (error.code === "42501") return "FORBIDDEN";
  if (error.code === "54000") return "SCOPE_REQUIRED";
  if (/RECONCILIATION|BINDING_REVIEW/.test(message)) return "RECONCILIATION";
  if (error.code === "40001" || error.code === "55000" || error.code === "23505") return "CHANGED";
  if (error.code === "22023") return "VALIDATION";
  return "UNAVAILABLE";
}

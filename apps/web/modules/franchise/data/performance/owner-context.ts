import { z } from "zod";
const id = z.string().uuid();
export const planOwnerContextSchema = z.object({
  organizationId: id, version: z.number().int().nonnegative(), ownerUserId: id.nullable(), ownerName: z.string().nullable(), ownerActive: z.boolean(), ownerConfirmed: z.boolean(), historicalSuggestedOwnerUserId: id.nullable(),
  canProgress: z.boolean(), canProposeAssignment: z.boolean(), canApprovePlan: z.boolean(), canCompletePlan: z.boolean(), canRejectPlan: z.boolean(),
  candidates: z.array(z.object({ id, name: z.string().nullable(), index: z.number().int().positive() })).max(50), candidateCount: z.number().int().nonnegative(),
  requests: z.array(z.object({ id, ownerUserId: id, ownerName: z.string().nullable(), createdAt: z.string(), decision: z.enum(["APPROVE", "REJECT"]).nullable(), version: z.number().int().nullable(), canReview: z.boolean() })).max(25), assignmentRequestCount: z.number().int().nonnegative(), nextRequestCursor: z.object({ before: z.string().datetime({ offset: true }), id }).nullable(),
});
export type PlanOwnerContext = z.infer<typeof planOwnerContextSchema>;

import { z } from "zod";
const uuid = z.string().uuid();
const credits = z.string().regex(/^(0|[1-9][0-9]{0,18})$/u).refine((value) => BigInt(value) <= BigInt("9223372036854775807"));
export const envelopesSchema = z.object({
  box_id: uuid,
  box_type: z.enum(["FIXED", "SEMI_CUSTOM", "CUSTOM", "ENTERPRISE", "MULTI_USER", "MULTI_LIBRARY"]),
  scope: z.enum(["MEMBER", "LIBRARY"]).nullable(),
  targets: z.array(z.object({ id: uuid, name: z.string(), name_ar: z.string().optional() })),
  envelopes: z.array(z.object({ target_id: uuid, version: z.number().int().positive(), credit_limit: credits, used: credits })),
  can_manage: z.boolean(),
});
export type BoxEnvelopes = z.infer<typeof envelopesSchema>;
export const envelopeInputSchema = z.object({
  boxId: uuid, targetId: uuid, scope: z.enum(["MEMBER", "LIBRARY"]),
  expectedVersion: z.coerce.number().int().nonnegative(), creditLimit: credits,
  reason: z.string().trim().min(5).max(1000), idempotencyKey: uuid, locale: z.enum(["fr", "ar"]),
});
export type EnvelopeState = { status: "idle" | "success" | "error"; reason?: "VALIDATION" | "FORBIDDEN" | "STALE" | "BUDGET" | "COMMITTED" | "UNAVAILABLE" };
export const recommendationsSchema = z.object({ status: z.string(), recommendations: z.array(z.object({
  benefit_version_id: uuid, name_fr: z.string(), name_ar: z.string(), credit_cost: credits,
  recommendation_id: uuid, anomaly_id: uuid, reason_fr: z.string(), reason_ar: z.string(), priority: z.number().int(),
})) });

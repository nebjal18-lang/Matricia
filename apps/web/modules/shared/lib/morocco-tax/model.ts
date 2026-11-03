import { z } from "zod";

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const taxContextSchema=z.discriminatedUnion("kind",[
  z.object({kind:z.literal("PLATFORM")}).strict(),
  z.object({kind:z.literal("ORGANIZATION"),organizationId:uuid}).strict(),
]);
export type TaxContext=z.infer<typeof taxContextSchema>;
const exactMinor = z.string().regex(/^-?\d+$/);

export const taxSimulationSchema = z.object({
  categoryCode: z.string().trim().regex(/^[A-Z][A-Z0-9_]{2,79}$/),
  effectiveOn: isoDate,
  netMinor: exactMinor.refine((value) => value !== "0"),
  sourceRuleVersionId: z.union([uuid, z.literal("")]),
});

export const taxProposalSchema = z.object({
  context: taxContextSchema,
  categoryCode: z.string().trim().regex(/^[A-Z][A-Z0-9_]{2,79}$/),
  ruleType: z.enum(["VAT", "EXEMPT", "OUT_OF_SCOPE", "WITHHOLDING"]),
  rateBasisPoints: z.coerce.number().int().min(0).max(10_000),
  priority: z.coerce.number().int().min(1).max(10_000),
  legalReference: z.string().trim().min(10).max(1_000),
  effectiveFrom: isoDate,
  effectiveTo: z.union([isoDate, z.literal("")]),
  changeReason: z.string().trim().min(10).max(1_000),
  idempotencyKey: uuid,
}).refine((value) => !value.effectiveTo || value.effectiveTo >= value.effectiveFrom, { path: ["effectiveTo"] })
  .refine((value) => !["EXEMPT", "OUT_OF_SCOPE"].includes(value.ruleType) || value.rateBasisPoints === 0, { path: ["rateBasisPoints"] });

export const taxDecisionSchema = z.object({
  context: taxContextSchema,
  taxRuleVersionId: uuid,
  decision: z.enum(["APPROVE", "REJECT", "RETIRE"]),
  professionalValidationStatus: z.enum(["DEMO", "VALIDATED"]),
  validationReference: z.string().trim().min(3).max(500),
  reason: z.string().trim().min(10).max(1_000),
  rowVersion: z.coerce.number().int().nonnegative(),
  idempotencyKey: uuid,
});

export type TaxCategory = { code: string; nameFr: string; nameAr: string; kind: string; requiresSourceRule: boolean };
export type TaxRule = { id: string; categoryCode: string; version: number; rateBasisPoints: number; status: string; validationStatus: string; ruleType: string; effectiveFrom: string; effectiveTo: string | null; legalReference: string; rowVersion: number };
export type MoroccoTaxDashboard = { context: TaxContext; categories: TaxCategory[]; rules: TaxRule[] };
export type TaxSimulation = { categoryCode: string; taxRuleVersionId: string; ruleType: string; netMinor: string; taxMinor: string; grossMinor: string; rateBasisPoints: number; validationStatus: string; legalReference: string };

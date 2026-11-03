import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const providerProfileInputSchema = z.object({
  organizationId: uuidSchema,
  expectedRowVersion: z.coerce.number().int().min(0),
  activitySummary: z.string().trim().min(10).max(2000),
  teamSize: z.coerce.number().int().min(1).max(1_000_000),
  yearsExperience: z.coerce.number().int().min(0).max(200),
  accountingContactEmail: z.union([z.literal(""), z.string().trim().email().max(320)]),
  secondarySubcontractingAllowed: z.boolean(),
  idempotencyKey: uuidSchema,
});
export const providerServiceInputSchema = z.object({ organizationId: uuidSchema, serviceId: uuidSchema, idempotencyKey: uuidSchema });
export const providerCapacityInputSchema = z.object({
  organizationId: uuidSchema,
  serviceId: uuidSchema.nullable(),
  capacityStatus: z.enum(["AVAILABLE", "LIMITED", "FULL", "PAUSED"]),
  availableUnits: z.number().int().min(0).nullable(),
  leadTimeDays: z.number().int().min(0).max(3650),
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: uuidSchema,
}).superRefine((value, context) => {
  if (value.capacityStatus === "FULL" && value.availableUnits !== 0) context.addIssue({ code: "custom", path: ["availableUnits"], message: "FULL_REQUIRES_ZERO" });
  if (value.capacityStatus === "PAUSED" && value.availableUnits !== null) context.addIssue({ code: "custom", path: ["availableUnits"], message: "PAUSED_REQUIRES_NULL" });
});
export const providerDocumentInputSchema = z.object({
  organizationId: uuidSchema,
  documentKind: z.enum(["LEGAL", "FISCAL", "INSURANCE", "CERTIFICATION", "LICENSE", "ACCREDITATION", "REFERENCE", "PORTFOLIO", "PARTNER_CONTRACT"]),
  code: z.string().trim().regex(/^[A-Z][A-Z0-9_.-]{1,79}$/),
  issuerName: z.string().trim().max(200), referenceNumber: z.string().trim().max(200),
  issuedOn: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  expiresOn: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  providerServiceIds: z.array(uuidSchema).max(100), changeReason: z.string().trim().min(3).max(500), idempotencyKey: uuidSchema,
});

export type ProviderProfile = { companyStatus: string; overallStatus: string; activitySummary: string; teamSize: number; yearsExperience: number; secondarySubcontractingAllowed: boolean; accountingContactEmail: string | null; partnerContractStatus: string; rowVersion: number };
export type ProviderServiceEligibility = {
  eligible: boolean;
  reasons: string[];
  decisionVersion: number | null;
  ruleVersion: string | null;
  checkedAt: string | null;
};
export type LocalizedLabel = { fr: string; ar: string };
export type ProviderService = { id: string; serviceId: string; code: string; label: LocalizedLabel; libraryLabel: LocalizedLabel; categoryLabel: LocalizedLabel; requestStatus: string; qualificationId: string | null; qualificationStatus: string; capacityStatus: string; availableUnits: number | null; leadTimeDays: number | null; eligibility: ProviderServiceEligibility };
export type ProviderDocument = { id: string; kind: string; code: string; version: number; status: string; expiresOn: string | null; scanStatus?: "PENDING" | "CLEAN" | "INFECTED" | "ERROR" };
export type ProviderCatalogService = { id: string; code: string; label: LocalizedLabel; libraryLabel: LocalizedLabel; categoryLabel: LocalizedLabel };
export type ProviderDashboard = { identityReview?:{verified:boolean;lastVerifiedAt:string|null}; organizationId: string; organizationName: string; profile: ProviderProfile | null; services: ProviderService[]; documents: ProviderDocument[]; regionCodes?: string[]; interventionModes?:import("./intervention-modes").InterventionMode[]; interventionModeVersion?:number; documentPage?:number; documentsHasMore?:boolean; catalogServices: ProviderCatalogService[] };

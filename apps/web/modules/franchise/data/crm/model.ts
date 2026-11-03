import { z } from "zod";

export const PIPELINE_STAGES = ["SENT", "OPENED", "REGISTERED", "PROFILE_STARTED", "VERIFIED", "DIAGNOSTIC_STARTED", "OPPORTUNITY_CREATED", "RFQ_STARTED", "CONTRACT_SIGNED"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];
export const ACTIVITY_TYPES = ["CALL", "EMAIL", "MEETING", "NOTE", "FOLLOW_UP", "INVITATION"] as const;

const uuid = z.string().uuid(), key = z.string().uuid(), integer = z.string().regex(/^\d+$/u);
export const prospectSchema = z.object({ franchiseId: uuid, territoryVersionId: uuid, prospectType: z.enum(["CLIENT", "PROVIDER"]), displayName: z.string().trim().min(2).max(200), contactEmail: z.string().trim().email(), organizationName: z.string().trim().max(200), sourceCode: z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/u), nextFollowupAt: z.string().datetime({ offset: true }).or(z.literal("")), ownerUserId: uuid, idempotencyKey: key });
export const activitySchema = z.object({ prospectId: uuid, activityType: z.enum(ACTIVITY_TYPES), occurredAt: z.string().datetime({ offset: true }), summary: z.string().trim().min(3).max(2000), evidenceReference: z.string().trim().max(500), nextFollowupAt: z.string().datetime({ offset: true }).or(z.literal("")), idempotencyKey: key });
export const pipelineSchema = z.object({ prospectId: uuid, toStage: z.enum(PIPELINE_STAGES), reasonCode: z.string().trim().min(3).max(80).regex(/^[A-Z0-9_]+$/u), rowVersion: z.coerce.number().int().positive(), evidenceReference: z.string().trim().max(500), idempotencyKey: key });
export const snapshotSchema = z.object({ franchiseId: uuid, metricVersionId: uuid, periodStart: z.string().date(), periodEnd: z.string().date(), modelVersion: z.string().trim().min(1).max(80), numerator: integer, denominator: integer.refine((value) => BigInt(value) > BigInt(0)), evidenceReference: z.string().trim().min(1).max(500), sourceEvidenceHash: z.string().regex(/^[0-9a-f]{64}$/u), idempotencyKey: key }).refine((value) => value.periodEnd >= value.periodStart, { path: ["periodEnd"] });

export function nextPipelineStage(stage: PipelineStage): PipelineStage | null { const index = PIPELINE_STAGES.indexOf(stage); return index >= 0 && index < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[index + 1] ?? null : null; }
export function formatBasisPoints(value: number, locale: "fr" | "ar"): string { return new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA", { style: "percent", minimumFractionDigits: value % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(value / 10_000); }

export type FranchiseCrmDashboard = {
  currentUserId: string; canWrite: boolean; canRecordPerformance: boolean;
  franchises: { id: string; operatorCode: string; type: "IT" | "STANDARD"; canWrite: boolean; territory: { id: string; code: string; nameFr: string; nameAr: string; version: number } | null }[];
  prospects: { invitation?: { id:string;status:"QUEUED"|"SENT"|"OPENED"|"REGISTERED"|"EXPIRED"|"REVOKED";deliveryMode:"EXTERNAL"|"NON_CONTRACTUAL_DEMO";expiresAt:string;sentAt:string|null; }; id: string; linkedOrganizationId?:string|null; createdAt?:string; franchiseId: string; territoryVersionId: string; type: "CLIENT" | "PROVIDER"; displayName: string; contactEmail: string; organizationName: string | null; sourceCode: string; stage: PipelineStage; nextFollowupAt: string | null; rowVersion: number; activities: { id: string; type: (typeof ACTIVITY_TYPES)[number]; occurredAt: string; summary: string; evidenceRefs: unknown[] }[]; pipelineEvents: { id: string; from: PipelineStage | null; to: PipelineStage; reasonCode: string; occurredAt: string; evidenceRefs: unknown[] }[] }[];
  metrics: { id: string; code: string; axis: string; labelFr: string; labelAr: string; weightBps: number; warningBelowBps: number; version: number }[];
  snapshots: { id: string; franchiseId: string; periodStart: string; periodEnd: string; modelVersion: string; globalScoreBps: number; libraryQualityScoreBps: number; axisScores: Record<string, number>; healthSuggestion: "HEALTHY" | "ATTENTION" | "IMPROVEMENT_PLAN" | "UNDER_REVIEW" }[];
  alerts: { id: string; franchiseId: string; snapshotId: string; type: string; severity: "INFO" | "WARNING" | "CRITICAL"; status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED"; metricCode: string | null; explanationFr: string; explanationAr: string; evidenceRefs: unknown[]; ruleVersion: string }[];
  objectives: { id: string; franchiseId: string; code: string; version: number; titleFr: string; titleAr: string; targetValue: string; currentValue: string; unitCode: string; status: "ACTIVE" | "ACHIEVED" | "CANCELLED"; startsOn: string; dueOn: string; ruleVersion: string }[];
};

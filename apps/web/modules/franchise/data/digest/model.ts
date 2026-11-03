import { z } from "zod";

const uuid = z.string().uuid();
const nonNegativeInteger = z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/u).transform(Number)]);

export const DIGEST_FREQUENCIES = ["DAILY", "WEEKDAYS"] as const;
export const DIGEST_JOB_STATUSES = ["QUEUED", "CLAIMED", "NOTIFIED", "FAILED", "DEAD_LETTER"] as const;

export const digestConfigurationInput = z.object({
  franchiseId: uuid,
  recipientUserId: uuid,
  enabled: z.boolean(),
  frequency: z.enum(DIGEST_FREQUENCIES),
  localSendTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u),
  timeZone: z.string().trim().min(1).max(100),
  notificationLocale: z.enum(["fr-MA", "ar-MA"]),
  changeReason: z.string().trim().min(3).max(1000),
  idempotencyKey: uuid,
});

const metricsSnapshot = z.object({
  policy_version: nonNegativeInteger,
  crm: z.object({
    total_prospects: nonNegativeInteger,
    client_prospects: nonNegativeInteger,
    provider_prospects: nonNegativeInteger,
    pipeline: z.record(z.string(),nonNegativeInteger),
  }).strict(),
  followups: z.object({ overdue: nonNegativeInteger, next_24_hours: nonNegativeInteger }).strict(),
  performance: z.object({
    global_score_basis_points: z.number().int().nullable(),
    library_quality_score_basis_points: z.number().int().nullable(),
    health_suggestion: z.string(),
    period_end: z.string().nullable(),
  }).strict(),
  alerts: z.object({ open_total: nonNegativeInteger, critical: nonNegativeInteger, warning: nonNegativeInteger }).strict(),
  objectives: z.object({ active: nonNegativeInteger, overdue: nonNegativeInteger, due_today: nonNegativeInteger }).strict(),
}).strict();

export const digestConfigurationRow = z.object({
  id: uuid, franchise_id: uuid, recipient_user_id: uuid, version: z.number().int().positive(), enabled: z.boolean(),
  frequency: z.enum(DIGEST_FREQUENCIES), local_send_time: z.string(), time_zone: z.string(), locale: z.enum(["fr-MA", "ar-MA"]), created_at: z.string(),
});
export const digestRow = z.object({ id: uuid, franchise_id: uuid, digest_date: z.string(), locale: z.enum(["fr-MA", "ar-MA"]), metrics_snapshot: metricsSnapshot, generated_at: z.string() });
export const digestJobRow = z.object({ id: uuid, digest_id: uuid, franchise_id: uuid, recipient_user_id: uuid, status: z.enum(DIGEST_JOB_STATUSES), attempt_count: z.number().int().nonnegative(), next_attempt_at: z.string().nullable(), last_error_code: z.string().nullable(), updated_at: z.string() });

export type FranchiseDigestDashboard = {
  currentUserId: string;
  franchises: Array<{ id: string; territoryCode: string; territoryNameFr: string; territoryNameAr: string; mandateVersion: number }>;
  configurations: Array<z.infer<typeof digestConfigurationRow>>;
  digests: Array<z.infer<typeof digestRow>>;
  jobs: Array<z.infer<typeof digestJobRow>>;
};

export function latestConfigurations(rows: z.infer<typeof digestConfigurationRow>[]) {
  const latest = new Map<string, z.infer<typeof digestConfigurationRow>>();
  for (const row of rows) if (!latest.has(row.franchise_id)) latest.set(row.franchise_id, row);
  return [...latest.values()];
}

export function formatBasisPoints(value: number | null, locale: "fr" | "ar") {
  if (value === null) return "—";
  return new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA", { style: "percent", minimumFractionDigits: value % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(value / 10000);
}

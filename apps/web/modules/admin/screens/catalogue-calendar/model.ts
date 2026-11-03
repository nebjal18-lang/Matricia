import { z } from "zod";
export const calendarRoles = ["SUPER_ADMIN", "MATRICIA_ADMIN"] as const;
const uuid = z.string().uuid(), hash = z.string().regex(/^[a-f0-9]{64}$/), timestamp = z.string().datetime({ offset: true });
export const windowConflictSchema = z.object({ releaseId: uuid, libraryId: uuid, libraryCode: z.string().min(1), releaseKey: z.string().min(1), expectedSnapshotHash: hash, rowVersion: z.number().int().positive(), effectiveFrom: timestamp, effectiveUntil: timestamp.nullable(), currentReleaseId: uuid, currentReleaseKey: z.string().min(1), canRequest: z.boolean() });
export const windowRequestSchema = z.object({ id: uuid, libraryId: uuid, libraryCode: z.string().min(1), releaseId: uuid, releaseKey: z.string().min(1), currentReleaseKey: z.string().min(1), sourceHash: hash, reason: z.string(), requestedBy: uuid, requestedAt: timestamp, status: z.enum(["PENDING", "CLOSED", "REJECTED"]), canDecide: z.boolean(), sourceChanged: z.boolean(), decisionReason: z.string().nullable(), closedAt: timestamp.nullable() });
export const calendarContextSchema = z.object({ complete: z.literal(true), page: z.number().int().min(1).max(10000), pageSize: z.literal(25), hasMore: z.boolean(), conflicts: z.array(windowConflictSchema).max(25), requests: z.array(windowRequestSchema).max(25) });
export type CalendarContext = z.infer<typeof calendarContextSchema>;
export type WindowConflict = z.infer<typeof windowConflictSchema>;
export type WindowRequest = z.infer<typeof windowRequestSchema>;
export type CalendarFailure = "UNAUTHENTICATED" | "MFA_REQUIRED" | "FORBIDDEN" | "CONFIGURATION" | "QUERY_FAILED" | "INVALID_RESPONSE" | "VALIDATION" | "CONFLICT";
export function calendarRpcFailure(error: {
    code?: string;
    message?: string;
}): CalendarFailure {
    if (["PGRST301", "PGRST303"].includes(error.code ?? ""))
        return "UNAUTHENTICATED";
    if (error.code === "42501")
        return error.message === "CENTRAL_MFA_REQUIRED" ? "MFA_REQUIRED" : error.message === "CATALOG_AUTH_REQUIRED" ? "UNAUTHENTICATED" : "FORBIDDEN";
    if (["40001", "55000", "23505", "22000"].includes(error.code ?? ""))
        return "CONFLICT";
    if (["PGRST202", "PGRST205", "42883", "42P01"].includes(error.code ?? ""))
        return "CONFIGURATION";
    return "QUERY_FAILED";
}

export type CalendarDateLabels = Record<string, { from: string; until: string | null }>;

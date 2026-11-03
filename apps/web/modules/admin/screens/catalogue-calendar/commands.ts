import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { calendarRpcFailure, windowConflictSchema, windowRequestSchema, type CalendarFailure, type WindowConflict, type WindowRequest } from "./model";
export type CalendarCommandResult = {
    ok: true;
} | {
    ok: false;
    reason: CalendarFailure;
};
const commandSchema = z.object({ reason: z.string().trim().min(10).max(2000), key: z.string().uuid() });
export async function requestWindowClosure(client: SupabaseClient, source: WindowConflict, reason: string, key: string): Promise<CalendarCommandResult> {
    const command = commandSchema.safeParse({ reason, key }), row = windowConflictSchema.safeParse(source);
    if (!command.success || !row.success || !row.data.canRequest)
        return { ok: false, reason: "VALIDATION" };
    try {
        const result = await client.rpc("request_catalog_release_window_closure_v1", { p_release_id: row.data.releaseId, p_expected_row_version: row.data.rowVersion, p_expected_snapshot_hash: row.data.expectedSnapshotHash, p_reason: command.data.reason, p_idempotency_key: key });
        if (result.error)
            return { ok: false, reason: calendarRpcFailure(result.error) };
        const receipt = z.object({ outcome: z.literal("CATALOG_RELEASE_WINDOW_CLOSURE_REQUESTED"), request_id: z.string().uuid(), source_hash: z.string().regex(/^[a-f0-9]{64}$/) }).safeParse(result.data);
        return receipt.success ? { ok: true } : { ok: false, reason: "INVALID_RESPONSE" };
    }
    catch {
        return { ok: false, reason: "QUERY_FAILED" };
    }
}
export async function decideWindowClosure(client: SupabaseClient, source: WindowRequest, approved: boolean, reason: string, key: string): Promise<CalendarCommandResult> {
    const command = commandSchema.safeParse({ reason, key }), row = windowRequestSchema.safeParse(source);
    if (!command.success || !row.success || !row.data.canDecide || approved && row.data.sourceChanged || row.data.status !== "PENDING")
        return { ok: false, reason: "VALIDATION" };
    try {
        const result = await client.rpc("decide_catalog_release_window_closure_v1", { p_request_id: row.data.id, p_expected_source_hash: row.data.sourceHash, p_approved: approved, p_reason: command.data.reason, p_idempotency_key: key });
        if (result.error)
            return { ok: false, reason: calendarRpcFailure(result.error) };
        const receipt = z.object({ outcome: z.literal(approved ? "CATALOG_RELEASE_WINDOW_CLOSED" : "CATALOG_RELEASE_WINDOW_CLOSURE_REJECTED"), request_id: z.literal(row.data.id), release_id: z.literal(row.data.releaseId), effective_until: z.string().datetime({ offset: true }).nullable() }).safeParse(result.data);
        return receipt.success ? { ok: true } : { ok: false, reason: "INVALID_RESPONSE" };
    }
    catch {
        return { ok: false, reason: "QUERY_FAILED" };
    }
}

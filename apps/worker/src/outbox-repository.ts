import type { SupabaseClient } from "@supabase/supabase-js";
import type { OutboxEnvelope } from "./index";

type ClaimedRow = {
  id: number | string;
  event_type: string;
  aggregate_id: string;
  occurred_at: string;
  correlation_id: string;
  payload: Record<string, unknown>;
};

export interface OutboxRepository {
  claim(workerId: string, limit: number): Promise<readonly OutboxEnvelope[]>;
  deferDependency?(eventId: string, workerId: string): Promise<void>;
  markPublished(eventId: string, workerId: string): Promise<void>;
  recordFailure(eventId: string, workerId: string, errorCode: string): Promise<void>;
}

function assertSuccess(error: { message?: string } | null, code: string): void {
  if (error) throw new Error(code);
}

export function createSupabaseOutboxRepository(client: SupabaseClient): OutboxRepository {
  return {
    async claim(workerId, limit) {
      const { data, error } = await client.rpc("claim_outbox_events", { p_worker_id: workerId, p_limit: limit });
      assertSuccess(error, "OUTBOX_CLAIM_FAILED");
      return ((data ?? []) as ClaimedRow[]).map((row) => ({
        id: String(row.id),
        eventType: row.event_type,
        aggregateId: row.aggregate_id,
        occurredAt: row.occurred_at,
        correlationId: row.correlation_id,
        payload: Object.freeze({ ...row.payload }),
      }));
    },
    async deferDependency(eventId, workerId) {
      const { error } = await client.rpc("defer_outbox_document_dependency_v1", { p_event_id: eventId, p_worker_id: workerId });
      assertSuccess(error, "OUTBOX_DEFER_DEPENDENCY_FAILED");
    },
    async markPublished(eventId, workerId) {
      const { error } = await client.rpc("mark_outbox_published", { p_event_id: eventId, p_worker_id: workerId });
      assertSuccess(error, "OUTBOX_MARK_PUBLISHED_FAILED");
    },
    async recordFailure(eventId, workerId, errorCode) {
      const { error } = await client.rpc("record_outbox_failure", { p_event_id: eventId, p_worker_id: workerId, p_error_code: errorCode });
      assertSuccess(error, "OUTBOX_RECORD_FAILURE_FAILED");
    },
  };
}

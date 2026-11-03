type RpcResult = { data: unknown; error: unknown };
export type FollowupRpcClient = { rpc(name: string, parameters?: Record<string, unknown>): PromiseLike<RpcResult> };
type FailureCode = "FRANCHISE_FOLLOWUP_SCHEDULE_FAILED" | "FRANCHISE_FOLLOWUP_CLAIM_FAILED" | "FRANCHISE_FOLLOWUP_PROCESSING_FAILED" | "FRANCHISE_FOLLOWUP_FAILURE_RECORD_FAILED";
export type FranchiseFollowupState = Readonly<{
  followups: Readonly<{ ok: boolean; latencyMs: number; processed: number; failed: number; code?: FailureCode | "FRANCHISE_FOLLOWUP_RUNNING" }> | null;
}>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
function jobs(value: unknown, field: "id" | "job_id", limit: number): string[] {
  if (!Array.isArray(value) || value.length > limit) throw new Error("FRANCHISE_FOLLOWUP_RECEIPT_INVALID");
  const identifiers = value.map((row: unknown) => {
    if (!object(row) || typeof row[field] !== "string" || !uuid.test(row[field])) throw new Error("FRANCHISE_FOLLOWUP_RECEIPT_INVALID");
    return row[field];
  });
  if (new Set(identifiers).size !== identifiers.length) throw new Error("FRANCHISE_FOLLOWUP_RECEIPT_INVALID");
  return identifiers;
}
function validCompletion(value: unknown, jobId: string) {
  return object(value) && value.outcome === "FRANCHISE_FOLLOWUP_QUEUED" && value.job_id === jobId;
}
function validFailure(value: unknown, jobId: string) {
  return object(value) && ["FRANCHISE_FOLLOWUP_RETRY_SCHEDULED", "FRANCHISE_FOLLOWUP_DEAD_LETTERED"].includes(String(value.outcome))
    && value.job_id === jobId && Number.isSafeInteger(value.attempt_count) && Number(value.attempt_count) > 0;
}

/** The database owns durable leases and retries; queuing is not an email delivery receipt. */
export function createFranchiseFollowupScheduler(client: FollowupRpcClient, workerId: string) {
  let inFlight: Promise<void> | null = null;
  let state: FranchiseFollowupState = Object.freeze({ followups: null });
  const execute = async () => {
    const started = performance.now();
    let processed = 0, failed = 0;
    let failure: FailureCode = "FRANCHISE_FOLLOWUP_SCHEDULE_FAILED";
    state = Object.freeze({ followups: { ok: false, latencyMs: 0, processed, failed, code: "FRANCHISE_FOLLOWUP_RUNNING" } });
    try {
      const scheduled = await client.rpc("schedule_franchise_followups", { p_limit: 100 });
      if (scheduled.error) throw new Error(failure);
      jobs(scheduled.data, "job_id", 100);
      failure = "FRANCHISE_FOLLOWUP_CLAIM_FAILED";
      const claim = await client.rpc("claim_franchise_followup_jobs", { p_worker_id: workerId, p_limit: 25 });
      if (claim.error) throw new Error(failure);
      const claimed = jobs(claim.data, "id", 25);
      let recordingFailed = false;
      for (const jobId of claimed) {
        try {
          const completed = await client.rpc("complete_franchise_followup_job", { p_job_id: jobId, p_worker_id: workerId });
          if (completed.error || !validCompletion(completed.data, jobId)) throw new Error("FOLLOWUP_QUEUE_FAILED");
          processed += 1;
        } catch {
          failed += 1;
          try {
            const receipt = await client.rpc("fail_franchise_followup_job", { p_job_id: jobId, p_worker_id: workerId, p_error_code: "FOLLOWUP_QUEUE_FAILED" });
            if (receipt.error || !validFailure(receipt.data, jobId)) recordingFailed = true;
          } catch { recordingFailed = true; }
        }
      }
      if (failed > 0) {
        failure = recordingFailed ? "FRANCHISE_FOLLOWUP_FAILURE_RECORD_FAILED" : "FRANCHISE_FOLLOWUP_PROCESSING_FAILED";
        throw new Error(failure);
      }
      state = Object.freeze({ followups: { ok: true, latencyMs: Math.max(0, performance.now() - started), processed, failed } });
    } catch {
      state = Object.freeze({ followups: { ok: false, latencyMs: Math.max(0, performance.now() - started), processed, failed, code: failure } });
      throw new Error(failure);
    }
  };
  const run = () => {
    if (inFlight) return inFlight;
    inFlight = execute().finally(() => { inFlight = null; });
    return inFlight;
  };
  return Object.assign(run, { getState: (): FranchiseFollowupState => state });
}

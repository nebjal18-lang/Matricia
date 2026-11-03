type RpcResult = { data: unknown; error: unknown };
export type FranchisePerformanceRpcClient = { rpc(name: string, parameters: Record<string, unknown>): PromiseLike<RpcResult> };
export type FranchisePerformanceState = Readonly<{
  control: Readonly<{ ok: boolean; latencyMs: number; code?: "FRANCHISE_CONTROL_RUNNING" | "FRANCHISE_CONTROL_BUSY" | "FRANCHISE_CONTROL_SCHEDULER_FAILED" }> | null;
}>;

/** Database owns periods, source facts, locks, immutable reports and bounded resume. */
export function createFranchisePerformanceScheduler(client: FranchisePerformanceRpcClient) {
  let inFlight: Promise<void> | null = null;
  let state: FranchisePerformanceState = Object.freeze({ control: null });
  const execute = async () => {
    const started = performance.now();
    state = Object.freeze({ control: { ok: false, latencyMs: 0, code: "FRANCHISE_CONTROL_RUNNING" } });
    try {
      const result = await client.rpc("run_franchise_performance_control_v1", { p_limit: 25 });
      if (result.error || !result.data || typeof result.data !== "object") throw new Error("FRANCHISE_CONTROL_SCHEDULER_FAILED");
      const receipt = result.data as Record<string, unknown>;
      if (!["FRANCHISE_CONTROL_COMPLETED", "FRANCHISE_CONTROL_BUSY"].includes(String(receipt.outcome))
        || !Number.isSafeInteger(receipt.processed) || Number(receipt.processed) < 0 || Number(receipt.processed) > 25
        || !Number.isSafeInteger(receipt.failed) || Number(receipt.failed) < 0 || Number(receipt.failed) > 25
        || Number(receipt.processed) + Number(receipt.failed) > 25 || Number(receipt.failed) > 0
        || receipt.outcome === "FRANCHISE_CONTROL_BUSY" && (receipt.processed !== 0 || receipt.failed !== 0)) {
        throw new Error("FRANCHISE_CONTROL_SCHEDULER_FAILED");
      }
      state = Object.freeze({ control: { ok: receipt.outcome === "FRANCHISE_CONTROL_COMPLETED", latencyMs: Math.max(0, performance.now() - started), ...(receipt.outcome === "FRANCHISE_CONTROL_BUSY" ? { code: "FRANCHISE_CONTROL_BUSY" as const } : {}) } });
    } catch {
      state = Object.freeze({ control: { ok: false, latencyMs: Math.max(0, performance.now() - started), code: "FRANCHISE_CONTROL_SCHEDULER_FAILED" } });
      throw new Error("FRANCHISE_CONTROL_SCHEDULER_FAILED");
    }
  };
  const run = () => {
    if (inFlight) return inFlight;
    inFlight = execute().finally(() => { inFlight = null; });
    return inFlight;
  };
  return Object.assign(run, { getState: (): FranchisePerformanceState => state });
}

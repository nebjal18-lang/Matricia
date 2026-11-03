import { describe, expect, it, vi } from "vitest";
import { createFranchisePerformanceScheduler } from "./franchise-performance";
const receipt = (processed = 0) => ({ data: { outcome: "FRANCHISE_CONTROL_COMPLETED", processed, failed: 0 }, error: null });
describe("native Franchise control scheduler", () => {
  it("delegates dates and facts to the bounded database command", async () => {
    const rpc = vi.fn().mockResolvedValue(receipt(3));
    await createFranchisePerformanceScheduler({ rpc })();
    expect(rpc).toHaveBeenCalledExactlyOnceWith("run_franchise_performance_control_v1", { p_limit: 25 });
  });
  it("accepts a real lock-busy receipt", async () => {
    await expect(createFranchisePerformanceScheduler({ rpc: vi.fn().mockResolvedValue({ data: { outcome: "FRANCHISE_CONTROL_BUSY", processed: 0, failed: 0 }, error: null }) })()).resolves.toBeUndefined();
  });
  it.each([null, {}, { outcome: "FRANCHISE_CONTROL_COMPLETED", processed: 2, failed: 1 }, { outcome: "FRANCHISE_CONTROL_COMPLETED", processed: "0", failed: 0 }, { outcome: "FRANCHISE_CONTROL_COMPLETED", processed: 26, failed: 0 }, { outcome: "FRANCHISE_CONTROL_BUSY", processed: 1, failed: 0 }])("does not certify a malformed or partly failed execution %j", async data => {
    await expect(createFranchisePerformanceScheduler({ rpc: vi.fn().mockResolvedValue({ data, error: null }) })()).rejects.toThrow("FRANCHISE_CONTROL_SCHEDULER_FAILED");
  });
  it("retries after transport failure", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: null, error: { code: "08006" } }).mockResolvedValueOnce(receipt(1));
    const run = createFranchisePerformanceScheduler({ rpc });
    await expect(run()).rejects.toThrow(); await expect(run()).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it("prevents overlapping cycles without losing the next retry", async () => {
    let release!: (value: ReturnType<typeof receipt>) => void;
    const rpc = vi.fn().mockImplementationOnce(() => new Promise(resolve => { release = resolve; })).mockResolvedValue(receipt());
    const run = createFranchisePerformanceScheduler({ rpc }); const first = run(); const second = run();
    expect(first).toBe(second); expect(rpc).toHaveBeenCalledTimes(1); release(receipt(1)); await Promise.all([first, second]); await run(); expect(rpc).toHaveBeenCalledTimes(2);
  });
});


it("never certifies initial, running, lock-busy or failed control pages as healthy", async () => {
  let release!: (value: unknown) => void;
  const rpc = vi.fn().mockImplementationOnce(() => new Promise(resolve => { release = resolve; }))
    .mockResolvedValueOnce({ data: { outcome: "FRANCHISE_CONTROL_BUSY", processed: 0, failed: 0 }, error: null })
    .mockResolvedValueOnce({ data: { outcome: "FRANCHISE_CONTROL_COMPLETED", processed: 1, failed: 1 }, error: null });
  const run = createFranchisePerformanceScheduler({ rpc });
  expect(run.getState()).toEqual({ control: null });
  const first = run(); expect(run.getState().control?.ok).toBe(false); expect(run.getState().control?.code).toBe("FRANCHISE_CONTROL_RUNNING");
  release(receipt(1)); await first; expect(run.getState().control?.ok).toBe(true);
  await run(); expect(run.getState().control?.ok).toBe(false); expect(run.getState().control?.code).toBe("FRANCHISE_CONTROL_BUSY");
  await expect(run()).rejects.toThrow("FRANCHISE_CONTROL_SCHEDULER_FAILED"); expect(run.getState().control?.ok).toBe(false);
});

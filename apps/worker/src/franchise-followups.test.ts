import { describe, expect, it, vi } from "vitest";
import { createFranchiseFollowupScheduler } from "./franchise-followups";
const jobA = "a0000000-0000-0000-0000-000000000001", jobB = "a0000000-0000-0000-0000-000000000002";
const success = (data: unknown) => ({ data, error: null });
const queued = (job: string) => success({ outcome: "FRANCHISE_FOLLOWUP_QUEUED", job_id: job });
const retry = (job: string) => success({ outcome: "FRANCHISE_FOLLOWUP_RETRY_SCHEDULED", job_id: job, attempt_count: 1 });
function clientForJobs(ids: string[]) {
  return vi.fn().mockResolvedValueOnce(success([])).mockResolvedValueOnce(success(ids.map(id => ({ id }))));
}
describe("durable franchise followups", () => {
  it("reports an empty due queue healthy and exposes initial/running/completed state", async () => {
    const rpc = clientForJobs([]), run = createFranchiseFollowupScheduler({ rpc }, jobA);
    expect(run.getState()).toEqual({ followups: null });
    const pending = run();
    expect(run.getState().followups).toMatchObject({ ok: false, code: "FRANCHISE_FOLLOWUP_RUNNING" });
    await pending;
    expect(run.getState().followups).toMatchObject({ ok: true, processed: 0, failed: 0 });
  });
  it.each(["schedule_franchise_followups", "claim_franchise_followup_jobs"])("rejects a transport failure in %s", async name => {
    const rpc = vi.fn().mockImplementation((rpcName: string) => rpcName === name ? Promise.reject(new Error("sensitive transport detail")) : Promise.resolve(success([])));
    const run = createFranchiseFollowupScheduler({ rpc }, jobA);
    await expect(run()).rejects.toThrow(name.startsWith("schedule") ? "SCHEDULE_FAILED" : "CLAIM_FAILED");
    expect(run.getState().followups?.ok).toBe(false);
    expect(JSON.stringify(run.getState())).not.toContain("sensitive");
  });
  it.each([null, {}, [{ job_id: "not-a-uuid" }], [{ job_id: jobA }, { job_id: jobA }]])("rejects malformed schedule receipt %j", async data => {
    const rpc = vi.fn().mockResolvedValue(success(data)), run = createFranchiseFollowupScheduler({ rpc }, jobA);
    await expect(run()).rejects.toThrow("SCHEDULE_FAILED");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it.each([null, [{ id: "" }], [{ id: jobA }, { id: jobA }], Array.from({ length: 26 }, () => ({ id: jobA }))])("rejects malformed claim receipt %j", async data => {
    const rpc = vi.fn().mockResolvedValueOnce(success([])).mockResolvedValueOnce(success(data)), run = createFranchiseFollowupScheduler({ rpc }, jobA);
    await expect(run()).rejects.toThrow("CLAIM_FAILED");
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it.each([success(null), queued(jobB), { data: null, error: { code: "08006" } }, new Error("network")])("records a failed queue operation but still rejects the cycle", async receipt => {
    const rpc = clientForJobs([jobA]);
    if (receipt instanceof Error) rpc.mockRejectedValueOnce(receipt); else rpc.mockResolvedValueOnce(receipt);
    rpc.mockResolvedValueOnce(retry(jobA));
    const run = createFranchiseFollowupScheduler({ rpc }, jobA);
    await expect(run()).rejects.toThrow("FRANCHISE_FOLLOWUP_PROCESSING_FAILED");
    expect(rpc.mock.calls.at(-1)?.[0]).toBe("fail_franchise_followup_job");
    expect(run.getState().followups).toMatchObject({ ok: false, processed: 0, failed: 1 });
  });
  it.each([success(null), retry(jobB), success({ outcome: "FRANCHISE_FOLLOWUP_RETRY_SCHEDULED", job_id: jobA, attempt_count: 0 }), { data: null, error: {} }, new Error("lost acknowledgement")])("continues independent jobs when failure recording fails", async receipt => {
    const rpc = clientForJobs([jobA, jobB]).mockResolvedValueOnce(success(null));
    if (receipt instanceof Error) rpc.mockRejectedValueOnce(receipt); else rpc.mockResolvedValueOnce(receipt);
    rpc.mockResolvedValueOnce(queued(jobB));
    const run = createFranchiseFollowupScheduler({ rpc }, jobA);
    await expect(run()).rejects.toThrow("FRANCHISE_FOLLOWUP_FAILURE_RECORD_FAILED");
    expect(run.getState().followups).toMatchObject({ ok: false, processed: 1, failed: 1 });
    expect(rpc.mock.calls.at(-1)).toEqual(["complete_franchise_followup_job", { p_job_id: jobB, p_worker_id: jobA }]);
  });
  it("returns the same pending promise and permits retry only after settlement", async () => {
    let finish: (value: unknown) => void = () => {};
    const rpc = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(success([]));
    const run = createFranchiseFollowupScheduler({ rpc }, jobA), first = run(), second = run();
    expect(second).toBe(first);
    expect(rpc).toHaveBeenCalledTimes(1);
    finish(success([]));
    await Promise.all([first, second]);
    await run();
    expect(rpc).toHaveBeenCalledTimes(4);
  });
});

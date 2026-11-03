import { describe, it, expect, vi } from "vitest";
import { createProviderBillingScheduler } from "./provider-billing";

const completed = { data: { outcome: "PROVIDER_BILLING_SCHEDULER_COMPLETED" }, error: null };
const reminded = { data: { processed: 3 }, error: null };

describe("provider billing runtime", () => {
  it("runs only the authorized durable schedulers", async () => {
    const rpc = vi.fn().mockResolvedValueOnce(completed).mockResolvedValueOnce(reminded);
    await createProviderBillingScheduler({ rpc } as never)();
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "run_provider_billing_scheduler_v1", "run_provider_billing_reminders_v1",
    ]);
  });

  it("continues reminders for issued invoices when closing is unavailable and reports the failure", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: null, error: { code: "08006" } }).mockResolvedValueOnce(reminded);
    const run = createProviderBillingScheduler({ rpc } as never);
    expect(run.getState()).toEqual({ closing: null, reminders: null });
    await expect(run()).rejects.toThrow("PROVIDER_BILLING_SCHEDULER_FAILED");
    expect(run.getState()).toMatchObject({ closing: { ok: false }, reminders: { ok: true } });
    expect(rpc).toHaveBeenNthCalledWith(2, "run_provider_billing_reminders_v1", { p_limit: 100 });
  });

  it("continues reminders after a rejected closing request and releases the cycle for retry", async () => {
    const rpc = vi.fn().mockRejectedValueOnce(new Error("transport down"))
      .mockResolvedValueOnce(reminded).mockResolvedValueOnce(completed).mockResolvedValueOnce(reminded);
    const run = createProviderBillingScheduler({ rpc } as never);
    await expect(run()).rejects.toThrow("PROVIDER_BILLING_SCHEDULER_FAILED");
    await expect(run()).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledTimes(4);
  });

  it("reports a reminders outage without undoing the independent closing request", async () => {
    const rpc = vi.fn().mockResolvedValueOnce(completed).mockResolvedValueOnce({ data: null, error: { code: "08006" } });
    await expect(createProviderBillingScheduler({ rpc } as never)()).rejects.toThrow("PROVIDER_BILLING_REMINDERS_FAILED");
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it.each([null, {}, { processed: -1 }, { processed: 1.5 }, { processed: "3" }])(
    "does not report a malformed reminders response as success: %j", async (data) => {
      const rpc = vi.fn().mockResolvedValueOnce(completed).mockResolvedValueOnce({ data, error: null });
      await expect(createProviderBillingScheduler({ rpc } as never)()).rejects.toThrow("PROVIDER_BILLING_REMINDERS_FAILED");
    },
  );

  it("accepts a busy closing page and still processes independent due reminders", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: { outcome: "PROVIDER_BILLING_BUSY" }, error: null }).mockResolvedValueOnce({ data: { processed: 0 }, error: null });
    await expect(createProviderBillingScheduler({ rpc } as never)()).resolves.toBeUndefined();
  });

  it("retains both failed dependency states without hiding either error", async () => {
    const rpc = vi.fn().mockRejectedValue(new Error("transport down"));
    const run = createProviderBillingScheduler({ rpc } as never);
    await expect(run()).rejects.toThrow("PROVIDER_BILLING_CYCLE_FAILED");
    expect(run.getState()).toMatchObject({ closing: { ok: false }, reminders: { ok: false } });
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("never overlaps cycles until both independent pages have finished", async () => {
    let finishClosing: (value: unknown) => void = () => {};
    let finishReminders: (value: unknown) => void = () => {};
    const rpc = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { finishClosing = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { finishReminders = resolve; }))
      .mockResolvedValueOnce(completed).mockResolvedValueOnce(reminded);
    const run = createProviderBillingScheduler({ rpc } as never);
    const first = run();
    await run();
    expect(rpc).toHaveBeenCalledTimes(2);
    finishClosing(completed);
    await Promise.resolve();
    await run();
    expect(rpc).toHaveBeenCalledTimes(2);
    finishReminders(reminded);
    await first;
    await run();
    expect(rpc).toHaveBeenCalledTimes(4);
  });
});

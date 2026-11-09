import { describe, expect, it, vi } from "vitest";
import { createWorkerLoop } from "./worker-loop";

function deferred() {
  let resolve: () => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

describe("worker polling and heartbeat loop", () => {
  it("joins concurrent ticks without attaching one heartbeat callback per tick", async () => {
    const cycle = deferred();
    const runCycle = vi.fn(() => cycle.promise);
    const recordHeartbeat = vi.fn(async () => {});
    const loop = createWorkerLoop({ runCycle, recordHeartbeat });
    const first = loop.run();
    const ticks = Array.from({ length: 100 }, () => loop.run());
    expect(ticks.every(tick => tick === first)).toBe(true);
    expect(runCycle).toHaveBeenCalledOnce();
    expect(recordHeartbeat).not.toHaveBeenCalled();
    cycle.resolve();
    await Promise.all([first, ...ticks]);
    expect(recordHeartbeat).toHaveBeenCalledOnce();

    await loop.run();
    expect(runCycle).toHaveBeenCalledTimes(2);
    expect(recordHeartbeat).toHaveBeenCalledTimes(2);
  });

  it("allows one independent heartbeat while a poll is pending and coalesces concurrent heartbeat ticks", async () => {
    const cycle = deferred();
    const pulse = deferred();
    const recordHeartbeat = vi.fn(() => pulse.promise);
    const loop = createWorkerLoop({ runCycle: () => cycle.promise, recordHeartbeat });
    const running = loop.run();
    const firstPulse = loop.heartbeat();
    const repeatedPulse = loop.heartbeat();
    expect(repeatedPulse).toBe(firstPulse);
    expect(recordHeartbeat).toHaveBeenCalledOnce();
    pulse.resolve();
    await firstPulse;
    // A later tick can publish expired evidence even though the poll is unresolved.
    await loop.heartbeat();
    expect(recordHeartbeat).toHaveBeenCalledTimes(2);
    cycle.resolve();
    await running;
    expect(recordHeartbeat).toHaveBeenCalledTimes(3);
  });

  it("coalesces a periodic heartbeat already in flight with the cycle-completion heartbeat", async () => {
    const cycle = deferred();
    const pulse = deferred();
    const recordHeartbeat = vi.fn(() => pulse.promise);
    const loop = createWorkerLoop({ runCycle: () => cycle.promise, recordHeartbeat });
    const running = loop.run();
    const periodic = loop.heartbeat();
    cycle.resolve();
    await Promise.resolve();
    expect(loop.run()).toBe(running);
    expect(recordHeartbeat).toHaveBeenCalledOnce();
    pulse.resolve();
    await Promise.all([running, periodic]);
    expect(recordHeartbeat).toHaveBeenCalledOnce();
  });

  it("records one failure-state heartbeat and permits recovery after a failed cycle", async () => {
    const cycle = deferred();
    const failure = new Error("cycle failed");
    const runCycle = vi.fn(async () => {}).mockImplementationOnce(() => cycle.promise);
    const recordHeartbeat = vi.fn(async () => {});
    const loop = createWorkerLoop({ runCycle, recordHeartbeat });
    const running = loop.run();
    const rejection = expect(running).rejects.toBe(failure);
    expect(loop.run()).toBe(running);
    cycle.reject(failure);
    await rejection;
    expect(recordHeartbeat).toHaveBeenCalledOnce();
    await loop.run();
    expect(recordHeartbeat).toHaveBeenCalledTimes(2);
  });
});

import { createNonOverlappingTask } from "./poll-lock";

/** Repeated timer ticks join one cycle and install one completion heartbeat. */
export function createWorkerLoop(dependencies: Readonly<{
  runCycle(): Promise<void>;
  recordHeartbeat(): Promise<void>;
}>) {
  const heartbeat = createNonOverlappingTask(dependencies.recordHeartbeat);
  const run = createNonOverlappingTask(async () => {
    try {
      await dependencies.runCycle();
    } finally {
      await heartbeat();
    }
  });
  return Object.freeze({ run, heartbeat });
}

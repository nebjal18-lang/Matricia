import { buildReadinessReport } from "@matricia/observability";
import { createNonOverlappingTask } from "./poll-lock";
import type { FranchisePerformanceState } from "./franchise-performance";
import type { ProviderBillingState } from "./provider-billing";
import type { FranchiseFollowupState } from "./franchise-followups";

type DependencyCycle = Readonly<{
  ok: boolean;
  latencyMs: number;
  code?: "ANTIVIRUS_CHECK_STALE" | "OUTBOX_POLL_STALE";
}>;

/** Match the durable heartbeat lease; an old success cannot attest current readiness. */
export const WORKER_DEPENDENCY_FRESHNESS_MS = 60_000;

export type WorkerCycleState = Readonly<{
  antivirus: DependencyCycle | null;
  outbox: DependencyCycle | null;
}>;

export type WorkerCycle = Readonly<{
  run(): Promise<void>;
  getState(): WorkerCycleState;
}>;

export function createWorkerCycle(dependencies: Readonly<{
  checkAntivirus(): Promise<unknown>;
  pollOutbox(): Promise<Readonly<{ failed: number }>>;
  onFailure(dependency: "antivirus" | "outbox"): void;
  monotonicNow?: () => number;
}>): WorkerCycle {
  const monotonicNow = dependencies.monotonicNow ?? (() => performance.now());
  let state: WorkerCycleState = Object.freeze({ antivirus: null, outbox: null });
  const completedAt: Record<"antivirus" | "outbox", number | null> = { antivirus: null, outbox: null };

  const record = (dependency: "antivirus" | "outbox", ok: boolean, startedAt: number) => {
    const finishedAt = monotonicNow();
    completedAt[dependency] = finishedAt;
    state = Object.freeze({
      ...state,
      [dependency]: Object.freeze({ ok, latencyMs: Math.max(0, finishedAt - startedAt) }),
    });
  };

  const freshDependency = (dependency: "antivirus" | "outbox", now: number): DependencyCycle | null => {
    const result = state[dependency];
    if (!result?.ok) return result;
    const finishedAt = completedAt[dependency];
    if (finishedAt !== null && Number.isFinite(now) && now >= finishedAt && now - finishedAt < WORKER_DEPENDENCY_FRESHNESS_MS) {
      return result;
    }
    return Object.freeze({
      ...result,
      ok: false,
      code: dependency === "antivirus" ? "ANTIVIRUS_CHECK_STALE" : "OUTBOX_POLL_STALE",
    });
  };

  const run = createNonOverlappingTask(async () => {
    const antivirusCycle = async () => {
    const antivirusStarted = monotonicNow();
    try {
      await dependencies.checkAntivirus();
      record("antivirus", true, antivirusStarted);
    } catch {
      record("antivirus", false, antivirusStarted);
      dependencies.onFailure("antivirus");
      // Document handlers remain fail-closed themselves. Independent events must continue.
    }

    };
    const outboxCycle = async () => {
    const outboxStarted = monotonicNow();
    try {
      const result = await dependencies.pollOutbox();
      record("outbox", result.failed === 0, outboxStarted);
    } catch {
      record("outbox", false, outboxStarted);
      dependencies.onFailure("outbox");
    }
    };
    await Promise.all([antivirusCycle(), outboxCycle()]);
  });

  return Object.freeze({
    run,
    getState: () => {
      const now = monotonicNow();
      return Object.freeze({ antivirus: freshDependency("antivirus", now), outbox: freshDependency("outbox", now) });
    },
  });
}

export function buildWorkerReadiness(state: WorkerCycleState, billing?: ProviderBillingState, performanceControl?: FranchisePerformanceState, followup?: FranchiseFollowupState) {
  return buildReadinessReport("matricia-worker", {
    outbox: state.outbox?.ok
      ? { status: "up", latencyMs: state.outbox.latencyMs }
      : { status: "down", latencyMs: state.outbox?.latencyMs ?? 0, code: state.outbox?.code ?? (state.outbox ? "OUTBOX_POLL_FAILED" : "WORKER_NOT_STARTED") },
    ...(billing ? {
      provider_billing: billing.closing?.ok
        ? { status: "up" as const, latencyMs: billing.closing.latencyMs }
        : { status: "down" as const, latencyMs: billing.closing?.latencyMs ?? 0, code: billing.closing ? "PROVIDER_BILLING_SCHEDULER_FAILED" : "PROVIDER_BILLING_NOT_STARTED" },
      provider_billing_reminders: billing.reminders?.ok
        ? { status: "up" as const, latencyMs: billing.reminders.latencyMs }
        : { status: "down" as const, latencyMs: billing.reminders?.latencyMs ?? 0, code: billing.reminders ? "PROVIDER_BILLING_REMINDERS_FAILED" : "PROVIDER_BILLING_NOT_STARTED" },
    } : {}),
    ...(performanceControl ? {
      franchise_control: performanceControl.control?.ok
        ? { status: "up" as const, latencyMs: performanceControl.control.latencyMs }
        : { status: "down" as const, latencyMs: performanceControl.control?.latencyMs ?? 0, code: performanceControl.control?.code ?? "FRANCHISE_CONTROL_NOT_STARTED" },
    } : {}),
    ...(followup ? {
      franchise_followups: followup.followups?.ok
        ? { status: "up" as const, latencyMs: followup.followups.latencyMs }
        : { status: "down" as const, latencyMs: followup.followups?.latencyMs ?? 0, code: followup.followups?.code ?? "FRANCHISE_FOLLOWUP_NOT_STARTED" },
    } : {}),
    antivirus: state.antivirus?.ok
      ? { status: "up", latencyMs: state.antivirus.latencyMs }
      : { status: "down", latencyMs: state.antivirus?.latencyMs ?? 0, code: state.antivirus?.code ?? (state.antivirus ? "ANTIVIRUS_UNAVAILABLE" : "WORKER_NOT_STARTED") },
  });
}


/** A running, busy, absent or failed control page never certifies a healthy worker. */
export function workerHeartbeatHealthy(state: WorkerCycleState, billing: ProviderBillingState, performanceControl: FranchisePerformanceState, followup?: FranchiseFollowupState): boolean {
  return Boolean(state.outbox?.ok && billing.closing?.ok && billing.reminders?.ok && performanceControl.control?.ok && (!followup || followup.followups?.ok));
}

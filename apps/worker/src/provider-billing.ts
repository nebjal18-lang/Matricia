import type { SupabaseClient } from "@supabase/supabase-js";

type PageState = Readonly<{ ok: boolean; latencyMs: number }>;
export type ProviderBillingState = Readonly<{ closing: PageState | null; reminders: PageState | null }>;

/** Independent durable pages: a closing outage must not suppress reminders on issued invoices. */
export function createProviderBillingScheduler(client: Pick<SupabaseClient, "rpc">) {
  let running = false;
  let state: ProviderBillingState = Object.freeze({ closing: null, reminders: null });
  const run = async () => {
    if (running) return;
    running = true;
    const closing = async () => {
      const started = performance.now();
      try {
        const result = await client.rpc("run_provider_billing_scheduler_v1", { p_limit: 100 });
        if (result.error || !["PROVIDER_BILLING_SCHEDULER_COMPLETED", "PROVIDER_BILLING_BUSY"].includes(String(result.data?.outcome))) {
          throw new Error("PROVIDER_BILLING_SCHEDULER_FAILED");
        }
        state = Object.freeze({ ...state, closing: { ok: true, latencyMs: performance.now() - started } });
      } catch {
        state = Object.freeze({ ...state, closing: { ok: false, latencyMs: performance.now() - started } });
        throw new Error("PROVIDER_BILLING_SCHEDULER_FAILED");
      }
    };
    const reminders = async () => {
      const started = performance.now();
      try {
        const result = await client.rpc("run_provider_billing_reminders_v1", { p_limit: 100 });
        if (result.error || !Number.isSafeInteger(result.data?.processed) || result.data.processed < 0) {
          throw new Error("PROVIDER_BILLING_REMINDERS_FAILED");
        }
        state = Object.freeze({ ...state, reminders: { ok: true, latencyMs: performance.now() - started } });
      } catch {
        state = Object.freeze({ ...state, reminders: { ok: false, latencyMs: performance.now() - started } });
        throw new Error("PROVIDER_BILLING_REMINDERS_FAILED");
      }
    };
    try {
      const results = await Promise.allSettled([closing(), reminders()]);
      const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
      if (failures.length === 1) throw failures[0]!.reason;
      if (failures.length > 1) throw new AggregateError(failures.map((result) => result.reason), "PROVIDER_BILLING_CYCLE_FAILED");
    } finally {
      running = false;
    }
  };
  return Object.assign(run, { getState: (): ProviderBillingState => state });
}

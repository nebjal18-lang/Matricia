import type { CommandIdentity } from "./contracts";

export type RecurringCommand = "CLONE_REQUEST" | "CREATE_PLAN" | "TRANSITION_PLAN" | "GENERATE_OCCURRENCES";
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type PersistedIdentity = CommandIdentity & { payload: string; createdAt: number };
const day = 24 * 60 * 60 * 1_000;

export function canonicalRecurringPayload(form: FormData, submitter?: { name: string; value: string } | null): string {
  const entries = [...form.entries()];
  if (submitter?.name) entries.push([submitter.name, submitter.value]);
  return JSON.stringify(entries.filter(([key]) => key !== "idempotencyKey" && key !== "correlationId").map(([key, value]) => [key, typeof value === "string" ? value : value.name]).sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv)));
}

function storageKey(action: RecurringCommand): string { return `matricia:client-recurring:${action}`; }

export function resolveRecurringIdentity(storage: StorageLike, action: RecurringCommand, payload: string, fallback: CommandIdentity, now = Date.now()): CommandIdentity {
  const key = storageKey(action);
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? "null") as Partial<PersistedIdentity> | null;
    if (parsed?.payload === payload && typeof parsed.createdAt === "number" && now - parsed.createdAt <= day && typeof parsed.idempotencyKey === "string" && typeof parsed.correlationId === "string") return { idempotencyKey: parsed.idempotencyKey, correlationId: parsed.correlationId };
  } catch { storage.removeItem(key); }
  storage.setItem(key, JSON.stringify({ ...fallback, payload, createdAt: now } satisfies PersistedIdentity));
  return fallback;
}

export function purgeRecurringIdentity(storage: StorageLike, action: RecurringCommand, idempotencyKey: string): void {
  const key = storageKey(action);
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? "null") as Partial<PersistedIdentity> | null;
    if (parsed?.idempotencyKey === idempotencyKey) storage.removeItem(key);
  } catch { storage.removeItem(key); }
}


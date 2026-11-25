import { describe, expect, it } from "vitest";
import { canonicalRecurringPayload, purgeRecurringIdentity, resolveRecurringIdentity } from "./command-identity";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
const first = { idempotencyKey: "11111111-1111-4111-8111-111111111111", correlationId: "22222222-2222-4222-8222-222222222222" };
const second = { idempotencyKey: "33333333-3333-4333-8333-333333333333", correlationId: "44444444-4444-4444-8444-444444444444" };
describe("recurring command identities", () => {
  it("distinguishes pause from end when the other fields are unchanged", () => {
    const form = new FormData();
    form.set("planId", "A");
    form.set("reason", "Change requested");
    const pause = canonicalRecurringPayload(form, { name: "action", value: "PAUSE" });
    const end = canonicalRecurringPayload(form, { name: "action", value: "END" });
    expect(pause).not.toEqual(end);
    expect(JSON.parse(pause)).toContainEqual(["action", "PAUSE"]);
    const storage = new MemoryStorage();
    resolveRecurringIdentity(storage, "TRANSITION_PLAN", pause, first, 100);
    expect(resolveRecurringIdentity(storage, "TRANSITION_PLAN", end, second, 200)).toEqual(second);
  });
  it("réutilise la même identité pour un retry au payload identique", () => { const storage = new MemoryStorage(); expect(resolveRecurringIdentity(storage, "CREATE_PLAN", "payload", first, 100)).toEqual(first); expect(resolveRecurringIdentity(storage, "CREATE_PLAN", "payload", second, 200)).toEqual(first); });
  it("renouvelle l’identité si le payload change et purge seulement la commande confirmée", () => { const storage = new MemoryStorage(); resolveRecurringIdentity(storage, "CLONE_REQUEST", "A", first, 100); expect(resolveRecurringIdentity(storage, "CLONE_REQUEST", "B", second, 200)).toEqual(second); purgeRecurringIdentity(storage, "CLONE_REQUEST", first.idempotencyKey); expect(resolveRecurringIdentity(storage, "CLONE_REQUEST", "B", first, 300)).toEqual(second); purgeRecurringIdentity(storage, "CLONE_REQUEST", second.idempotencyKey); expect(resolveRecurringIdentity(storage, "CLONE_REQUEST", "B", first, 400)).toEqual(first); });
  it("canonicalise les champs sans inclure les identités techniques", () => { const form = new FormData(); form.set("reason", "Cycle"); form.set("idempotencyKey", first.idempotencyKey); form.set("planId", "A"); expect(canonicalRecurringPayload(form)).toBe('[["planId","A"],["reason","Cycle"]]'); });
});

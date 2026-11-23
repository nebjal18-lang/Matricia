import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }));
vi.mock("@/modules/shared/lib/i18n/locale", () => ({ isLocale: (value: string) => value === "fr" || value === "ar" }));
vi.mock("@/modules/franchise/data/followups/model", async () => await import("@/modules/franchise/data/followups/model"));

import { configurePreference, decidePolicy, proposePolicy, type FollowupActionState } from "./actions";

const userId = "11111111-1111-4111-8111-111111111111";
const franchiseId = "22222222-2222-4222-8222-222222222222";
const prospectId = "44444444-4444-4444-8444-444444444444";
const policyId = "55555555-5555-4555-8555-555555555555";
const key = "33333333-3333-4333-8333-333333333333";
const idle: FollowupActionState = { status: "idle" };

function policyForm() {
  const value = new FormData();
  Object.entries({
    uiLocale: "fr",
    franchiseId,
    reminderDelaysMinutes: "60,120",
    retryDelaysMinutes: "1,5,15",
    maximumAttempts: "3",
    maximumRemindersPer7Days: "3",
    leaseSeconds: "60",
    effectiveFrom: "2026-09-21T08:00:00.000Z",
    effectiveUntil: "",
    changeReason: "Ajustement des délais de relance",
    idempotencyKey: key,
  }).forEach(([name, content]) => value.set(name, content));
  value.append("eligibleStages", "SENT");
  value.append("eligibleStages", "OPENED");
  return value;
}

function preferenceForm() {
  const value = new FormData();
  Object.entries({
    uiLocale: "fr",
    prospectId,
    notificationLocale: "fr",
    timeZone: "Africa/Casablanca",
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
    maximumRemindersPer7Days: "2",
    changeReason: "Consentement de relance mis à jour",
    idempotencyKey: key,
  }).forEach(([name, content]) => value.set(name, content));
  value.set("contactAllowed", "on");
  value.set("emailAllowed", "on");
  return value;
}

function decisionForm() {
  const value = new FormData();
  Object.entries({
    uiLocale: "fr",
    policyVersionId: policyId,
    decision: "APPROVE",
    reason: "Politique conforme au mandat",
    idempotencyKey: key,
  }).forEach(([name, content]) => value.set(name, content));
  return value;
}

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: userId } } });
  mocks.rpc.mockReset().mockResolvedValue({ data: { outcome: "OK" }, error: null });
  mocks.revalidatePath.mockReset();
});

describe("franchise followup actions", () => {
  it("interprets local policy dates in Casablanca instead of the server timezone", async () => {
    const form=policyForm();form.set("effectiveFrom","2024-11-01T09:00");
    expect(await proposePolicy(idle,form)).toEqual({status:"success"});
    expect(mocks.rpc).toHaveBeenCalledWith("propose_franchise_followup_policy",expect.objectContaining({p_effective_from:"2024-11-01T09:00:00+01:00"}));
  });
  it("returns validation for an impossible date without throwing",async()=>{
    const form=policyForm();form.set("effectiveFrom","2026-02-31T09:00");
    expect(await proposePolicy(idle,form)).toEqual({status:"error",reason:"VALIDATION"});expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("propose une politique uniquement via le RPC versionné", async () => {
    expect(await proposePolicy(idle, policyForm())).toEqual({ status: "success" });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("propose_franchise_followup_policy", {
      p_franchise_id: franchiseId,
      p_eligible_stages: ["SENT", "OPENED"],
      p_reminder_delays_minutes: [60, 120],
      p_retry_delays_minutes: [1, 5, 15],
      p_maximum_attempts: 3,
      p_maximum_reminders_per_7_days: 3,
      p_lease_seconds: 60,
      p_effective_from: "2026-09-21T08:00:00.000Z",
      p_effective_until: null,
      p_change_reason: "Ajustement des délais de relance",
      p_idempotency_key: key,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/fr/franchise/relances");
  });

  it("rejette une politique mal formée avant le RPC", async () => {
    const value = policyForm();
    value.set("maximumAttempts", "0");
    expect(await proposePolicy(idle, value)).toEqual({ status: "error", reason: "VALIDATION" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("configure une préférence uniquement via le RPC versionné", async () => {
    expect(await configurePreference(idle, preferenceForm())).toEqual({ status: "success" });
    expect(mocks.rpc).toHaveBeenCalledWith("configure_franchise_followup_preference", {
      p_prospect_id: prospectId,
      p_contact_allowed: true,
      p_email_allowed: true,
      p_locale: "fr",
      p_time_zone: "Africa/Casablanca",
      p_quiet_hours_start: "22:00",
      p_quiet_hours_end: "07:00",
      p_maximum_reminders_per_7_days: 2,
      p_change_reason: "Consentement de relance mis à jour",
      p_idempotency_key: key,
    });
  });

  it("décide une politique uniquement via le RPC versionné", async () => {
    expect(await decidePolicy(idle, decisionForm())).toEqual({ status: "success" });
    expect(mocks.rpc).toHaveBeenCalledWith("decide_franchise_followup_policy", {
      p_policy_version_id: policyId,
      p_decision: "APPROVE",
      p_reason: "Politique conforme au mandat",
      p_idempotency_key: key,
    });
  });

  it("mappe un refus SQL sans fuite de détail", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "FRANCHISE_FOLLOWUP_DENIED" } });
    expect(await proposePolicy(idle, policyForm())).toEqual({ status: "error", reason: "FORBIDDEN" });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "11111111-1111-4111-8111-111111111111" } } }) }, rpc: mocks.rpc, from: mocks.from }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createPolicy, createRule, decideBadge, evaluateBadge, publishChecklist } from "./actions";

const idle = { status: "idle" } as const;
const key = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const chain = (data: unknown) => { const value = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(async () => ({ data, error: null })) }; value.select.mockReturnValue(value); value.eq.mockReturnValue(value); return value; };

describe("authoritative incentives actions", () => {
  beforeEach(() => { mocks.rpc.mockReset().mockResolvedValue({ data: { outcome: "OK" }, error: null }); mocks.from.mockReset(); });

  function rewardForm(bonus = "9007199254740993") {
    const form = new FormData();
    Object.entries({locale:"fr",idempotencyKey:key,code:"EXACT_REWARD",status:"DRAFT",trigger:"REFERRAL.ACTIVE",audience:"REFERRED_CLIENT",bonus,recipientCap:"9007199254740995",globalCap:"9223372036854775807",window:"30",cooldown:"24",validity:"365",eligibility:"{}",approval:"yes",from:"2024-11-01T09:00",reason:"Exact credit rule review"}).forEach(([name,value])=>form.set(name,value));
    return form;
  }
  it("preserves reward credits and caps beyond the JavaScript safe integer range", async()=>{
    expect(await createRule(idle,rewardForm())).toEqual({status:"success"});
    expect(mocks.rpc).toHaveBeenCalledWith("create_reward_rule_version",expect.objectContaining({p_bonus_credits:"9007199254740993",p_per_recipient_cap_credits:"9007199254740995",p_global_cap_credits:"9223372036854775807"}));
  });
  it.each(["9223372036854775808","1.5","1e3","0","-1"])("rejects noncanonical or overflowing reward quantity %s",async value=>{
    expect(await createRule(idle,rewardForm(value))).toMatchObject({status:"error",code:"VALIDATION"});
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("interprets badge policy wall time in Casablanca independently of the server timezone", async () => {
    const form = new FormData();
    Object.entries({ locale: "fr", idempotencyKey: key, organizationId: key, code: "QUALITY_TEST", labelFr: "Qualité vérifiée", labelAr: "جودة موثقة", dimension: "QUALITY", minimum: "8000", evidence: "5", from: "2024-11-01T09:00", until: "2024-11-02T09:00", reason: "Reviewed effective dates" }).forEach(([name, value]) => form.set(name, value));
    expect(await createPolicy(idle, form)).toEqual({ status: "success" });
    expect(mocks.rpc).toHaveBeenCalledWith("create_provider_badge_policy_version", expect.objectContaining({ p_effective_from: "2024-11-01T08:00:00.000Z", p_effective_until: "2024-11-02T08:00:00.000Z" }));
  });

  it("rejects an impossible calendar date instead of silently rolling it into March", async () => {
    const form = new FormData();
    Object.entries({ locale: "fr", idempotencyKey: key, organizationId: key, code: "QUALITY_TEST", labelFr: "Qualité vérifiée", labelAr: "جودة موثقة", dimension: "QUALITY", minimum: "8000", evidence: "5", from: "2024-02-30T09:00", reason: "Reviewed effective dates" }).forEach(([name, value]) => form.set(name, value));
    expect(await createPolicy(idle, form)).toMatchObject({ status: "error", code: "VALIDATION" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([["42501", "FORBIDDEN"], ["23505", "CONFLICT"], ["22023", "VALIDATION"], ["XX000", "UNAVAILABLE"]])("classifies %s without leaking transport details", async (sqlstate, code) => {
    mocks.rpc.mockResolvedValue({ error: { code: sqlstate, message: "private database detail", details: "private" } });
    const form = new FormData();
    Object.entries({ locale: "fr", idempotencyKey: key, evaluationId: key, action: "PUBLISHED", rationale: "Evidence verified by reviewer" }).forEach(([name, value]) => form.set(name, value));
    const result = await decideBadge(idle, form);
    expect(result).toEqual({ status: "error", code, correlationId: expect.any(String) });
    expect(mocks.rpc).toHaveBeenCalledWith("decide_provider_badge", expect.objectContaining({ p_correlation_id: result.status === "error" ? result.correlationId : undefined, p_idempotency_key: key }));
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("rejects invalid fields without a mutation and translates thrown transport failures", async () => {
    expect(await decideBadge(idle, new FormData())).toMatchObject({ status: "error", code: "VALIDATION" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.from.mockImplementation(() => { throw new Error("private network detail"); });
    const form = new FormData();
    Object.entries({ locale: "fr", idempotencyKey: key, policyId: key, reputationId: key }).forEach(([name, value]) => form.set(name, value));
    expect(await evaluateBadge(idle, form)).toEqual({ status: "error", code: "UNAVAILABLE", correlationId: expect.any(String) });
  });

  it("derives provider and service from the selected reputation snapshot", async () => {
    mocks.from.mockReturnValue(chain({ provider_organization_id: "22222222-2222-4222-8222-222222222222", service_id: "33333333-3333-4333-8333-333333333333" }));
    const form = new FormData(); form.set("locale", "fr"); form.set("idempotencyKey", key); form.set("policyId", "44444444-4444-4444-8444-444444444444"); form.set("reputationId", "55555555-5555-4555-8555-555555555555");
    await expect(evaluateBadge(idle, form)).resolves.toEqual({ status: "success" });
    expect(mocks.rpc).toHaveBeenCalledWith("evaluate_provider_badge", expect.objectContaining({ p_provider_organization_id: "22222222-2222-4222-8222-222222222222", p_service_id: "33333333-3333-4333-8333-333333333333", p_reputation_snapshot_id: "55555555-5555-4555-8555-555555555555" }));
  });

  it("derives the audit organization from the service library steward", async () => {
    mocks.from.mockReturnValue(chain({ catalog_services: { catalog_libraries: { steward_organization_id: "66666666-6666-4666-8666-666666666666" } } }));
    const form = new FormData(); form.set("locale", "ar"); form.set("idempotencyKey", key); form.set("serviceVersionId", "77777777-7777-4777-8777-777777777777"); form.set("reason", "Publication autoritative"); form.set("items", JSON.stringify([{ key: "VERIFY", label_fr: "Vérifier", label_ar: "تحقق", instructions_fr: "Comparer la preuve.", instructions_ar: "قارن الدليل.", proof_required: true, proof_types: ["DOCUMENT"] }]));
    await expect(publishChecklist(idle, form)).resolves.toEqual({ status: "success" });
    expect(mocks.rpc).toHaveBeenCalledWith("publish_service_checklist_template", expect.objectContaining({ p_audit_organization_id: "66666666-6666-4666-8666-666666666666", p_service_version_id: "77777777-7777-4777-8777-777777777777" }));
  });
});

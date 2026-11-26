import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "11111111-1111-4111-8111-111111111111" } } }) },
    ...mocks,
  }),
}));
import { createServerSolutionInsightsRepository } from "./server-repository";

const id = "11111111-1111-4111-8111-111111111111";
const exactAmount = "9007199254740993";

describe("solution monetary transport", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    mocks.from.mockImplementation((table: string) => {
      let fields = "";
      const result = () => {
        const data = table === "organization_memberships" ? [{ id, organization_id: id }]
          : table === "organization_member_roles" ? [{ membership_id: id, role_code: "CLIENT_BUYER", revoked_at: null }]
          : table === "diagnostic_solution_sets" ? [{ id, organization_id: id, anomaly_id: id, version: 1, rationale_fr: "Choix", rationale_ar: "اختيار", created_at: "2026-11-23T00:00:00Z" }]
          : table === "diagnostic_solution_options" ? [{ id, solution_set_id: id, level: "ESSENTIAL", expected_score_bps: 7500, estimated_amount_minor: fields.includes("estimated_amount_minor::text") ? exactAmount : Number(exactAmount), currency: "MAD", benefits: [], tradeoffs: [], explanation: {} }]
          : [];
        return Promise.resolve({ data, error: null });
      };
      const query = {
        select(value: string) { fields = value; return query; },
        eq() { return query; }, in() { return query; }, order() { return query; }, limit() { return query; },
        then: (...args: Parameters<ReturnType<typeof result>["then"]>) => result().then(...args),
      };
      return query;
    });
  });

  it("preserves every minor unit beyond JavaScript's safe integer range", async () => {
    const result = await (await createServerSolutionInsightsRepository(id)).list();
    expect(result.status).toBe("success");
    if (result.status === "success") expect(result.value.sets[0]?.options[0]?.estimatedAmountMinor).toBe(exactAmount);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), range: vi.fn(), filter: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ from: mocks.from }) }));
import { loadBillingWorkspace } from "./workspace";

describe("bounded billing projection", () => {
  beforeEach(() => {
    mocks.from.mockReset(); mocks.range.mockReset(); mocks.filter.mockReset();
    mocks.from.mockImplementation((table: string) => {
      const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), in: vi.fn(), range: (from: number, to: number) => mocks.range(table, from, to) };
      for (const method of [query.select, query.eq, query.order, query.in]) method.mockReturnValue(query);
      query.eq.mockImplementation((field, value) => { mocks.filter(table, field, value); return query; });
      query.in.mockImplementation((field, value) => { mocks.filter(table, field, value); return query; });
      return query;
    });
  });
  it("does not scan unrelated child histories when no parents are accessible", async () => {
    mocks.range.mockResolvedValue({ data: [], error: null });
    const result = await loadBillingWorkspace("org");
    expect(result).toMatchObject({ declarations: [], periods: [], decisions: [], lines: [], disputes: [], resolutions: [] });
    expect(mocks.from.mock.calls.map(([name]) => name)).toEqual(["provider_financial_declarations_v1", "provider_billing_periods_v1", "provider_billing_exceptions_v1"]);
  });
  it("does not return an empty or partial workspace on a read failure", async () => {
    mocks.range.mockResolvedValue({ data: null, error: { code: "42501" } });
    expect(await loadBillingWorkspace("org")).toBeNull();
  });
  it("retains organization predicates and scopes child queries to persisted parent IDs", async () => {
    const org = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", declarationId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", periodId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    mocks.range.mockImplementation(async (table: string) => ({ data:
      table === "provider_financial_declarations_v1" ? [{ id: declarationId, kind: "PAYABLE", provider_organization_id: org, client_organization_id: null, payload: {}, declared_at: "2026-11-19", declared_by: org, upload_id: org }] :
      table === "provider_billing_periods_v1" ? [{ id: periodId, period_end: "2026-11-30", dispute_until: "2026-12-05", currency: "MAD", provider_organization_id: org }] : [], error: null }));
    expect(await loadBillingWorkspace(org)).not.toBeNull();
    for (const table of ["provider_financial_declarations_v1", "provider_billing_periods_v1", "provider_billing_exceptions_v1"]) expect(mocks.filter).toHaveBeenCalledWith(table, "provider_organization_id", org);
    expect(mocks.filter).toHaveBeenCalledWith("provider_financial_declaration_decisions_v1", "declaration_id", [declarationId]);
    expect(mocks.filter).toHaveBeenCalledWith("provider_pre_statement_lines_v1", "period_id", [periodId]);
    expect(mocks.from).not.toHaveBeenCalledWith("provider_billing_dispute_resolutions_v1");
  });
  it("bounds growing parent histories and rejects incomplete financial projections", async () => {
    mocks.range.mockImplementation(async (_table, from: number, to: number) => ({ data: Array.from({ length: to - from + 1 }, (_, i) => ({ id: from + i })), error: null }));
    expect(await loadBillingWorkspace("org")).toBeNull();
    expect(mocks.range).toHaveBeenCalledTimes(33);
  });
});

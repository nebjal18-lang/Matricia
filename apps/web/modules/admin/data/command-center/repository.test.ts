import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), rpc: vi.fn(), selects: [] as string[] }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser }, from: mocks.from, rpc: mocks.rpc }),
}));

import { loadAdminCommandCenter } from "./repository";

const userId = "11111111-1111-4111-8111-111111111111";
const workId = "22222222-2222-4222-8222-222222222222";
const queueId = "33333333-3333-4333-8333-333333333333";
const actionId = "44444444-4444-4444-8444-444444444444";

function thenable(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const next = () => chain;
  for (const method of ["select", "eq", "is", "in", "order", "limit", "range"]) {
    chain[method] = method === "select"
      ? (columns: string) => {
          mocks.selects.push(columns);
          return chain;
        }
      : next;
  }
  chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

describe("loadAdminCommandCenter", () => {
  it("keeps Auth503 as a technical read failure", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } });
    expect(await loadAdminCommandCenter()).toEqual({ status: "error", reason: "QUERY_FAILED" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    mocks.selects.length = 0;
    mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: userId } } });
    mocks.rpc.mockReset().mockResolvedValue({ data: [{ requirement_satisfied: true, matched_role_codes: ["MATRICIA_ADMIN"] }], error: null });
    mocks.from.mockReset().mockImplementation((table: string) => {
      if (table === "admin_work_items") return thenable({
        data: [{
          id: workId, queue_version_id: queueId, organization_id: null, source_kind: "EXCEPTION", resource_type: "provider_profile",
          resource_id: "abc", title_fr: "Preuve manquante", title_ar: "دليل ناقص", priority: "HIGH", status: "OPEN",
          due_at: "2026-09-19T00:00:00Z", assigned_to: null, row_version: 1,
        }],
        error: null,
      });
      if (table === "admin_operational_action_requests") return thenable({
        data: [{
          id: actionId, work_item_id: workId, organization_id: null, action_type: "ASSIGN_CASE", target_environment: "STAGING",
          resource_type: "provider_profile", resource_id: "abc", reason: "Revue conformité documentée", approvals_required: 1,
          status: "PENDING_APPROVAL", requested_by: "55555555-5555-4555-8555-555555555555", requested_at: "2026-09-18T00:00:00Z", row_version: 1,
        }],
        error: null,
      });
      if (table === "admin_queue_versions") return thenable({
        data: [{ id: queueId, queue_key: "PROVIDER_QUALIFICATION", label_fr: "Qualification", label_ar: "التأهيل" }],
        error: null,
      });
      return thenable({ data: [], error: null });
    });
  });

  it("joins queue labels in application code instead of an inner embed", async () => {
    const result = await loadAdminCommandCenter();
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.dashboard.workItems).toEqual([expect.objectContaining({ id: workId, queueKey: "PROVIDER_QUALIFICATION", canClaim: true })]);
    expect(result.dashboard.actions[0]?.canDecide).toBe(true);
    expect(mocks.selects.some((columns) => columns.includes("admin_queue_versions!inner"))).toBe(false);
  });

  it("fails closed on a work-item query error", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "admin_work_items") return thenable({ data: null, error: { code: "PGRST200" } });
      return thenable({ data: [], error: null });
    });
    await expect(loadAdminCommandCenter()).resolves.toEqual({ status: "error", reason: "QUERY_FAILED" });
  });

  it("demande le second facteur avant de lire les files", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ requirement_satisfied: false, matched_role_codes: ["MATRICIA_ADMIN"] }], error: null });
    await expect(loadAdminCommandCenter()).resolves.toEqual({ status: "error", reason: "MFA_REQUIRED" });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("refuse un compte sans rôle plateforme", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ requirement_satisfied: true, matched_role_codes: [] }], error: null });
    await expect(loadAdminCommandCenter()).resolves.toEqual({ status: "error", reason: "FORBIDDEN" });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  from: vi.fn(),
  selects: [] as string[],
  client: { from: (...args: unknown[]) => mocks.from(...args) },
}));

vi.mock("@/modules/shared/lib/account-security/platform-access", () => ({
  loadMyPlatformAccess: () => mocks.access(),
}));

import { loadAdminCommandCenter } from "./repository";

const userId = "11111111-1111-4111-8111-111111111111";
const workId = "22222222-2222-4222-8222-222222222222";
const queueId = "33333333-3333-4333-8333-333333333333";
const actionId = "44444444-4444-4444-8444-444444444444";

function okAccess(roles: string[] = ["MATRICIA_ADMIN"], requirementSatisfied = true) {
  return {
    status: "ok" as const,
    client: mocks.client,
    userId,
    email: "admin@example.invalid",
    roles: new Set(roles),
    requirementSatisfied,
  };
}

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
    mocks.access.mockResolvedValue({ status: "error", reason: "QUERY_FAILED" });
    expect(await loadAdminCommandCenter()).toEqual({ status: "error", reason: "QUERY_FAILED" });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    mocks.selects.length = 0;
    mocks.access.mockReset().mockResolvedValue(okAccess());
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
    mocks.access.mockResolvedValue(okAccess(["MATRICIA_ADMIN"], false));
    await expect(loadAdminCommandCenter()).resolves.toEqual({ status: "error", reason: "MFA_REQUIRED" });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("refuse un compte sans rôle plateforme", async () => {
    mocks.access.mockResolvedValue(okAccess([]));
    await expect(loadAdminCommandCenter()).resolves.toEqual({ status: "error", reason: "FORBIDDEN" });
  });
});

describe("approval pagination recovery", () => {
  beforeEach(() => {
    mocks.access.mockReset().mockResolvedValue(okAccess());
  });

  it("recovers an expired approval page without hiding the work queue or changing its status filter", async () => {
    let actionCalls = 0;
    mocks.from.mockImplementation((table: string) => {
      if (table === "admin_work_items") return thenable({
        data: [{
          id: workId, queue_version_id: queueId, organization_id: null, source_kind: "EXCEPTION", resource_type: "provider_profile",
          resource_id: "abc", title_fr: "Preuve manquante", title_ar: "دليل ناقص", priority: "HIGH", status: "OPEN",
          due_at: "2026-09-19T00:00:00Z", assigned_to: null, row_version: 1,
        }],
        error: null,
      });
      if (table === "admin_operational_action_requests") {
        actionCalls += 1;
        if (actionCalls === 1) return thenable({ data: null, error: { code: "PGRST103" } });
        return thenable({
          data: [{
            id: actionId, work_item_id: workId, organization_id: null, action_type: "ASSIGN_CASE", target_environment: "STAGING",
            resource_type: "provider_profile", resource_id: "abc", reason: "Revue conformité documentée", approvals_required: 1,
            status: "PENDING_APPROVAL", requested_by: "55555555-5555-4555-8555-555555555555", requested_at: "2026-09-18T00:00:00Z", row_version: 1,
          }],
          error: null,
        });
      }
      if (table === "admin_queue_versions") return thenable({
        data: [{ id: queueId, queue_key: "PROVIDER_QUALIFICATION", label_fr: "Qualification", label_ar: "التأهيل" }],
        error: null,
      });
      return thenable({ data: [], error: null });
    });
    const result = await loadAdminCommandCenter(2, "PENDING_APPROVAL");
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.dashboard.actionPage).toBe(1);
    expect(result.dashboard.actionStatus).toBe("PENDING_APPROVAL");
    expect(result.dashboard.workItems).toHaveLength(1);
  });

  it("keeps a non-recoverable action query failure closed", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "admin_work_items") return thenable({ data: [], error: null });
      if (table === "admin_operational_action_requests") return thenable({ data: null, error: { code: "42501" } });
      return thenable({ data: [], error: null });
    });
    expect(await loadAdminCommandCenter(2)).toEqual({ status: "error", reason: "QUERY_FAILED" });
  });
});

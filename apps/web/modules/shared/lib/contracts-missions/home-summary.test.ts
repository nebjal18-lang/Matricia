import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  client: vi.fn(),
}));

vi.mock("@/modules/shared/lib/supabase/server", () => ({
  getSupabaseServerClient: mocks.client,
  getServerAuthUser: () => mocks.getUser(),
}));

import { loadClientHomeMissionSummary } from "./home-summary";

function chain(result: { data: unknown; error: unknown }) {
  const api: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "in", "order", "limit"]) {
    api[method] = vi.fn(() => api);
  }
  api.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve);
  return api;
}

const orgId = "22222222-2222-4222-8222-222222222222";
const userId = "11111111-1111-4111-8111-111111111111";

describe("loadClientHomeMissionSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.client.mockResolvedValue({ from: mocks.from });
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table === "organization_memberships") {
        return chain({
          data: [{
            organization_id: orgId,
            organizations: { display_name: "Client A" },
            organization_member_roles: [{ role_code: "CLIENT_OWNER", revoked_at: null }],
          }],
          error: null,
        });
      }
      if (table === "missions") {
        return chain({
          data: [{
            id: "33333333-3333-4333-8333-333333333333",
            status: "IN_PROGRESS",
            mission_milestones: [{ title_fr: "Jalon", title_ar: "معلم", status: "PENDING", due_at: "2026-11-20T00:00:00Z" }],
            deliverables: [{ status: "SUBMITTED" }],
          }],
          error: null,
        });
      }
      return chain({
        data: [{ id: "44444444-4444-4444-8444-444444444444", status: "ACTIVE", contract_signatures: [{ id: "55555555-5555-4555-8555-555555555555" }] }],
        error: null,
      });
    });
  });

  it("loads a compact mission and contract slice for the selected organization", async () => {
    const result = await loadClientHomeMissionSummary("fr", orgId);
    expect(result).toEqual({
      status: "success",
      organizationName: "Client A",
      missions: [{
        status: "IN_PROGRESS",
        milestones: [{ title: "Jalon", status: "PENDING", dueAt: "2026-11-20T00:00:00Z" }],
        deliverables: [{ status: "SUBMITTED" }],
      }],
      contracts: [{ status: "ACTIVE", signatureCount: 1 }],
    });
  });
});

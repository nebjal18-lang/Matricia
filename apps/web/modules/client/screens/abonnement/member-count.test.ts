import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RolesQueryResult } from "@/app/[locale]/organisation/roles/actions";
const mock = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ from: mock.from }) }));
import { subscriptionMemberCount } from "./member-count";
const result: RolesQueryResult = {
  status: "success", requests: [], memberships: [],
  organizations: [{ id: "A", displayName: "A", currentRoles: ["CLIENT_OWNER"] }, { id: "B", displayName: "B", currentRoles: ["CLIENT_BUYER"] }],
};
beforeEach(() => {
  vi.clearAllMocks();
  mock.from.mockReturnValue({ select: mock.select });
  mock.select.mockReturnValue({ eq: mock.eq });
  mock.eq.mockReturnValueOnce({ eq: mock.eq }).mockResolvedValueOnce({ count: 5001, error: null });
});
describe("subscription team summary", () => {
  it("counts all active members of the selected organization on the server, beyond a response page", async () => {
    expect(await subscriptionMemberCount(result, "A")).toBe(5001);
    expect(mock.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(mock.eq.mock.calls).toEqual([["organization_id", "A"], ["status", "ACTIVE"]]);
  });
  it("does not claim a complete team total from a restricted member projection", async () => {
    expect(await subscriptionMemberCount(result, "B")).toBeNull();
    expect(mock.from).not.toHaveBeenCalled();
  });
  it("keeps a technical error distinct from a zero team total", async () => {
    expect(await subscriptionMemberCount({ status: "error", reason: "UNAVAILABLE" }, "A")).toBeNull();
    expect(mock.from).not.toHaveBeenCalled();
  });
  it("does not display zero when the scoped count fails", async () => {
    mock.eq.mockReset().mockReturnValueOnce({ eq: mock.eq }).mockResolvedValueOnce({ count: null, error: { code: "08006" } });
    expect(await subscriptionMemberCount(result, "A")).toBeNull();
  });
});

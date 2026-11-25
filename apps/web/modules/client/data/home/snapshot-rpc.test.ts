import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), client: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({
  getSupabaseServerClient: () => mocks.client(),
  getServerAuthUser: () => mocks.getUser(),
}));

import { loadClientHomeSnapshotRpc } from "./snapshot-rpc";

const org = "22222222-2222-4222-8222-222222222222";

describe("loadClientHomeSnapshotRpc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.client.mockResolvedValue({ rpc: mocks.rpc });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "11111111-1111-4111-8111-111111111111" } }, error: null });
  });

  it("maps a successful aggregate payload", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        organization_name: "Client A",
        open_requests: 2,
        quotes_to_review: 1,
        active_missions: 0,
        pending_decisions: 0,
        upcoming_due: 0,
        featured: null,
        next_milestone: null,
      },
      error: null,
    });
    await expect(loadClientHomeSnapshotRpc(org, "fr")).resolves.toMatchObject({
      status: "success",
      value: { organization_name: "Client A", open_requests: 2 },
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_client_home_snapshot_v1", { p_organization_id: org, p_locale: "fr" });
  });

  it("reports a missing RPC distinctly so the home can fall back", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    await expect(loadClientHomeSnapshotRpc(org, "ar")).resolves.toEqual({ status: "error", reason: "MISSING_RPC" });
  });
});

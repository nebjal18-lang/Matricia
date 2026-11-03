import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }));
import { acceptFranchiseNetworkInvitation, openFranchiseNetworkInvitation } from "./recipient-actions";
import { networkInvitationTokenHash } from "@/modules/franchise/data/network/invitation-token";
const id = "11111111-1111-4111-8111-111111111111", org = "22222222-2222-4222-8222-222222222222", key = "33333333-3333-4333-8333-333333333333", token = "a".repeat(43);
const idle = { status: "idle" } as const;
function form() { const f = new FormData(); for (const [name, value] of Object.entries({ locale: "ar", invitationId: id, token, organizationId: org, idempotencyKey: key, confirmed: "yes" })) f.set(name, value); return f; }
beforeEach(() => { mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id } }, error: null }); mocks.rpc.mockReset(); });

describe("recipient network invitation commands", () => {
  it("sends only a hash to the explicit scoped open command", async () => {
    mocks.rpc.mockResolvedValue({ data: { invitation_id: id, prospect_type: "CLIENT", status: "OPENED", organizations: [{ id: org, name: "Client TEST" }], expires_at: "2026-12-03", delivery_mode: "NON_CONTRACTUAL_DEMO" }, error: null });
    expect((await openFranchiseNetworkInvitation(idle, form())).status).toBe("opened");
    expect(mocks.rpc).toHaveBeenCalledWith("open_franchise_network_invitation_v1", { p_invitation_id: id, p_token_hash: networkInvitationTokenHash(token) });
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain(token);
  });
  it("registers only the confirmed organization and preserves its type", async () => {
    mocks.rpc.mockResolvedValue({ data: { outcome: "FRANCHISE_NETWORK_REFERRAL_REGISTERED", invitation_id: id, organization_id: org, prospect_type: "PROVIDER" }, error: null });
    await expect(acceptFranchiseNetworkInvitation(idle, form())).resolves.toEqual({ status: "success", organizationId: org, prospectType: "PROVIDER" });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("accept_franchise_network_invitation_v1", { p_invitation_id: id, p_token_hash: networkInvitationTokenHash(token), p_target_organization_id: org, p_idempotency_key: key });
  });
  it("does not report success for a mismatched result or missing confirmation", async () => {
    mocks.rpc.mockResolvedValue({ data: { outcome: "FRANCHISE_NETWORK_REFERRAL_REGISTERED", invitation_id: id, organization_id: key, prospect_type: "CLIENT" }, error: null });
    await expect(acceptFranchiseNetworkInvitation(idle, form())).resolves.toEqual({ status: "error", reason: "FAILED" });
    const f = form(); f.delete("confirmed");
    await expect(acceptFranchiseNetworkInvitation(idle, f)).resolves.toEqual({ status: "error", reason: "VALIDATION" });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it.each([["42501", "FRANCHISE_NETWORK_MFA_REQUIRED", "MFA_REQUIRED"], ["42501", "FRANCHISE_NETWORK_RECIPIENT_DENIED", "FORBIDDEN"], ["55000", "FRANCHISE_NETWORK_INVITATION_INACTIVE", "INACTIVE"], ["23505", "FRANCHISE_NETWORK_ORIGIN_ALREADY_RECORDED", "CONFLICT"]])("keeps %s/%s distinct", async (code, message, reason) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message } });
    await expect(acceptFranchiseNetworkInvitation(idle, form())).resolves.toEqual({ status: "error", reason });
  });
  it("does not turn Auth transport failure into a logout", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } });
    await expect(openFranchiseNetworkInvitation(idle, form())).resolves.toEqual({ status: "error", reason: "FAILED" });
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
    await expect(openFranchiseNetworkInvitation(idle, form())).resolves.toEqual({ status: "error", reason: "UNAUTHENTICATED" }); expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

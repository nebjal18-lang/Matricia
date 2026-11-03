import { beforeEach, describe, expect, it, vi } from "vitest";
import { networkInvitationToken, networkInvitationTokenHash } from "./invitation-token";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), deliver: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/modules/shared/lib/notification-delivery/adapter", () => ({ deliverNotification: mocks.deliver }));
import { consumeFranchiseNetworkInvitation } from "./invitation-consumer";

const id = "11111111-1111-4111-8111-111111111111";
const key = "local-test-key-with-at-least-32-bytes";
function ready() { return { outcome: "READY", invitation_id: id, locale: "ar", contact_email: "recipient@example.invalid", operator_name: "Opérateur TEST", prospect_type: "PROVIDER", expires_at: "2026-12-03T00:00:00Z", token_hash: networkInvitationTokenHash(networkInvitationToken(id, key)) }; }

beforeEach(() => {
  vi.stubEnv("APP_ENCRYPTION_KEY", key); vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://matricia.example.invalid");
  mocks.rpc.mockReset().mockImplementation(async (name: string) => ({ data: name.startsWith("load_") ? ready() : { outcome: "FRANCHISE_NETWORK_INVITATION_SENT", invitation_id: id }, error: null }));
  mocks.deliver.mockReset().mockResolvedValue({ outcome: "SENT", providerMessageId: "test-provider-accepted-1", evidence: { adapter: "EMAIL_RESEND" } });
});

describe("network invitation outbox consumer", () => {
  it("loads the canonical persisted event, sends the bounded Arabic link and confirms acceptance", async () => {
    await expect(consumeFranchiseNetworkInvitation("42", id)).resolves.toEqual({ ok: true, code: "FRANCHISE_NETWORK_INVITATION_SENT" });
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "load_franchise_network_invitation_delivery_v1", { p_outbox_id: "42", p_invitation_id: id });
    const job = mocks.deliver.mock.calls[0]![0];
    expect(job.recipientEmail).toBe("recipient@example.invalid"); expect(job.locale).toBe("ar-MA");
    const target = new URL(job.ctaPath, "https://matricia.example.invalid");
    expect(target.pathname).toBe("/ar/rejoindre-reseau"); expect(target.searchParams.get("token")).toBe(networkInvitationToken(id, key));
    expect(job.providerIdempotencyKey).toBe(`franchise-network-invitation:${id}`);
    expect(mocks.rpc).toHaveBeenLastCalledWith("complete_franchise_network_invitation_delivery_v1", expect.objectContaining({ p_provider_message_id: "test-provider-accepted-1", p_delivery_mode: "EXTERNAL" }));
  });
  it.each(["ALREADY_SENT", "CANCELLED"])("acknowledges a verified %s without sending again", async outcome => {
    mocks.rpc.mockResolvedValue({ data: { outcome, invitation_id: id }, error: null });
    await expect(consumeFranchiseNetworkInvitation("42", id)).resolves.toEqual({ ok: true, code: outcome }); expect(mocks.deliver).not.toHaveBeenCalled();
  });
  it("leaves a provider failure unacknowledged and never claims SENT", async () => {
    mocks.deliver.mockResolvedValue({ outcome: "RETRYABLE_FAILURE", errorCode: "EMAIL_PROVIDER_503", evidence: {} });
    await expect(consumeFranchiseNetworkInvitation("42", id)).resolves.toEqual({ ok: false, code: "EMAIL_PROVIDER_503" }); expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("reuses the exact token and provider key if persistence fails after external acceptance", async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name.startsWith("load_") ? ready() : null, error: name.startsWith("load_") ? null : { code: "503" } }));
    expect((await consumeFranchiseNetworkInvitation("42", id)).ok).toBe(false);
    expect((await consumeFranchiseNetworkInvitation("42", id)).ok).toBe(false);
    expect(mocks.deliver.mock.calls[0]![0]).toEqual(mocks.deliver.mock.calls[1]![0]);
  });
  it("keeps development simulation explicitly separate from external email", async () => {
    mocks.deliver.mockResolvedValue({ outcome: "DELIVERED", providerMessageId: "demo-test-1", evidence: { adapter: "EMAIL_DEMO" } });
    expect((await consumeFranchiseNetworkInvitation("42", id)).ok).toBe(true);
    expect(mocks.rpc).toHaveBeenLastCalledWith("complete_franchise_network_invitation_delivery_v1", expect.objectContaining({ p_delivery_mode: "NON_CONTRACTUAL_DEMO" }));
  });
  it("refuses changed deployment key and missing/unsafe canonical origin before sending", async () => {
    vi.stubEnv("APP_ENCRYPTION_KEY", key + "changed");
    expect((await consumeFranchiseNetworkInvitation("42", id)).code).toBe("FRANCHISE_NETWORK_KEY_MISMATCH");
    vi.stubEnv("APP_ENCRYPTION_KEY", key); vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://unsafe.invalid");
    expect((await consumeFranchiseNetworkInvitation("42", id)).code).toBe("FRANCHISE_NETWORK_ORIGIN_INVALID");
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
  it("does not trust a valid-shaped payload for a different persisted invitation", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...ready(), invitation_id: "22222222-2222-4222-8222-222222222222" }, error: null });
    expect((await consumeFranchiseNetworkInvitation("42", id)).ok).toBe(false); expect(mocks.deliver).not.toHaveBeenCalled();
  });
});

import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), verify: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("./native-reconciliation", () => ({ verifyNativeSocialPublication: mocks.verify }));
import { consumeSocialNativeVerification } from "./native-verification-consumer";
const id = "11111111-1111-4111-8111-111111111111";
const work = { outcome: "SOCIAL_VERIFICATION_AUTHORIZED", publication_id: "urn:li:share:123456", account_reference: "urn:li:organization:123", claimed_at: "2026-10-31T12:00:00Z", lease_expires_at: "2026-10-31T12:05:00Z", job: { outcome: "JOB_CLAIMED", job_id: id, lease_token: "22222222-2222-4222-8222-222222222222", provider_idempotency_key: "stable-original-key", attempt: 1, provider: "LINKEDIN", channel: "LINKEDIN", credential_reference: "env://TEST_LINKEDIN", content: { language: "FR", hook: "Conseil", body: "Corps", cta: "Découvrir", hashtags: [], landing_url: "https://app.example/service", media_url: null } } };
beforeEach(() => vi.resetAllMocks());
it("requires durable authorization before any native lookup", async () => {
 mocks.rpc.mockResolvedValue({ error: { code: "42501" } }); expect((await consumeSocialNativeVerification(id)).ok).toBe(false); expect(mocks.verify).not.toHaveBeenCalled();
});
it("does not persist an unverified post or infer requeue", async () => {
 mocks.rpc.mockResolvedValue({ data: work, error: null }); mocks.verify.mockRejectedValue(new Error("404"));
 expect((await consumeSocialNativeVerification(id)).ok).toBe(false); expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
it("records native evidence and original provider date only after positive verification", async () => {
 mocks.rpc.mockResolvedValueOnce({ data: work, error: null }).mockResolvedValueOnce({ data: { outcome: "SOCIAL_NATIVE_VERIFIED" }, error: null });
 mocks.verify.mockResolvedValue({ responseHash: "a".repeat(64), createdAt: "2026-10-31T12:01:00Z" });
 expect((await consumeSocialNativeVerification(id)).ok).toBe(true); expect(mocks.rpc).toHaveBeenLastCalledWith("complete_social_native_verification_v1", { p_request_id: id, p_response_hash: "a".repeat(64), p_native_created_at: "2026-10-31T12:01:00Z" });
});
it("does not acknowledge an unknown SQL completion result", async () => {
 mocks.rpc.mockResolvedValueOnce({ data: work, error: null }).mockResolvedValueOnce({ data: { outcome: "UNKNOWN" }, error: null }); mocks.verify.mockResolvedValue({ responseHash: "a".repeat(64), createdAt: "2026-10-31T12:01:00Z" });
 expect((await consumeSocialNativeVerification(id)).ok).toBe(false);
});

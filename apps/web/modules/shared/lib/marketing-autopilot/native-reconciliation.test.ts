import { expect, it, vi } from "vitest";
import { verifyNativeSocialPublication, type SocialVerificationWork } from "./native-reconciliation";
import { publicationMessage } from "./publisher";
const work: SocialVerificationWork = { publicationId: "urn:li:share:123456", accountReference: "urn:li:organization:123", claimedAt: "2026-10-31T12:00:00Z", leaseExpiresAt: "2026-10-31T12:05:00Z", job: { outcome: "JOB_CLAIMED", job_id: "11111111-1111-4111-8111-111111111111", lease_token: "22222222-2222-4222-8222-222222222222", provider_idempotency_key: "stable-job-key", attempt: 1, provider: "LINKEDIN", channel: "LINKEDIN", credential_reference: "env://TEST_LINKEDIN", content: { language: "FR", hook: "Conseil", body: "Corps", cta: "Découvrir", hashtags: ["#Matricia"], landing_url: "https://app.example/service", media_url: null } } };
const env = { TEST_LINKEDIN: JSON.stringify({ accessToken: "test-token-with-sufficient-length", authorUrn: work.accountReference, apiVersion: "202609" }) };
const post = { id: work.publicationId, author: work.accountReference, commentary: publicationMessage(work.job), lifecycleState: "PUBLISHED", createdAt: Date.parse("2026-10-31T12:00:30Z") };
it("verifies an existing exact LinkedIn post through GET without publishing", async () => {
 const request = vi.fn(async () => new Response(JSON.stringify(post)));
 await expect(verifyNativeSocialPublication(work, { env, fetch: request })).resolves.toMatchObject({ responseHash: expect.stringMatching(/^[0-9a-f]{64}$/u) });
 expect(request).toHaveBeenCalledWith(new URL("https://api.linkedin.com/rest/posts/urn%3Ali%3Ashare%3A123456"), expect.objectContaining({ method: "GET", redirect: "error" }));
});
it.each([{ ...post, author: "urn:li:organization:other" }, { ...post, commentary: "different content" }, { ...post, lifecycleState: "DRAFT" }, { ...post, id: "other" }])("rejects a native post not bound to its account, text, state and identity", async data => {
 await expect(verifyNativeSocialPublication(work, { env, fetch: vi.fn(async () => new Response(JSON.stringify(data))) })).rejects.toThrow("SOCIAL_NATIVE_PROOF_MISMATCH");
});
it("does not mistake an old identical post for the current attempt", async () => {
 await expect(verifyNativeSocialPublication(work, { env, fetch: vi.fn(async () => new Response(JSON.stringify({ ...post, createdAt: Date.parse("2026-10-30T12:00:00Z") }))) })).rejects.toThrow("SOCIAL_NATIVE_PROOF_TIME_MISMATCH");
});
it("does not interpret a 404 as NOT_SENT or requeue", async () => {
 await expect(verifyNativeSocialPublication(work, { env, fetch: vi.fn(async () => new Response(null, { status: 404 })) })).rejects.toThrow("SOCIAL_NATIVE_PROOF_UNAVAILABLE");
});
it("does not infer an original media proof from caption alone", async () => {
 const request = vi.fn(); await expect(verifyNativeSocialPublication({ ...work, job: { ...work.job, provider: "META", channel: "REEL" } }, { env, fetch: request })).rejects.toThrow("SOCIAL_NATIVE_MEDIA_PROOF_REQUIRED"); expect(request).not.toHaveBeenCalled();
});
it("verifies the existing published Facebook post and page in its claim window", async () => {
 const fb = { ...work, publicationId: "123_456", accountReference: "123", job: { ...work.job, provider: "META" as const, channel: "FACEBOOK" as const, credential_reference: "env://TEST_META" } };
 const request = vi.fn(async () => new Response(JSON.stringify({ id: "123_456", from: { id: "123" }, message: publicationMessage(fb.job), created_time: "2026-10-31T12:01:00Z", is_published: true })));
 await expect(verifyNativeSocialPublication(fb, { env: { TEST_META: JSON.stringify({ accessToken: "test-token-with-sufficient-length", targetId: "123", graphVersion: "v24.0" }) }, fetch: request })).resolves.toHaveProperty("responseHash"); expect(request).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ method: "GET" }));
});

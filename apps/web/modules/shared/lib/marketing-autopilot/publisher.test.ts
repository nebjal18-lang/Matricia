import { describe, expect, it, vi } from "vitest";
import { publicationJobSchema, publishScheduledSocial, type PublicationJob } from "./publisher";

const job: PublicationJob = {
  outcome: "JOB_CLAIMED",
  job_id: "11111111-1111-4111-8111-111111111111",
  lease_token: "22222222-2222-4222-8222-222222222222",
  provider_idempotency_key: "social-job-11111111",
  attempt: 1,
  provider: "LINKEDIN",
  channel: "LINKEDIN",
  credential_reference: "env://MATRICIA_SOCIAL_LINKEDIN",
  content: { language: "FR", hook: "Conseil", body: "Corps", cta: "Découvrir", hashtags: ["#Matricia"], landing_url: "https://matricia.example/service", media_url: null },
};
const credential = JSON.stringify({ accessToken: "token-value-with-safe-minimum-length", authorUrn: "urn:li:organization:123", apiVersion: "202609" });

describe("social publication adapters", () => {
  it("requires lease and stable provider idempotency contracts while accepting vault aliases", () => {
    expect(publicationJobSchema.safeParse({ ...job, credential_reference: "vault://LINKEDIN_PRIMARY" }).success).toBe(true);
    const withoutLease: Record<string, unknown> = { ...job };
    delete withoutLease.lease_token;
    expect(publicationJobSchema.safeParse(withoutLease).success).toBe(false);
  });
  it("records a sandbox simulation without resolving a secret or publishing", async () => {
    const request = vi.fn(), resolveCredential = vi.fn();
    await expect(publishScheduledSocial(job, { mode: "sandbox", liveEnabled: false, resolveCredential, fetch: request })).resolves.toEqual({ outcome: "SANDBOXED" });
    expect(resolveCredential).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it("blocks live calls unless explicitly enabled", async () => {
    const request = vi.fn(), resolveCredential = vi.fn();
    await expect(publishScheduledSocial(job, { mode: "live", liveEnabled: false, resolveCredential, fetch: request })).resolves.toEqual({ outcome: "PERMANENT_FAILURE", errorCode: "LIVE_PUBLISHING_DISABLED" });
    expect(resolveCredential).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it("keeps credentials out of request content without inventing an unsupported provider idempotency header", async () => {
    let body = "";
    const request: typeof fetch = vi.fn(async (input, init) => {
      expect(String(input)).toBe("https://api.linkedin.com/rest/posts");
      expect(new Headers(init?.headers).has("x-restli-idempotency-key")).toBe(false);
      body = String(init?.body ?? "");
      return new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:123" } });
    });
    await expect(publishScheduledSocial(job, { mode: "live", liveEnabled: true, resolveCredential: () => credential, fetch: request })).resolves.toEqual({ outcome: "PUBLISHED", providerPublicationId: "urn:li:share:123" });
    expect(body).not.toContain("token-value");
  });

  it("classifies rate limits as retryable and ambiguous network failures for reconciliation", async () => {
    const limited: typeof fetch = vi.fn(async () => new Response(null, { status: 429 }));
    await expect(publishScheduledSocial(job, { mode: "live", liveEnabled: true, resolveCredential: () => credential, fetch: limited })).resolves.toEqual({ outcome: "RETRYABLE_FAILURE", errorCode: "PROVIDER_HTTP_429" });
    const offline: typeof fetch = vi.fn(async () => { throw new TypeError("network detail"); });
    await expect(publishScheduledSocial(job, { mode: "live", liveEnabled: true, resolveCredential: () => credential, fetch: offline })).resolves.toEqual({ outcome: "RECONCILIATION_REQUIRED", errorCode: "PROVIDER_RESPONSE_UNKNOWN" });
    const ambiguous: typeof fetch = vi.fn(async () => new Response(null, { status: 503 }));
    await expect(publishScheduledSocial(job, { mode: "live", liveEnabled: true, resolveCredential: () => credential, fetch: ambiguous })).resolves.toEqual({ outcome: "RECONCILIATION_REQUIRED", errorCode: "PROVIDER_RESPONSE_UNKNOWN" });
  });

  it("never exposes an unresolved or malformed credential", async () => {
    await expect(publishScheduledSocial(job, { mode: "live", liveEnabled: true, resolveCredential: () => null, fetch: vi.fn() })).resolves.toEqual({ outcome: "PERMANENT_FAILURE", errorCode: "CREDENTIAL_REFERENCE_UNRESOLVED" });
    await expect(publishScheduledSocial(job, { mode: "live", liveEnabled: true, resolveCredential: () => "secret-not-json", fetch: vi.fn() })).resolves.toEqual({ outcome: "PERMANENT_FAILURE", errorCode: "INVALID_CREDENTIAL_CONFIGURATION" });
  });
});

it("reconciles a successful response without ID rather than publishing twice", async () => {
  const request: typeof fetch = vi.fn(async () => new Response(null, { status: 201 }));
  await expect(publishScheduledSocial(job, { mode: "live", liveEnabled: true, resolveCredential: () => credential, fetch: request })).resolves.toEqual({ outcome: "RECONCILIATION_REQUIRED", errorCode: "PROVIDER_ID_MISSING" });
  expect(request).toHaveBeenCalledOnce();
});

it.each(["INSTAGRAM","REEL"] as const)("refuses legacy inline %s media publication without durable checkpoints",async channel=>{
 const request=vi.fn();await expect(publishScheduledSocial({...job,provider:"META",channel},{mode:"live",liveEnabled:true,resolveCredential:()=>JSON.stringify({accessToken:"test-credential-".repeat(3),targetId:"123456",graphVersion:"v23.0"}),fetch:request})).resolves.toEqual({outcome:"PERMANENT_FAILURE",errorCode:"META_DURABLE_EXECUTOR_REQUIRED"});expect(request).not.toHaveBeenCalled();
});

vi.mock("@/modules/shared/lib/operations/heartbeat", () => ({ withOperationalHeartbeat: (_service: string, _expires: number, run: () => Promise<Response>) => run() }));
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), publish: vi.fn(), resolve: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/modules/shared/lib/marketing-autopilot/credential-resolver", () => ({ resolveSocialCredentialReference: mocks.resolve }));
vi.mock("@/modules/shared/lib/marketing-autopilot/publisher", () => ({
  MAX_PUBLICATION_JOB_MS: 40_000,
  publicationJobSchema: { safeParse: (value: unknown) => ({ success: true, data: value }) },
  publishScheduledSocial: mocks.publish,
}));

import { POST } from "./route";

const secret = "s".repeat(32);
const job = (suffix: string, reference = "env://SOCIAL_LINKEDIN") => ({
  outcome: "JOB_CLAIMED",
  job_id: `${suffix.repeat(8)}-${suffix.repeat(4)}-4${suffix.repeat(3)}-8${suffix.repeat(3)}-${suffix.repeat(12)}`,
  lease_token: `${suffix.repeat(8)}-${suffix.repeat(4)}-4${suffix.repeat(3)}-9${suffix.repeat(3)}-${suffix.repeat(12)}`,
  provider_idempotency_key: `provider-job-${suffix.repeat(8)}`,
  attempt: 1,
  provider: "LINKEDIN",
  channel: "LINKEDIN",
  credential_reference: reference,
  content: { language: "FR", hook: "Conseil", body: "Corps", cta: "Voir", hashtags: [], landing_url: "https://matricia.example/service", media_url: null },
});

function request(query = "", token = secret) {
  return new Request(`http://localhost/api/workers/marketing-publications${query}`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
}

function sequence(...results: Array<{ data: unknown; error: unknown }>) {
  let index = 0;
  mocks.rpc.mockImplementation(async (name: string) => name === "mark_timed_out_social_publication_attempts_v1" ? { data: { outcome: "MARKETING_TIMEOUTS_PROCESSED", marked: 0 }, error: null } : results[index++]);
}

describe("marketing publication worker", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = secret;
    delete process.env.MARKETING_PUBLISH_MODE;
    delete process.env.MARKETING_LIVE_PUBLISHING_ENABLED;
    mocks.rpc.mockReset(); mocks.publish.mockReset(); mocks.resolve.mockReset();
  });

  it("refuse les appels sans secret de service", async () => {
    const response = await POST(request("", "invalid"));
    expect(response.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("enregistre le résultat avec le lease token V42 sans exposer la référence vault", async () => {
    const claimed = job("1", "vault://LINKEDIN_PRIMARY");
    sequence({ data: claimed, error: null }, { data: { outcome: "PUBLISHED" }, error: null });
    mocks.publish.mockResolvedValue({ outcome: "PUBLISHED", providerPublicationId: "urn:li:share:123" });
    const response = await POST(request("?limit=1"));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenLastCalledWith("record_social_publication_worker_result_v42", expect.objectContaining({ p_job_id: claimed.job_id, p_lease_token: claimed.lease_token, p_outcome: "PUBLISHED", p_provider_publication_id: "urn:li:share:123" }));
    expect(JSON.stringify(await response.json())).not.toContain("LINKEDIN_PRIMARY");
  });

  it("continue le lot lorsqu'un résultat nécessite une réconciliation", async () => {
    const first = job("1"), second = job("2");
    mocks.rpc.mockImplementation(async (name: string, args: { p_job_id?: string }) => {
      if (name === "mark_timed_out_social_publication_attempts_v1") return { data: { outcome: "MARKETING_TIMEOUTS_PROCESSED", marked: 1 }, error: null };
      if (name === "claim_next_social_publication_job_v41") {
        const calls = mocks.rpc.mock.calls.filter(([called]) => called === name).length;
        return { data: calls === 1 ? first : calls === 2 ? second : { outcome: "NO_JOB" }, error: null };
      }
      return args.p_job_id === first.job_id ? { data: null, error: { code: "55000" } } : { data: { outcome: "PUBLISHED" }, error: null };
    });
    mocks.publish.mockResolvedValue({ outcome: "PUBLISHED", providerPublicationId: "urn:li:share:123" });
    const response = await POST(request("?limit=3"));
    expect(await response.json()).toMatchObject({ processed: 2, published: 1, failed: 1, reconciliationRequired: 1 });
    expect(mocks.publish).toHaveBeenCalledTimes(2);
  });

  it("isole une exception inattendue du publisher sans autoriser de rejeu ambigu", async () => {
    const claimed = job("3");
    sequence({ data: claimed, error: null });
    mocks.publish.mockRejectedValue(new Error("secret-like internal detail"));
    const response = await POST(request("?limit=1"));
    const body = await response.json();
    expect(body).toMatchObject({ processed: 1, failed: 1, reconciliationRequired: 1 });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(body)).not.toContain("secret-like internal detail");
  });

  it("laisse expirer le lease lors d'une réponse fournisseur ambiguë pour réconciliation", async () => {
    const claimed = job("4");
    sequence({ data: claimed, error: null });
    mocks.publish.mockResolvedValue({ outcome: "RECONCILIATION_REQUIRED", errorCode: "PROVIDER_RESPONSE_UNKNOWN" });
    const response = await POST(request("?limit=1"));
    expect(await response.json()).toMatchObject({ processed: 1, failed: 1, reconciliationRequired: 1 });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it("arrête sans boucle active quand le quota fournisseur est épuisé", async () => {
    sequence({ data: { outcome: "PROVIDER_QUOTA_EXHAUSTED", provider: "LINKEDIN", retry_after_seconds: 60 }, error: null });
    const response = await POST(request("?limit=10"));
    expect(await response.json()).toMatchObject({ processed: 0, skipped: 1 });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it("compte une publication sandbox comme preuve traitée, jamais comme skip", async () => {
    const claimed = job("5");
    sequence({ data: claimed, error: null }, { data: { outcome: "SANDBOXED" }, error: null });
    mocks.publish.mockResolvedValue({ outcome: "SANDBOXED" });
    const response = await POST(request("?limit=1"));
    expect(await response.json()).toMatchObject({ processed: 1, sandboxed: 1, skipped: 0 });
  });

  it("balaye les leases expirés avant de réclamer un nouveau job", async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === "mark_timed_out_social_publication_attempts_v1" ? { data: { outcome: "MARKETING_TIMEOUTS_PROCESSED", marked: 2 }, error: null } : { data: { outcome: "NO_JOB" }, error: null });
    const response = await POST(request());
    expect(mocks.rpc.mock.calls[0]).toEqual(["mark_timed_out_social_publication_attempts_v1", expect.objectContaining({ p_limit: 100, p_correlation_id: expect.any(String) })]);
    expect(await response.json()).toMatchObject({ timedOutMarked: 2, timeoutSweepFailed: false });
  });

  it("poursuit les claims si le balayage timeout échoue et masque l'erreur", async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === "mark_timed_out_social_publication_attempts_v1" ? { data: null, error: { message: "sensitive timeout detail" } } : { data: { outcome: "NO_JOB" }, error: null });
    const response = await POST(request());
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain('"timeoutSweepFailed":true');
    expect(body).not.toContain("sensitive timeout detail");
    expect(mocks.rpc).toHaveBeenCalledWith("claim_next_social_publication_job_v41", expect.any(Object));
  });
});

 it("never claims a publication when the invocation lacks its worst-case time budget", async () => {
    process.env.CRON_SECRET = secret;
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ data: { marked: 0 }, error: null });
    const clock = vi.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValue(15_000);
    try {
      const response = await POST(request("?limit=10"));
      expect(response.status).toBe(200);
      expect(mocks.rpc).not.toHaveBeenCalledWith("claim_next_social_publication_job_v41", expect.anything());
    } finally { clock.mockRestore(); }
  });

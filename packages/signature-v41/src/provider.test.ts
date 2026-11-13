import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DevelopmentMockSignatureProvider } from "./mock-provider.js";
import { YousignSandboxSignatureProvider } from "./yousign-sandbox-provider.js";
import { assessSignatureProviderReadiness, verifyHmacSha256Webhook } from "./provider.js";

const document = { contractVersionId: "contract-v1", sha256: "a".repeat(64), fileName: "contract.pdf", storagePath: "contracts/v1.pdf" };
const signers = [
  { signerId: "client", organizationId: "client-org", userId: "client-user", signingOrder: 1 },
  { signerId: "provider", organizationId: "provider-org", userId: "provider-user", signingOrder: 2 },
];

describe("SignatureProvider V4.1", () => {
  it("keeps the development mock SIMPLE-only and seals evidence after every signer", async () => {
    const provider = new DevelopmentMockSignatureProvider();
    await expect(provider.createEnvelope({ envelopeId: "e-qualified", requestedLevel: "QUALIFIED", documents: [document], signers, idempotencyKey: "create-qualified" })).rejects.toThrow("SIGNATURE_LEVEL_NOT_SUPPORTED");
    const created = await provider.createEnvelope({ envelopeId: "e-simple", requestedLevel: "SIMPLE", documents: [document], signers, idempotencyKey: "create-simple" });
    expect(await provider.sendEnvelope(created.providerEnvelopeId, "send-simple")).toMatchObject({ status: "SENT" });
    expect(provider.sign(created.providerEnvelopeId, "client").status).toBe("PARTIALLY_SIGNED");
    expect(provider.sign(created.providerEnvelopeId, "provider").status).toBe("SIGNED");
    await expect(provider.fetchEvidencePackage(created.providerEnvelopeId)).resolves.toMatchObject({ achievedLevel: "SIMPLE", finalHash: expect.stringMatching(/^[0-9a-f]{64}$/u) });
  });

  it("is idempotent for provider operations and rejects mismatched event replay", async () => {
    const provider = new DevelopmentMockSignatureProvider();
    const input = { envelopeId: "e-replay", requestedLevel: "SIMPLE" as const, documents: [document], signers, idempotencyKey: "same-create" };
    const first = await provider.createEnvelope(input);
    expect(await provider.createEnvelope(input)).toEqual(first);
    const base = { providerEventId: "event-replay", nonce: "nonce-replay", providerEnvelopeId: first.providerEnvelopeId, type: "SENT", occurredAt: "2026-09-13T12:00:00.000Z" };
    const headers = { "x-matricia-mock": "development-only" };
    const raw = new TextEncoder().encode(JSON.stringify(base));
    expect(await provider.verifyWebhook(raw, headers, new Date())).toEqual(await provider.verifyWebhook(raw, headers, new Date()));
    const changed = new TextEncoder().encode(JSON.stringify({ ...base, type: "FAILED" }));
    await expect(provider.verifyWebhook(changed, headers, new Date())).rejects.toThrow("SIGNATURE_EVENT_REPLAY_MISMATCH");
  });

  it("verifies timestamp-bounded HMAC without exposing the secret", () => {
    const rawBody = new TextEncoder().encode('{"event":"signed"}');
    const secret = new TextEncoder().encode("runtime-only-secret");
    const receivedAt = new Date("2026-09-13T12:00:00.000Z");
    const timestampSeconds = receivedAt.getTime() / 1_000;
    const signatureHex = createHmac("sha256", secret).update(String(timestampSeconds)).update(".").update(rawBody).digest("hex");
    expect(verifyHmacSha256Webhook({ rawBody, signatureHex, timestampSeconds, receivedAt, toleranceSeconds: 300, secret })).toBe(true);
    expect(verifyHmacSha256Webhook({ rawBody, signatureHex, timestampSeconds: timestampSeconds - 301, receivedAt, toleranceSeconds: 300, secret })).toBe(false);
  });

  it("fails closed when no real signature provider is registered for production", () => {
    const mock = new DevelopmentMockSignatureProvider();
    expect(assessSignatureProviderReadiness(undefined, { NODE_ENV: "production", SIGNATURE_PROVIDER_MODE: "EXTERNAL" })).toEqual({ status: "not_ready", code: "SIGNATURE_PROVIDER_NOT_REGISTERED" });
    expect(assessSignatureProviderReadiness(mock, { NODE_ENV: "production", SIGNATURE_PROVIDER_MODE: "DEVELOPMENT_MOCK" })).toEqual({ status: "not_ready", code: "SIGNATURE_DEVELOPMENT_PROVIDER_FORBIDDEN" });
    expect(assessSignatureProviderReadiness(mock, { NODE_ENV: "development", SIGNATURE_PROVIDER_MODE: "DEVELOPMENT_MOCK" })).toMatchObject({ status: "ready", providerCode: "MATRICIA_DEV_MOCK", supportedLevels: ["SIMPLE"] });
  });

  it("requires an exact configured code for an external adapter", () => {
    const external = { ...new DevelopmentMockSignatureProvider(), code: "MOROCCO_SIGNATURE_PROVIDER", developmentOnly: false } as unknown as import("./provider.js").SignatureProvider;
    expect(assessSignatureProviderReadiness(external, { NODE_ENV: "production", SIGNATURE_PROVIDER_MODE: "EXTERNAL", SIGNATURE_PROVIDER_CODE: "OTHER" })).toEqual({ status: "not_ready", code: "SIGNATURE_PROVIDER_CODE_MISMATCH" });
    expect(assessSignatureProviderReadiness(external, { NODE_ENV: "production", SIGNATURE_PROVIDER_MODE: "EXTERNAL", SIGNATURE_PROVIDER_CODE: "MOROCCO_SIGNATURE_PROVIDER" })).toMatchObject({ status: "ready", providerCode: "MOROCCO_SIGNATURE_PROVIDER" });
  });

  it("refuses a YouSign sandbox adapter without credentials and never invents envelopes", async () => {
    expect(() => new YousignSandboxSignatureProvider({ apiKey: "short", webhookSecret: "also-short" })).toThrow("SIGNATURE_PROVIDER_NOT_CONFIGURED");
    const provider = new YousignSandboxSignatureProvider({ apiKey: "sandbox-key-long-enough", webhookSecret: "webhook-secret-long" });
    expect(assessSignatureProviderReadiness(provider, { NODE_ENV: "production", SIGNATURE_PROVIDER_MODE: "EXTERNAL", SIGNATURE_PROVIDER_CODE: "YOUSIGN" })).toMatchObject({ status: "ready", providerCode: "YOUSIGN" });
    await expect(provider.createEnvelope({
      envelopeId: "e1",
      requestedLevel: "SIMPLE",
      documents: [{ contractVersionId: "c1", sha256: "a".repeat(64), fileName: "c.pdf", storagePath: "contracts/c.pdf" }],
      signers: [
        { signerId: "s1", organizationId: "o1", userId: "u1", signingOrder: 1 },
        { signerId: "s2", organizationId: "o2", userId: "u2", signingOrder: 2 },
      ],
      idempotencyKey: "k1",
    })).rejects.toThrow("SIGNATURE_PROVIDER_SANDBOX_NOT_ACTIVATED");
  });
});

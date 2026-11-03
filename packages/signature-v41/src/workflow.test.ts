import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { createSignatureWorkflow, type SignatureWorkflowEnvelope, type SignatureWorkflowRepository } from "./workflow.js";
import type { SignatureProvider, VerifiedSignatureEvent } from "./provider.js";
const raw = Buffer.from('{"signed":true}');
const envelope: SignatureWorkflowEnvelope = {
  input: { envelopeId: "envelope-1", requestedLevel: "ADVANCED", documents: [{ contractVersionId: "contract-version-1", sha256: "a".repeat(64), fileName: "contract.pdf", storagePath: "private/contract.pdf" }], signers: [{ signerId: "signer-1", userId: "user-1", organizationId: "organization-1", signingOrder: 1 }], idempotencyKey: "create-stable-key" },
  providerCode: "TEST_ADAPTER", providerEnvelopeId: "provider-envelope-1", remainingSignerIds: ["signer-1"], evidencePolicy: { version: "legal-policy-fixture-v1", requireCertificate: true, requireTrustedTimestamp: true },
};
const event: VerifiedSignatureEvent = { providerEventId: "provider-event-1", nonce: "nonce-fixture-1", providerEnvelopeId: "provider-envelope-1", type: "SIGNER_SIGNED", occurredAt: "2026-10-31T12:00:00Z", payloadSha256: createHash("sha256").update(raw).digest("hex"), signatureFingerprint: "b".repeat(64), signerId: "signer-1", achievedLevel: "ADVANCED" };
const repository = { beginOperation: vi.fn(), recordProviderReference: vi.fn(), recordOperationAccepted: vi.fn(), recordOperationUnknown: vi.fn(), resolveProviderEnvelope: vi.fn(), recordVerifiedEvent: vi.fn() } satisfies SignatureWorkflowRepository;
const provider: SignatureProvider = { code: "TEST_ADAPTER", supportedLevels: ["ADVANCED"], createEnvelope: vi.fn(), sendEnvelope: vi.fn(), voidEnvelope: vi.fn(), verifyWebhook: vi.fn(), fetchEvidencePackage: vi.fn() };
const env = { NODE_ENV: "production", SIGNATURE_PROVIDER_MODE: "EXTERNAL", SIGNATURE_PROVIDER_CODE: "TEST_ADAPTER" };
beforeEach(() => {
  vi.resetAllMocks(); repository.resolveProviderEnvelope.mockResolvedValue(envelope); repository.recordVerifiedEvent.mockResolvedValue({ replayed: false });
  vi.mocked(provider.verifyWebhook).mockResolvedValue(event);
  vi.mocked(provider.fetchEvidencePackage).mockResolvedValue({ providerEnvelopeId: envelope.providerEnvelopeId!, achievedLevel: "ADVANCED", finalHash: "c".repeat(64), documentHashes: ["a".repeat(64)], certificateFingerprint: "d".repeat(64), timestampTokenHash: "e".repeat(64) });
});
it("requires provider registration before any durable claim or external operation", async () => {
  await expect(createSignatureWorkflow({ repository, env }).execute("envelope-1", "SEND", "key")).rejects.toThrow("SIGNATURE_PROVIDER_NOT_REGISTERED");
  expect(repository.beginOperation).not.toHaveBeenCalled();
});
it("does not resend an operation with a durably ambiguous outcome", async () => {
  repository.beginOperation.mockResolvedValue({ outcome: "RECONCILIATION_REQUIRED" });
  await expect(createSignatureWorkflow({ provider, repository, env }).execute("envelope-1", "SEND", "stable-key")).resolves.toEqual({ outcome: "RECONCILIATION_REQUIRED" });
  expect(provider.sendEnvelope).not.toHaveBeenCalled();
});
it("records uncertainty if the send response is lost", async () => {
  repository.beginOperation.mockResolvedValue({ outcome: "CLAIMED", envelope }); vi.mocked(provider.sendEnvelope).mockRejectedValue(new Error("private provider detail"));
  await expect(createSignatureWorkflow({ provider, repository, env }).execute("envelope-1", "SEND", "stable-key")).resolves.toEqual({ outcome: "RECONCILIATION_REQUIRED" });
  expect(repository.recordOperationUnknown).toHaveBeenCalledWith("envelope-1", "SEND", "stable-key"); expect(repository.recordOperationAccepted).not.toHaveBeenCalled();
});
it("requires evidence bound to every exact document hash before the final signature inbox transaction", async () => {
  vi.mocked(provider.fetchEvidencePackage).mockResolvedValue({ providerEnvelopeId: envelope.providerEnvelopeId!, achievedLevel: "ADVANCED", finalHash: "c".repeat(64), documentHashes: ["f".repeat(64)] });
  await expect(createSignatureWorkflow({ provider, repository, env }).webhook(raw, {})).rejects.toThrow("SIGNATURE_EXACT_DOCUMENT_EVIDENCE_REQUIRED");
  expect(repository.recordVerifiedEvent).not.toHaveBeenCalled();
});
it("requires the chosen evidence policy's certificate and timestamp", async () => {
  vi.mocked(provider.fetchEvidencePackage).mockResolvedValue({ providerEnvelopeId: envelope.providerEnvelopeId!, achievedLevel: "ADVANCED", finalHash: "c".repeat(64), documentHashes: ["a".repeat(64)] });
  await expect(createSignatureWorkflow({ provider, repository, env }).webhook(raw, {})).rejects.toThrow("SIGNATURE_CERTIFICATE_EVIDENCE_REQUIRED");
});
it("passes verified events and exact evidence to the durable replay inbox", async () => {
  await expect(createSignatureWorkflow({ provider, repository, env }).webhook(raw, {})).resolves.toEqual({ replayed: false });
  expect(repository.recordVerifiedEvent).toHaveBeenCalledWith(envelope, event, expect.objectContaining({ documentHashes: ["a".repeat(64)] }));
});
it("rejects provider verification that does not bind the actual raw body", async () => {
  vi.mocked(provider.verifyWebhook).mockResolvedValue({ ...event, payloadSha256: "f".repeat(64) });
  await expect(createSignatureWorkflow({ provider, repository, env }).webhook(raw, {})).rejects.toThrow("SIGNATURE_EVENT_VERIFICATION_INVALID"); expect(repository.recordVerifiedEvent).not.toHaveBeenCalled();
});

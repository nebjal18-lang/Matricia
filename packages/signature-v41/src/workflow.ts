import { createHash } from "node:crypto";
import { assessSignatureProviderReadiness, type CreateEnvelopeInput, type SignatureEvidence, type SignatureProvider, type VerifiedSignatureEvent } from "./provider.js";

export interface SignatureEvidencePolicy {
  readonly version: string;
  readonly requireCertificate: boolean;
  readonly requireTrustedTimestamp: boolean;
}
export interface SignatureWorkflowEnvelope {
  readonly input: CreateEnvelopeInput;
  readonly providerCode: string;
  readonly providerEnvelopeId?: string;
  readonly evidencePolicy: SignatureEvidencePolicy;
  readonly remainingSignerIds: readonly string[];
}
/** Implementations must persist claims, the replay inbox and nonce uniqueness transactionally. */
export interface SignatureWorkflowRepository {
  beginOperation(envelopeId: string, operation: "SEND" | "VOID", key: string): Promise<{ outcome: "CLAIMED"; envelope: SignatureWorkflowEnvelope } | { outcome: "COMPLETED" | "RECONCILIATION_REQUIRED" }>;
  recordProviderReference(envelopeId: string, providerCode: string, providerEnvelopeId: string): Promise<void>;
  recordOperationAccepted(envelopeId: string, operation: "SEND" | "VOID", key: string): Promise<void>;
  recordOperationUnknown(envelopeId: string, operation: "SEND" | "VOID", key: string): Promise<void>;
  resolveProviderEnvelope(providerCode: string, providerEnvelopeId: string): Promise<SignatureWorkflowEnvelope>;
  /** Revalidate signers/authority/version and require evidence on the final signature inside the inbox transaction. */
  recordVerifiedEvent(envelope: SignatureWorkflowEnvelope, event: VerifiedSignatureEvent, evidence: SignatureEvidence | undefined): Promise<{ replayed: boolean }>;
}
function requireProvider(provider: SignatureProvider | undefined, env: Readonly<Record<string, string | undefined>>): SignatureProvider {
  const readiness = assessSignatureProviderReadiness(provider, env);
  if (readiness.status !== "ready" || !provider) throw new Error(readiness.status === "not_ready" ? readiness.code : "SIGNATURE_PROVIDER_NOT_REGISTERED");
  return provider;
}
function requireMatchingProvider(envelope: SignatureWorkflowEnvelope, provider: SignatureProvider) {
  if (envelope.providerCode !== provider.code || !provider.supportedLevels.includes(envelope.input.requestedLevel) || !envelope.evidencePolicy.version.trim()) throw new Error("SIGNATURE_PROVIDER_POLICY_MISMATCH");
}
function validateEvidence(envelope: SignatureWorkflowEnvelope, evidence: SignatureEvidence) {
  const hashes = envelope.input.documents.map(document => document.sha256).sort();
  if (evidence.providerEnvelopeId !== envelope.providerEnvelopeId || evidence.achievedLevel !== envelope.input.requestedLevel || !/^[0-9a-f]{64}$/u.test(evidence.finalHash) || JSON.stringify([...(evidence.documentHashes ?? [])].sort()) !== JSON.stringify(hashes)) throw new Error("SIGNATURE_EXACT_DOCUMENT_EVIDENCE_REQUIRED");
  if (envelope.evidencePolicy.requireCertificate && !/^[0-9a-f]{64}$/u.test(evidence.certificateFingerprint ?? "")) throw new Error("SIGNATURE_CERTIFICATE_EVIDENCE_REQUIRED");
  if (envelope.evidencePolicy.requireTrustedTimestamp && !/^[0-9a-f]{64}$/u.test(evidence.timestampTokenHash ?? "")) throw new Error("SIGNATURE_TIMESTAMP_EVIDENCE_REQUIRED");
}
/** Provider-neutral orchestration. No network protocol or legal level is inferred here. */
export function createSignatureWorkflow(dependencies: { provider?: SignatureProvider; repository: SignatureWorkflowRepository; env: Readonly<Record<string, string | undefined>> }) {
  const { repository, env } = dependencies;
  return {
    async execute(envelopeId: string, operation: "SEND" | "VOID", key: string) {
      const provider = requireProvider(dependencies.provider, env);
      const claim = await repository.beginOperation(envelopeId, operation, key);
      if (claim.outcome !== "CLAIMED") return claim;
      const envelope = claim.envelope;
      requireMatchingProvider(envelope, provider);
      try {
        let reference = envelope.providerEnvelopeId;
        if (!reference) {
          if (operation === "VOID") throw new Error("SIGNATURE_PROVIDER_REFERENCE_REQUIRED");
          const created = await provider.createEnvelope(envelope.input);
          if (created.requestedLevel !== envelope.input.requestedLevel || created.status !== "READY_FOR_SIGNATURE" || !created.providerEnvelopeId) throw new Error("SIGNATURE_PROVIDER_RESPONSE_INVALID");
          reference = created.providerEnvelopeId;
          await repository.recordProviderReference(envelopeId, provider.code, reference);
        }
        const result = operation === "SEND" ? await provider.sendEnvelope(reference, key) : await provider.voidEnvelope(reference, key);
        if (result.providerEnvelopeId !== reference || result.requestedLevel !== envelope.input.requestedLevel || result.status !== (operation === "SEND" ? "SENT" : "VOIDED")) throw new Error("SIGNATURE_PROVIDER_RESPONSE_INVALID");
        await repository.recordOperationAccepted(envelopeId, operation, key);
        return { outcome: "AWAITING_VERIFIED_WEBHOOK" as const };
      } catch {
        await repository.recordOperationUnknown(envelopeId, operation, key);
        return { outcome: "RECONCILIATION_REQUIRED" as const };
      }
    },
    async webhook(rawBody: Uint8Array, headers: Readonly<Record<string, string>>, receivedAt = new Date()) {
      const provider = requireProvider(dependencies.provider, env);
      const event = await provider.verifyWebhook(rawBody, headers, receivedAt);
      if (event.payloadSha256 !== createHash("sha256").update(rawBody).digest("hex") || !event.nonce || !event.providerEventId || !/^[0-9a-f]{64}$/u.test(event.signatureFingerprint)) throw new Error("SIGNATURE_EVENT_VERIFICATION_INVALID");
      const envelope = await repository.resolveProviderEnvelope(provider.code, event.providerEnvelopeId);
      requireMatchingProvider(envelope, provider);
      if (envelope.providerEnvelopeId !== event.providerEnvelopeId || event.signerId && !envelope.input.signers.some(signer => signer.signerId === event.signerId)) throw new Error("SIGNATURE_EVENT_ENVELOPE_MISMATCH");
      let evidence: SignatureEvidence | undefined;
      if (event.type === "SIGNER_SIGNED" && envelope.remainingSignerIds.length <= 1) {
        evidence = await provider.fetchEvidencePackage(event.providerEnvelopeId);
        validateEvidence(envelope, evidence);
      }
      return repository.recordVerifiedEvent(envelope, event, evidence);
    },
  };
}

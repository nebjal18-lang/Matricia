import { createHash } from "node:crypto";
import type { CreateEnvelopeInput, ProviderEnvelope, SignatureEvidence, SignatureLevel, SignatureProvider, VerifiedSignatureEvent } from "./provider";

interface MockState {
  envelope: ProviderEnvelope;
  input: CreateEnvelopeInput;
  signed: Set<string>;
  evidence?: SignatureEvidence;
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Deterministic development adapter. It is intentionally SIMPLE-only and never claims legal qualification. */
export class DevelopmentMockSignatureProvider implements SignatureProvider {
  readonly code = "MATRICIA_DEV_MOCK";
  readonly developmentOnly = true;
  readonly supportedLevels = ["SIMPLE"] as const satisfies readonly SignatureLevel[];
  readonly #states = new Map<string, MockState>();
  readonly #operations = new Map<string, ProviderEnvelope>();
  readonly #events = new Map<string, VerifiedSignatureEvent>();

  async createEnvelope(input: CreateEnvelopeInput): Promise<ProviderEnvelope> {
    if (!this.supportedLevels.includes(input.requestedLevel as "SIMPLE")) throw new Error("SIGNATURE_LEVEL_NOT_SUPPORTED");
    const replay = this.#operations.get(`create:${input.idempotencyKey}`);
    if (replay) return replay;
    if (!input.documents.length || input.signers.length < 2 || input.documents.some((document) => !/^[0-9a-f]{64}$/u.test(document.sha256))) throw new Error("INVALID_SIGNATURE_ENVELOPE");
    const providerEnvelopeId = `mock_${sha256(input.envelopeId).slice(0, 24)}`;
    const envelope: ProviderEnvelope = { providerEnvelopeId, status: "READY_FOR_SIGNATURE", requestedLevel: "SIMPLE" };
    this.#states.set(providerEnvelopeId, { envelope, input, signed: new Set() });
    this.#operations.set(`create:${input.idempotencyKey}`, envelope);
    return envelope;
  }

  async sendEnvelope(providerEnvelopeId: string, idempotencyKey: string): Promise<ProviderEnvelope> {
    return this.#transition(providerEnvelopeId, idempotencyKey, "SENT");
  }

  async voidEnvelope(providerEnvelopeId: string, idempotencyKey: string): Promise<ProviderEnvelope> {
    return this.#transition(providerEnvelopeId, idempotencyKey, "VOIDED");
  }

  async verifyWebhook(rawBody: Uint8Array, headers: Readonly<Record<string, string>>, _receivedAt: Date): Promise<VerifiedSignatureEvent> {
    if (headers["x-matricia-mock"] !== "development-only") throw new Error("MOCK_WEBHOOK_DENIED");
    const decoded: unknown = JSON.parse(new TextDecoder().decode(rawBody));
    if (!isMockEvent(decoded)) throw new Error("INVALID_SIGNATURE_EVENT");
    const payloadSha256 = sha256(rawBody);
    const prior = this.#events.get(decoded.providerEventId);
    const event: VerifiedSignatureEvent = { ...decoded, payloadSha256, signatureFingerprint: sha256(`mock:${decoded.providerEventId}`) };
    if (prior && JSON.stringify(prior) !== JSON.stringify(event)) throw new Error("SIGNATURE_EVENT_REPLAY_MISMATCH");
    if (prior) return prior;
    this.#events.set(event.providerEventId, event);
    return event;
  }

  async fetchEvidencePackage(providerEnvelopeId: string): Promise<SignatureEvidence> {
    const state = this.#states.get(providerEnvelopeId);
    if (!state?.evidence || state.envelope.status !== "SIGNED") throw new Error("SIGNATURE_EVIDENCE_NOT_READY");
    return state.evidence;
  }

  sign(providerEnvelopeId: string, signerId: string): ProviderEnvelope {
    const state = this.#require(providerEnvelopeId);
    if (state.envelope.status !== "SENT" && state.envelope.status !== "PARTIALLY_SIGNED") throw new Error("INVALID_SIGNATURE_TRANSITION");
    if (!state.input.signers.some((signer) => signer.signerId === signerId)) throw new Error("SIGNATURE_SIGNER_NOT_FOUND");
    state.signed.add(signerId);
    const complete = state.signed.size === state.input.signers.length;
    state.envelope = { ...state.envelope, status: complete ? "SIGNED" : "PARTIALLY_SIGNED" };
    if (complete) state.evidence = { providerEnvelopeId, achievedLevel: "SIMPLE", finalHash: sha256(JSON.stringify({ providerEnvelopeId, documents: state.input.documents, signers: [...state.signed].sort() })) };
    return state.envelope;
  }

  #transition(providerEnvelopeId: string, idempotencyKey: string, status: "SENT" | "VOIDED"): ProviderEnvelope {
    const operation = `${status}:${idempotencyKey}`;
    const replay = this.#operations.get(operation);
    if (replay) return replay;
    const state = this.#require(providerEnvelopeId);
    if ((status === "SENT" && state.envelope.status !== "READY_FOR_SIGNATURE") || (status === "VOIDED" && !["READY_FOR_SIGNATURE", "SENT", "PARTIALLY_SIGNED"].includes(state.envelope.status))) throw new Error("INVALID_SIGNATURE_TRANSITION");
    state.envelope = { ...state.envelope, status };
    this.#operations.set(operation, state.envelope);
    return state.envelope;
  }

  #require(providerEnvelopeId: string): MockState {
    const state = this.#states.get(providerEnvelopeId);
    if (!state) throw new Error("SIGNATURE_ENVELOPE_NOT_FOUND");
    return state;
  }
}

function isMockEvent(value: unknown): value is Omit<VerifiedSignatureEvent, "payloadSha256" | "signatureFingerprint"> {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return typeof event.providerEventId === "string" && typeof event.nonce === "string" && typeof event.providerEnvelopeId === "string" && typeof event.occurredAt === "string" && ["SENT", "SIGNER_SIGNED", "DECLINED", "EXPIRED", "FAILED", "VOIDED"].includes(String(event.type));
}

import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_LEVELS = ["SIMPLE", "ADVANCED", "QUALIFIED"] as const;
export type SignatureLevel = (typeof SIGNATURE_LEVELS)[number];
export const ENVELOPE_STATUSES = ["DRAFT", "READY_FOR_SIGNATURE", "SENT", "PARTIALLY_SIGNED", "SIGNED", "DECLINED", "EXPIRED", "FAILED", "VOIDED"] as const;
export type EnvelopeStatus = (typeof ENVELOPE_STATUSES)[number];

export interface SignatureDocumentInput {
  readonly contractVersionId: string;
  readonly sha256: string;
  readonly fileName: string;
  readonly storagePath: string;
}

export interface SignatureSignerInput {
  readonly signerId: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly signingOrder: number;
}

export interface CreateEnvelopeInput {
  readonly envelopeId: string;
  readonly requestedLevel: SignatureLevel;
  readonly documents: readonly SignatureDocumentInput[];
  readonly signers: readonly SignatureSignerInput[];
  readonly idempotencyKey: string;
}

export interface ProviderEnvelope {
  readonly providerEnvelopeId: string;
  readonly status: EnvelopeStatus;
  readonly requestedLevel: SignatureLevel;
}

export interface VerifiedSignatureEvent {
  readonly providerEventId: string;
  readonly nonce: string;
  readonly providerEnvelopeId: string;
  readonly type: "SENT" | "SIGNER_SIGNED" | "DECLINED" | "EXPIRED" | "FAILED" | "VOIDED";
  readonly occurredAt: string;
  readonly payloadSha256: string;
  readonly signatureFingerprint: string;
  readonly achievedLevel?: SignatureLevel;
  readonly signerId?: string;
}

export interface SignatureEvidence {
  readonly providerEnvelopeId: string;
  readonly achievedLevel: SignatureLevel;
  readonly finalHash: string;
  /** Exact source document hashes bound by the external evidence package. */
  readonly documentHashes?: readonly string[];
  readonly certificateFingerprint?: string;
  readonly timestampTokenHash?: string;
}

export interface SignatureProvider {
  readonly code: string;
  readonly supportedLevels: readonly SignatureLevel[];
  readonly developmentOnly?: boolean;
  createEnvelope(input: CreateEnvelopeInput): Promise<ProviderEnvelope>;
  sendEnvelope(providerEnvelopeId: string, idempotencyKey: string): Promise<ProviderEnvelope>;
  voidEnvelope(providerEnvelopeId: string, idempotencyKey: string): Promise<ProviderEnvelope>;
  verifyWebhook(rawBody: Uint8Array, headers: Readonly<Record<string, string>>, receivedAt: Date): Promise<VerifiedSignatureEvent>;
  fetchEvidencePackage(providerEnvelopeId: string): Promise<SignatureEvidence>;
}

export type SignatureProviderReadiness =
  | { readonly status: "ready"; readonly providerCode: string; readonly supportedLevels: readonly SignatureLevel[] }
  | {
      readonly status: "not_ready";
      readonly code: "SIGNATURE_PROVIDER_NOT_REGISTERED" | "SIGNATURE_PROVIDER_MODE_INVALID" | "SIGNATURE_PROVIDER_CODE_MISMATCH" | "SIGNATURE_DEVELOPMENT_PROVIDER_FORBIDDEN";
    };

/**
 * Fail-closed deployment guard. It validates provider registration without
 * resolving or returning provider credentials.
 */
export function assessSignatureProviderReadiness(
  provider: SignatureProvider | undefined,
  env: Readonly<Record<string, string | undefined>>,
): SignatureProviderReadiness {
  if (!provider) return { status: "not_ready", code: "SIGNATURE_PROVIDER_NOT_REGISTERED" };
  const mode = env.SIGNATURE_PROVIDER_MODE?.trim();
  if (mode !== "DEVELOPMENT_MOCK" && mode !== "EXTERNAL") {
    return { status: "not_ready", code: "SIGNATURE_PROVIDER_MODE_INVALID" };
  }
  if ((env.NODE_ENV === "production" || env.APP_ENV?.trim().toLowerCase() === "production" || mode === "EXTERNAL") && provider.developmentOnly) {
    return { status: "not_ready", code: "SIGNATURE_DEVELOPMENT_PROVIDER_FORBIDDEN" };
  }
  if (mode === "EXTERNAL" && env.SIGNATURE_PROVIDER_CODE?.trim() !== provider.code) {
    return { status: "not_ready", code: "SIGNATURE_PROVIDER_CODE_MISMATCH" };
  }
  return { status: "ready", providerCode: provider.code, supportedLevels: provider.supportedLevels };
}

export interface HmacWebhookInput {
  readonly rawBody: Uint8Array;
  readonly signatureHex: string;
  readonly timestampSeconds: number;
  readonly receivedAt: Date;
  readonly toleranceSeconds: number;
  readonly secret: Uint8Array;
}

/** Provider adapters resolve secrets at runtime; config and logs only retain secret reference names. */
export function verifyHmacSha256Webhook(input: HmacWebhookInput): boolean {
  const age = Math.abs(Math.floor(input.receivedAt.getTime() / 1_000) - input.timestampSeconds);
  if (!Number.isSafeInteger(input.timestampSeconds) || age > input.toleranceSeconds || !/^[0-9a-f]{64}$/u.test(input.signatureHex)) return false;
  const expected = createHmac("sha256", input.secret).update(String(input.timestampSeconds)).update(".").update(input.rawBody).digest();
  const received = Buffer.from(input.signatureHex, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

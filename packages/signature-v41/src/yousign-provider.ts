import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { CreateEnvelopeInput, ProviderEnvelope, SignatureDocumentInput, SignatureEvidence, SignatureLevel, SignatureProvider, SignatureSignerInput, VerifiedSignatureEvent } from "./provider.js";

const BASE_URL = "https://api-sandbox.yousign.app/v3";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const HASH = /^[0-9a-f]{64}$/u;
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;
const MAX_JSON_BYTES = 1024 * 1024;
const MAX_WEBHOOK_BYTES = 128 * 1024;

export interface YousignSignerIdentity {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly locale: "fr" | "en";
  /** Positions must come from an authorized document-specific preparation step. */
  readonly fields: readonly { readonly documentSha256: string; readonly page: number; readonly x: number; readonly y: number }[];
}

export interface YousignProviderRequestState {
  readonly envelopeId: string;
  readonly requestedLevel: SignatureLevel;
  readonly documents: readonly { readonly sourceSha256: string; readonly providerDocumentId: string }[];
  readonly signers: readonly { readonly signerId: string; readonly providerSignerId: string; readonly identitySha256: string }[];
}

export interface YousignEvidenceArtifact {
  readonly kind: "SIGNED_PDF" | "AUDIT_JSON";
  readonly providerReference: string;
  readonly bytes: Uint8Array;
}

/** Every write must be durable and enforce the envelope's current governed claim. */
export interface YousignProviderState {
  saveRequest(envelopeId: string, providerRequestId: string, requestedLevel: SignatureLevel): Promise<void>;
  saveDocument(providerRequestId: string, sourceSha256: string, providerDocumentId: string): Promise<void>;
  saveSigner(providerRequestId: string, signerId: string, providerSignerId: string, identitySha256: string): Promise<void>;
  loadRequest(providerRequestId: string): Promise<YousignProviderRequestState>;
  archiveEvidence(providerRequestId: string, artifacts: readonly YousignEvidenceArtifact[]): Promise<void>;
}

export interface YousignSandboxProviderDependencies {
  readonly apiKey: string;
  readonly webhookSecret: string;
  readonly deploymentEnvironment: "STAGING" | "DEVELOPMENT";
  readonly fetch: typeof globalThis.fetch;
  readonly loadDocument: (document: SignatureDocumentInput) => Promise<Uint8Array>;
  readonly loadSigner: (signer: SignatureSignerInput) => Promise<YousignSignerIdentity>;
  readonly state: YousignProviderState;
  readonly workspaceId?: string;
  /** Keep aligned with the governed provider's database tolerance. */
  readonly webhookMaxAgeSeconds?: number;
}

function fail(code: string): never { throw new Error(code); }
function sha(bytes: string | Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail("YOUSIGN_RESPONSE_INVALID");
  return value as Record<string, unknown>;
}
function id(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) return fail("YOUSIGN_REFERENCE_INVALID");
  return value;
}
function list(value: unknown): readonly Record<string, unknown>[] {
  if (!Array.isArray(value)) return fail("YOUSIGN_RESPONSE_INVALID");
  return value.map(record);
}
function isPdf(bytes: Uint8Array): boolean {
  return bytes.byteLength > 5 && bytes.byteLength <= MAX_PDF_BYTES && new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
}
function validIdentity(identity: YousignSignerIdentity, hashes: readonly string[]): boolean {
  const name = (value: string) => typeof value === "string" && value.trim().length > 0 && value.length <= 128 && !/[\u0000-\u001f\u007f]/u.test(value);
  return name(identity.firstName) && name(identity.lastName) && typeof identity.email === "string" && identity.email.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(identity.email)
    && ["fr", "en"].includes(identity.locale) && Array.isArray(identity.fields) && identity.fields.length > 0 && identity.fields.length <= 100
    && identity.fields.every(field => hashes.includes(field.documentSha256) && Number.isInteger(field.page) && field.page >= 1 && field.page <= 10000 && Number.isFinite(field.x) && field.x >= 0 && field.x <= 10000 && Number.isFinite(field.y) && field.y >= 0 && field.y <= 10000)
    && hashes.every(hash => identity.fields.some(field => field.documentSha256 === hash));
}

function signerFingerprint(value: Record<string, unknown>): string {
  const info = record(value.info);
  if (value.signature_level !== "electronic_signature" || value.signature_authentication_mode !== "otp_email"
    || typeof info.first_name !== "string" || typeof info.last_name !== "string" || typeof info.email !== "string" || !["fr", "en"].includes(String(info.locale))) fail("YOUSIGN_SIGNER_BINDING_MISMATCH");
  const fields = list(value.fields).map(field => {
    if (field.type !== "signature" || !Number.isInteger(field.page) || !Number.isFinite(field.x) || !Number.isFinite(field.y)) fail("YOUSIGN_SIGNER_BINDING_MISMATCH");
    return { type: "signature", document_id: id(field.document_id), page: field.page, x: field.x, y: field.y };
  }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (!fields.length) fail("YOUSIGN_SIGNER_BINDING_MISMATCH");
  return sha(JSON.stringify({ firstName: info.first_name, lastName: info.last_name, email: info.email.toLowerCase(), locale: info.locale, level: value.signature_level, authentication: value.signature_authentication_mode, fields }));
}

/** YouSign's documented JSON audit format binds initial document hashes to the
 * actual request and signer. An arbitrary JSON object is never sufficient. */
function validateAudit(audit: Record<string, unknown>, requestId: string, state: YousignProviderRequestState, providerSignerId: string, remoteSigner: Record<string, unknown>): ReadonlyMap<string, readonly string[]> {
  const request = record(audit.signature_request), signer = record(audit.signer), identity = record(remoteSigner.info);
  const documents = list(audit.documents);
  if (typeof audit.version !== "number" || !Number.isFinite(audit.version) || audit.version < 1
    || request.id !== requestId || signer.id !== providerSignerId || signer.first_name !== identity.first_name || signer.last_name !== identity.last_name
    || typeof signer.email_address !== "string" || typeof identity.email !== "string" || signer.email_address.toLowerCase() !== identity.email.toLowerCase()
    || typeof signer.signature_process_completed_at !== "string" || !Number.isFinite(Date.parse(signer.signature_process_completed_at))
    || record(audit.electronic_signature_level).level !== "Simple electronic signature"
    || documents.length !== state.documents.length || new Set(documents.map(document => document.id)).size !== documents.length) fail("YOUSIGN_AUDIT_BINDING_MISMATCH");
  record(audit.authentication);
  const signedHashes = new Map<string, readonly string[]>();
  for (const expected of state.documents) {
    const document = documents.find(candidate => candidate.id === expected.providerDocumentId);
    if (!document || document.initial_hash !== expected.sourceSha256) fail("YOUSIGN_AUDIT_BINDING_MISMATCH");
    const signatures = list(document.signatures);
    if (!signatures.length || signatures.some(signature => typeof signature.hash !== "string" || !HASH.test(signature.hash))) fail("YOUSIGN_AUDIT_BINDING_MISMATCH");
    signedHashes.set(expected.providerDocumentId, signatures.map(signature => String(signature.hash)));
  }
  return signedHashes;
}

/**
 * Real YouSign v3 HTTP adapter, deliberately restricted to sandbox and SIMPLE.
 * It never infers a legal level, signer identity, PDF placement, certificate or TSA.
 * Provider POSTs have no assumed idempotency guarantee. The caller owns a durable
 * operation claim and must reconcile every unknown outcome before another write.
 */
export class YousignSandboxSignatureProvider implements SignatureProvider {
  readonly code = "YOUSIGN";
  readonly sandboxOnly = true;
  readonly supportedLevels = ["SIMPLE"] as const;
  readonly #dependencies: YousignSandboxProviderDependencies;
  readonly #maxAge: number;

  constructor(dependencies: YousignSandboxProviderDependencies) {
    if (!["STAGING", "DEVELOPMENT"].includes(dependencies.deploymentEnvironment)) fail("YOUSIGN_SANDBOX_DEPLOYMENT_REQUIRED");
    if (!dependencies.apiKey.trim() || /[\r\n]/u.test(dependencies.apiKey) || dependencies.apiKey.length > 4096 || Buffer.byteLength(dependencies.webhookSecret) < 32 || dependencies.webhookSecret.length > 4096) fail("YOUSIGN_CREDENTIALS_INVALID");
    if (dependencies.workspaceId !== undefined) id(dependencies.workspaceId);
    this.#maxAge = dependencies.webhookMaxAgeSeconds ?? 300;
    if (!Number.isInteger(this.#maxAge) || this.#maxAge < 30 || this.#maxAge > 900) fail("YOUSIGN_WEBHOOK_TOLERANCE_INVALID");
    this.#dependencies = dependencies;
  }

  async createEnvelope(input: CreateEnvelopeInput): Promise<ProviderEnvelope> {
    if (input.requestedLevel !== "SIMPLE") fail("SIGNATURE_LEVEL_NOT_SUPPORTED");
    id(input.envelopeId);
    const hashes = input.documents.map(document => document.sha256);
    if (input.documents.length < 1 || input.documents.length > 50 || input.signers.length < 2 || input.signers.length > 100 || new Set(hashes).size !== hashes.length || hashes.some(hash => !HASH.test(hash))
      || new Set(input.signers.map(signer => signer.signerId)).size !== input.signers.length
      || new Set(input.signers.map(signer => signer.signingOrder)).size !== input.signers.length
      || input.signers.some(signer => !Number.isSafeInteger(signer.signingOrder) || signer.signingOrder < 1)
      || !input.idempotencyKey.trim()) fail("INVALID_SIGNATURE_ENVELOPE");

    // Resolve and hash before making any provider mutation. No arbitrary URL is accepted.
    let total = 0;
    const documents: { input: SignatureDocumentInput; bytes: Uint8Array }[] = [];
    for (const document of input.documents) {
      if (!/^[^/\\\u0000-\u001f\u007f]{1,124}\.pdf$/iu.test(document.fileName)) fail("YOUSIGN_DOCUMENT_INVALID");
      const bytes = await this.#dependencies.loadDocument(document);
      total += bytes.byteLength;
      if (!isPdf(bytes) || sha(bytes) !== document.sha256 || total > MAX_TOTAL_BYTES) fail("YOUSIGN_SOURCE_DOCUMENT_HASH_MISMATCH");
      documents.push({ input: document, bytes });
    }
    const signers: { input: SignatureSignerInput; identity: YousignSignerIdentity }[] = [];
    for (const signer of [...input.signers].sort((a, b) => a.signingOrder - b.signingOrder)) {
      const identity = await this.#dependencies.loadSigner(signer);
      if (!validIdentity(identity, hashes)) fail("YOUSIGN_SIGNER_PREPARATION_REQUIRED");
      signers.push({ input: signer, identity });
    }
    const query = new URLSearchParams({ "external_id[eq]": input.envelopeId, limit: "2" });
    if (this.#dependencies.workspaceId) query.set("workspace_id[eq]", this.#dependencies.workspaceId);
    const existing = record(await this.#json(`/signature_requests?${query}`));
    if (list(existing.data).length || record(existing.meta).next_cursor) fail("YOUSIGN_RECONCILIATION_REQUIRED");

    const created = record(await this.#json("/signature_requests", "POST", {
      name: `Matricia ${input.envelopeId}`, external_id: input.envelopeId, delivery_mode: "email", ordered_signers: true,
      timezone: "Africa/Casablanca", audit_trail_locale: "fr", signers_allowed_to_decline: true,
      ...(this.#dependencies.workspaceId ? { workspace_id: this.#dependencies.workspaceId } : {}),
    }));
    const requestId = id(created.id);
    if (created.status !== "draft") fail("YOUSIGN_RESPONSE_INVALID");
    // Persist immediately: subsequent failures never erase the remote reference.
    await this.#dependencies.state.saveRequest(input.envelopeId, requestId, input.requestedLevel);
    const documentIds = new Map<string, string>();
    for (const document of documents) {
      const form = new FormData();
      form.set("file", new Blob([new Uint8Array(document.bytes)], { type: "application/pdf" }), document.input.fileName);
      form.set("nature", "signable_document");
      const uploaded = record(await this.#json(`/signature_requests/${requestId}/documents`, "POST", form));
      const documentId = id(uploaded.id);
      if (uploaded.sha256 !== document.input.sha256 || uploaded.nature !== "signable_document") fail("YOUSIGN_PROVIDER_DOCUMENT_HASH_MISMATCH");
      await this.#dependencies.state.saveDocument(requestId, document.input.sha256, documentId);
      documentIds.set(document.input.sha256, documentId);
    }
    for (const signer of signers) {
      const identity = signer.identity;
      const signerPayload = {
        info: { first_name: identity.firstName, last_name: identity.lastName, email: identity.email, locale: identity.locale },
        signature_level: "electronic_signature", signature_authentication_mode: "otp_email",
        fields: identity.fields.map(field => ({ type: "signature", document_id: documentIds.get(field.documentSha256), page: field.page, x: field.x, y: field.y })),
      };
      const identitySha256 = signerFingerprint(signerPayload);
      const createdSigner = record(await this.#json(`/signature_requests/${requestId}/signers`, "POST", signerPayload));
      const signerId = id(createdSigner.id);
      if (signerFingerprint(createdSigner) !== identitySha256) fail("YOUSIGN_SIGNER_BINDING_MISMATCH");
      await this.#dependencies.state.saveSigner(requestId, signer.input.signerId, signerId, identitySha256);
    }
    return { providerEnvelopeId: requestId, requestedLevel: "SIMPLE", status: "READY_FOR_SIGNATURE" };
  }

  async sendEnvelope(providerEnvelopeId: string, idempotencyKey: string): Promise<ProviderEnvelope> {
    return this.#transition(providerEnvelopeId, idempotencyKey, "SEND");
  }

  async voidEnvelope(providerEnvelopeId: string, idempotencyKey: string): Promise<ProviderEnvelope> {
    return this.#transition(providerEnvelopeId, idempotencyKey, "VOID");
  }

  async #transition(providerEnvelopeId: string, key: string, operation: "SEND" | "VOID"): Promise<ProviderEnvelope> {
    const requestId = id(providerEnvelopeId);
    if (!key.trim()) fail("INVALID_SIGNATURE_ENVELOPE");
    const state = await this.#load(requestId);
    const current = record(await this.#json(`/signature_requests/${requestId}`));
    this.#matchesRequest(current, requestId, state);
    if (operation === "SEND" && current.status !== "draft" || operation === "VOID" && !["approval", "ongoing"].includes(String(current.status))) fail("YOUSIGN_RECONCILIATION_REQUIRED");
    if (operation === "SEND") {
      if (current.ordered_signers !== true || JSON.stringify(list(current.signers).map(signer => signer.id)) !== JSON.stringify(state.signers.map(signer => signer.providerSignerId))) fail("YOUSIGN_SIGNER_ORDER_MISMATCH");
      // The provider App can edit a recipient without changing its ID. Recheck the
      // authorized identity, authentication mode and every exact signature field.
      for (const signer of state.signers) {
        const remote = record(await this.#json(`/signature_requests/${requestId}/signers/${id(signer.providerSignerId)}`));
        if (id(remote.id) !== signer.providerSignerId || signerFingerprint(remote) !== signer.identitySha256) fail("YOUSIGN_SIGNER_BINDING_MISMATCH");
      }
      for (const document of state.documents) {
        const remote = record(await this.#json(`/signature_requests/${requestId}/documents/${id(document.providerDocumentId)}`));
        if (id(remote.id) !== document.providerDocumentId || remote.sha256 !== document.sourceSha256 || remote.nature !== "signable_document" || remote.content_type !== "application/pdf" || remote.is_signed !== false
          || !Array.isArray(remote.excluded_signers) || remote.excluded_signers.length) fail("YOUSIGN_PROVIDER_DOCUMENT_HASH_MISMATCH");
      }
    }
    const changed = record(await this.#json(`/signature_requests/${requestId}/${operation === "SEND" ? "activate" : "cancel"}`, "POST", operation === "SEND" ? undefined : { reason: "contractualization_aborted" }));
    if (id(changed.id) !== requestId || changed.status !== (operation === "SEND" ? "ongoing" : "canceled")) fail("YOUSIGN_RESPONSE_INVALID");
    return { providerEnvelopeId: requestId, requestedLevel: "SIMPLE", status: operation === "SEND" ? "SENT" : "VOIDED" };
  }

  async verifyWebhook(rawBody: Uint8Array, headers: Readonly<Record<string, string>>, receivedAt: Date): Promise<VerifiedSignatureEvent> {
    if (!rawBody.byteLength || rawBody.byteLength > MAX_WEBHOOK_BYTES || !Number.isFinite(receivedAt.getTime())) fail("YOUSIGN_WEBHOOK_INVALID");
    const headerEntries = Object.entries(headers).filter(([name]) => name.toLowerCase() === "x-yousign-signature-256");
    if (headerEntries.length !== 1) fail("YOUSIGN_WEBHOOK_SIGNATURE_INVALID");
    const signature = headerEntries[0]?.[1] ?? "";
    if (!/^sha256=[0-9a-f]{64}$/u.test(signature)) fail("YOUSIGN_WEBHOOK_SIGNATURE_INVALID");
    const expected = createHmac("sha256", this.#dependencies.webhookSecret).update(rawBody).digest();
    const supplied = Buffer.from(signature.slice(7), "hex");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) fail("YOUSIGN_WEBHOOK_SIGNATURE_INVALID");
    let payload: Record<string, unknown>;
    try { payload = record(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody))); } catch { return fail("YOUSIGN_WEBHOOK_INVALID"); }
    if (payload.sandbox !== true || typeof payload.event_time !== "string" || !/^\d{1,12}$/u.test(payload.event_time)) fail("YOUSIGN_WEBHOOK_INVALID");
    const eventId = id(payload.event_id);
    const timestamp = Number(payload.event_time);
    const age = Math.floor(receivedAt.getTime() / 1000) - timestamp;
    if (!Number.isSafeInteger(timestamp) || age < -30 || age > this.#maxAge) fail("YOUSIGN_WEBHOOK_STALE");
    const data = record(payload.data);
    const remoteRequest = record(data.signature_request);
    const requestId = id(remoteRequest.id);
    const state = await this.#load(requestId);
    if (remoteRequest.external_id !== undefined && remoteRequest.external_id !== state.envelopeId) fail("YOUSIGN_WEBHOOK_ENVELOPE_MISMATCH");
    const eventMap: Readonly<Record<string, { type: VerifiedSignatureEvent["type"]; status?: string }>> = {
      "signature_request.activated": { type: "SENT", status: "ongoing" },
      "signature_request.canceled": { type: "VOIDED", status: "canceled" },
      "signature_request.declined": { type: "DECLINED", status: "declined" },
      "signature_request.expired": { type: "EXPIRED", status: "expired" },
      "signer.done": { type: "SIGNER_SIGNED" },
      "signer.error": { type: "FAILED" },
    };
    const mapped = typeof payload.event_name === "string" ? eventMap[payload.event_name] : undefined;
    if (!mapped || mapped.status && remoteRequest.status !== mapped.status) fail("YOUSIGN_WEBHOOK_EVENT_UNSUPPORTED");
    let signerId: string | undefined;
    if (payload.event_name === "signer.done" || payload.event_name === "signer.error") {
      const signer = record(data.signer);
      const remoteSignerId = id(signer.id);
      signerId = state.signers.find(candidate => candidate.providerSignerId === remoteSignerId)?.signerId;
      if (!signerId || payload.event_name === "signer.done" && signer.status !== "signed") fail("YOUSIGN_WEBHOOK_SIGNER_MISMATCH");
    }
    return {
      providerEventId: eventId, nonce: eventId, providerEnvelopeId: requestId, type: mapped.type,
      occurredAt: new Date(timestamp * 1000).toISOString(), payloadSha256: sha(rawBody), signatureFingerprint: sha(supplied),
      ...(signerId ? { signerId } : {}), ...(mapped.type === "SIGNER_SIGNED" ? { achievedLevel: "SIMPLE" as const } : {}),
      ...(mapped.type === "SIGNER_SIGNED" && remoteRequest.status === "done" ? { finalEvidenceRequired: true } : {}),
    };
  }

  async fetchEvidencePackage(providerEnvelopeId: string): Promise<SignatureEvidence> {
    const requestId = id(providerEnvelopeId);
    const state = await this.#load(requestId);
    const request = record(await this.#json(`/signature_requests/${requestId}`));
    this.#matchesRequest(request, requestId, state);
    if (request.status !== "done") fail("SIGNATURE_EVIDENCE_NOT_READY");
    const remoteDocs = list(request.documents);
    const remoteSigners = list(request.signers);
    if (remoteDocs.length !== state.documents.length || remoteSigners.length !== state.signers.length
      || state.documents.some(document => !remoteDocs.some(remote => remote.id === document.providerDocumentId && remote.nature === "signable_document"))
      || state.signers.some(signer => !remoteSigners.some(remote => remote.id === signer.providerSignerId && remote.status === "signed"))) fail("YOUSIGN_EVIDENCE_BINDING_MISMATCH");
    const artifacts: YousignEvidenceArtifact[] = [];
    const manifest: { kind: string; providerReference: string; sourceSha256?: string; sha256: string }[] = [];
    const finalDocumentHashes = new Map<string, string>();
    const auditedDocumentHashes = new Map<string, Set<string>>();
    let total = 0;
    // A document must never be downloaded in parallel with itself.
    for (const document of [...state.documents].sort((a, b) => a.providerDocumentId.localeCompare(b.providerDocumentId))) {
      const metadata = record(await this.#json(`/signature_requests/${requestId}/documents/${id(document.providerDocumentId)}`));
      if (id(metadata.id) !== document.providerDocumentId || metadata.nature !== "signable_document" || metadata.content_type !== "application/pdf" || metadata.is_signed !== true
        || typeof metadata.sha256 !== "string" || !HASH.test(metadata.sha256)) fail("YOUSIGN_FINAL_DOCUMENT_EVIDENCE_MISMATCH");
      const bytes = await this.#bytes(`/signature_requests/${requestId}/documents/${id(document.providerDocumentId)}/download`, MAX_PDF_BYTES, "application/pdf");
      total += bytes.byteLength;
      if (!isPdf(bytes) || total > MAX_TOTAL_BYTES) fail("YOUSIGN_EVIDENCE_INVALID");
      const finalHash = sha(bytes);
      if (finalHash !== metadata.sha256) fail("YOUSIGN_FINAL_DOCUMENT_EVIDENCE_MISMATCH");
      finalDocumentHashes.set(document.providerDocumentId, finalHash);
      artifacts.push({ kind: "SIGNED_PDF", providerReference: document.providerDocumentId, bytes });
      manifest.push({ kind: "SIGNED_PDF", providerReference: document.providerDocumentId, sourceSha256: document.sourceSha256, sha256: finalHash });
    }
    for (const signer of [...state.signers].sort((a, b) => a.providerSignerId.localeCompare(b.providerSignerId))) {
      const remote = record(await this.#json(`/signature_requests/${requestId}/signers/${id(signer.providerSignerId)}`));
      if (id(remote.id) !== signer.providerSignerId || remote.status !== "signed" || signerFingerprint(remote) !== signer.identitySha256) fail("YOUSIGN_SIGNER_BINDING_MISMATCH");
      const bytes = await this.#bytes(`/signature_requests/${requestId}/signers/${id(signer.providerSignerId)}/audit_trails`, MAX_JSON_BYTES, "application/json");
      total += bytes.byteLength;
      let audit: Record<string, unknown>;
      try { audit = record(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))); } catch { return fail("YOUSIGN_EVIDENCE_INVALID"); }
      for (const [documentId, hashes] of validateAudit(audit, requestId, state, signer.providerSignerId, remote)) {
        const existing = auditedDocumentHashes.get(documentId) ?? new Set<string>();
        for (const hash of hashes) existing.add(hash);
        auditedDocumentHashes.set(documentId, existing);
      }
      if (total > MAX_TOTAL_BYTES) fail("YOUSIGN_EVIDENCE_INVALID");
      artifacts.push({ kind: "AUDIT_JSON", providerReference: signer.providerSignerId, bytes });
      manifest.push({ kind: "AUDIT_JSON", providerReference: signer.providerSignerId, sha256: sha(bytes) });
    }
    // An earlier signer may attest only an intermediate revision. At least one
    // authenticated audit must bind the exact final bytes for EACH source PDF.
    // The public reference does not fully define signatures[].hash semantics;
    // incompatible provider formats stay closed pending a real sandbox recipe.
    // These checks bind provider-attested artifacts; they do not validate PDF
    // certificates or trusted timestamps, and cannot satisfy those policies.
    for (const [documentId, finalHash] of finalDocumentHashes) {
      if (!auditedDocumentHashes.get(documentId)?.has(finalHash)) fail("YOUSIGN_FINAL_DOCUMENT_EVIDENCE_MISMATCH");
    }
    await this.#dependencies.state.archiveEvidence(requestId, artifacts);
    return { providerEnvelopeId: requestId, achievedLevel: "SIMPLE", finalHash: sha(JSON.stringify({ provider: this.code, sandbox: true, requestId, artifacts: manifest })), documentHashes: state.documents.map(document => document.sourceSha256) };
  }

  async #load(requestId: string): Promise<YousignProviderRequestState> {
    const state = await this.#dependencies.state.loadRequest(requestId);
    id(state.envelopeId);
    if (state.requestedLevel !== "SIMPLE" || !state.documents.length || state.documents.length > 50 || state.signers.length < 2 || state.signers.length > 100
      || new Set(state.documents.map(document => document.providerDocumentId)).size !== state.documents.length
      || new Set(state.signers.map(signer => signer.providerSignerId)).size !== state.signers.length
      || state.documents.some(document => !HASH.test(document.sourceSha256))
      || state.signers.some(signer => !HASH.test(signer.identitySha256))) fail("YOUSIGN_STATE_INVALID");
    for (const document of state.documents) id(document.providerDocumentId);
    for (const signer of state.signers) id(signer.providerSignerId);
    return state;
  }

  #matchesRequest(request: Record<string, unknown>, requestId: string, state: YousignProviderRequestState): void {
    if (id(request.id) !== requestId || request.external_id !== state.envelopeId || this.#dependencies.workspaceId && request.workspace_id !== this.#dependencies.workspaceId) fail("YOUSIGN_RESPONSE_ENVELOPE_MISMATCH");
    const documents = list(request.documents);
    const signers = list(request.signers);
    if (documents.length !== state.documents.length || signers.length !== state.signers.length
      || new Set(documents.map(document => document.id)).size !== documents.length || new Set(signers.map(signer => signer.id)).size !== signers.length
      || state.documents.some(document => !documents.some(remote => remote.id === document.providerDocumentId && remote.nature === "signable_document"))
      || state.signers.some(signer => !signers.some(remote => remote.id === signer.providerSignerId))) fail("YOUSIGN_EVIDENCE_BINDING_MISMATCH");
  }

  async #json(path: string, method: "GET" | "POST" = "GET", body?: Record<string, unknown> | FormData): Promise<unknown> {
    const bytes = await this.#request(path, MAX_JSON_BYTES, "application/json", method, body);
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { return fail("YOUSIGN_RESPONSE_INVALID"); }
  }

  async #bytes(path: string, maxBytes: number, accept: string): Promise<Uint8Array> {
    return this.#request(path, maxBytes, accept, "GET");
  }

  async #request(path: string, maxBytes: number, accept: string, method: "GET" | "POST", body?: Record<string, unknown> | FormData): Promise<Uint8Array> {
    if (!path.startsWith("/signature_requests") || path.startsWith("//") || path.includes("..") || path.includes("\\")) fail("YOUSIGN_PATH_INVALID");
    const form = body instanceof FormData;
    let response: Response;
    try {
      response = await this.#dependencies.fetch(BASE_URL + path, {
        method, redirect: "error", signal: AbortSignal.timeout(8000),
        headers: { authorization: `Bearer ${this.#dependencies.apiKey}`, accept, ...(body && !form ? { "content-type": "application/json" } : {}) },
        ...(body ? { body: form ? body : JSON.stringify(body) } : {}),
      });
    } catch { return fail("YOUSIGN_NETWORK_OUTCOME_UNKNOWN"); }
    if (!response.ok || response.redirected || !response.body || !(response.headers.get("content-type") ?? "").toLowerCase().includes(accept)) fail("YOUSIGN_PROVIDER_RESPONSE_REJECTED");
    const length = response.headers.get("content-length");
    if (length && (!/^\d+$/u.test(length) || Number(length) > maxBytes)) { await response.body.cancel(); fail("YOUSIGN_RESPONSE_TOO_LARGE"); }
    const reader = response.body.getReader();
    let total = 0;
    const parts: Uint8Array[] = [];
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        total += next.value.byteLength;
        if (total > maxBytes) { await reader.cancel(); fail("YOUSIGN_RESPONSE_TOO_LARGE"); }
        parts.push(next.value);
      }
    } catch (error) {
      if (error instanceof Error && error.message === "YOUSIGN_RESPONSE_TOO_LARGE") throw error;
      return fail("YOUSIGN_NETWORK_OUTCOME_UNKNOWN");
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    return bytes;
  }
}

import { createHash, createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { CreateEnvelopeInput } from "./provider.js";
import { YousignSandboxSignatureProvider, type YousignProviderRequestState, type YousignSandboxProviderDependencies } from "./yousign-provider.js";

const envelopeId = "10000000-0000-4000-8000-000000000001";
const requestId = "20000000-0000-4000-8000-000000000001";
const documentId = "30000000-0000-4000-8000-000000000001";
const signerId1 = "40000000-0000-4000-8000-000000000001";
const signerId2 = "40000000-0000-4000-8000-000000000002";
const eventId = "50000000-0000-4000-8000-000000000001";
const source = new TextEncoder().encode("%PDF-1.7\nsource contract\n%%EOF");
const sourceHash = createHash("sha256").update(source).digest("hex");
const input: CreateEnvelopeInput = {
  envelopeId, requestedLevel: "SIMPLE", idempotencyKey: "create-operation",
  documents: [{ contractVersionId: "v1", sha256: sourceHash, fileName: "contrat.pdf", storagePath: "private/v1.pdf" }],
  signers: [
    { signerId: "local-client", organizationId: "org-client", userId: "user-client", signingOrder: 2 },
    { signerId: "local-provider", organizationId: "org-provider", userId: "user-provider", signingOrder: 1 },
  ],
};
function remoteSigner(remoteId: string, localName: string) {
  return { id: remoteId, info: { first_name: localName, last_name: "Signer", email: `${localName}@example.test`, locale: "fr" }, signature_level: "electronic_signature", signature_authentication_mode: "otp_email", fields: [{ type: "signature", document_id: documentId, page: 1, x: 42, y: 100 }] };
}
function identityHash(localName: string) {
  return createHash("sha256").update(JSON.stringify({ firstName: localName, lastName: "Signer", email: `${localName}@example.test`, locale: "fr", level: "electronic_signature", authentication: "otp_email", fields: [{ type: "signature", document_id: documentId, page: 1, x: 42, y: 100 }] })).digest("hex");
}
function signerAudit(remoteId: string, localName: string, signedHash = "a".repeat(64)) {
  return { version: 5, signature_request: { id: requestId }, signer: { id: remoteId, first_name: localName, last_name: "Signer", email_address: `${localName}@example.test`, signature_process_completed_at: "2026-11-09T12:00:00Z" }, documents: [{ id: documentId, initial_hash: sourceHash, signatures: [{ hash: signedHash }] }], authentication: { mode: "email" }, electronic_signature_level: { level: "Simple electronic signature" } };
}
function signedMetadata(bytes: Uint8Array) {
  return { id: documentId, nature: "signable_document", content_type: "application/pdf", is_signed: true, sha256: createHash("sha256").update(bytes).digest("hex") };
}
const state: YousignProviderRequestState = {
  envelopeId, requestedLevel: "SIMPLE", documents: [{ sourceSha256: sourceHash, providerDocumentId: documentId }],
  signers: [{ signerId: "local-provider", providerSignerId: signerId1, identitySha256: identityHash("local-provider") }, { signerId: "local-client", providerSignerId: signerId2, identitySha256: identityHash("local-client") }],
};
function remoteRequest(status: string) {
  return { id: requestId, status, ordered_signers: true, external_id: envelopeId, documents: [{ id: documentId, nature: "signable_document" }], signers: state.signers.map(signer => ({ id: signer.providerSignerId, status: status === "done" ? "signed" : "initiated" })) };
}
const webhookSecret = "test-webhook-secret-only-32-characters";
const receivedAt = new Date("2026-11-09T12:00:00Z");
function json(value: unknown, status = 200) { return Response.json(value, { status }); }
function setup(responses: Response[] = []) {
  const fetch = vi.fn<typeof globalThis.fetch>();
  for (const response of responses) fetch.mockResolvedValueOnce(response);
  const dependencies: YousignSandboxProviderDependencies = {
    apiKey: "unit-test-only-key", webhookSecret, deploymentEnvironment: "STAGING", fetch,
    loadDocument: vi.fn().mockResolvedValue(source),
    loadSigner: vi.fn().mockImplementation(async signer => ({ firstName: signer.signerId, lastName: "Signer", email: `${signer.signerId}@example.test`, locale: "fr", fields: [{ documentSha256: sourceHash, page: 1, x: 42, y: 100 }] })),
    state: { saveRequest: vi.fn(), saveDocument: vi.fn(), saveSigner: vi.fn(), loadRequest: vi.fn().mockResolvedValue(state), archiveEvidence: vi.fn() },
  };
  return { dependencies, fetch, provider: new YousignSandboxSignatureProvider(dependencies) };
}
function rawEvent(overrides: Record<string, unknown> = {}) {
  return new TextEncoder().encode(JSON.stringify({
    event_id: eventId, event_name: "signer.done", event_time: String(receivedAt.getTime() / 1000), sandbox: true,
    subscription_id: "60000000-0000-4000-8000-000000000001",
    data: { signature_request: { id: requestId, status: "done", external_id: envelopeId }, signer: { id: signerId1, status: "signed" } },
    ...overrides,
  }));
}
function signed(raw: Uint8Array) { return { "X-Yousign-Signature-256": `sha256=${createHmac("sha256", webhookSecret).update(raw).digest("hex")}` }; }

describe("YouSign sandbox v3 adapter (HTTP contract unit tests, no live provider)", () => {
  it("prepares a real request, hashes source bytes, persists the remote ID before upload and keeps signer order", async () => {
    const { provider, fetch, dependencies } = setup([
      json({ data: [], meta: { next_cursor: null } }), json({ id: requestId, status: "draft" }, 201),
      json({ id: documentId, sha256: sourceHash, nature: "signable_document" }, 201),
      json(remoteSigner(signerId1, "local-provider"), 201), json(remoteSigner(signerId2, "local-client"), 201),
    ]);
    await expect(provider.createEnvelope(input)).resolves.toEqual({ providerEnvelopeId: requestId, requestedLevel: "SIMPLE", status: "READY_FOR_SIGNATURE" });
    expect(fetch).toHaveBeenCalledTimes(5);
    expect(String(fetch.mock.calls[0]?.[0])).toContain("external_id%5Beq%5D=" + envelopeId);
    const create = fetch.mock.calls[1]?.[1];
    expect(JSON.parse(String(create?.body))).toMatchObject({ external_id: envelopeId, ordered_signers: true, delivery_mode: "email" });
    const upload = fetch.mock.calls[2]?.[1]?.body as FormData;
    expect(upload.get("nature")).toBe("signable_document");
    expect(await (upload.get("file") as Blob).arrayBuffer()).toEqual(source.buffer);
    const firstSigner = JSON.parse(String(fetch.mock.calls[3]?.[1]?.body));
    expect(firstSigner).toMatchObject({ info: { first_name: "local-provider" }, signature_authentication_mode: "otp_email", fields: [{ document_id: documentId, page: 1, x: 42, y: 100 }] });
    expect(vi.mocked(dependencies.state.saveRequest).mock.invocationCallOrder[0]).toBeLessThan(fetch.mock.invocationCallOrder[2]!);
    expect(dependencies.state.saveDocument).toHaveBeenCalledWith(requestId, sourceHash, documentId);
    expect(dependencies.state.saveSigner).toHaveBeenCalledWith(requestId, "local-provider", signerId1, identityHash("local-provider"));
    for (const [url, options] of fetch.mock.calls) {
      expect(String(url)).toMatch(/^https:\/\/api-sandbox\.yousign\.app\/v3\/signature_requests/u);
      expect(options?.redirect).toBe("error");
      expect(options?.signal).toBeInstanceOf(AbortSignal);
      expect(options?.headers).not.toHaveProperty("idempotency-key");
    }
  });

  it("does not recreate a request found by external_id", async () => {
    const { provider, fetch, dependencies } = setup([json({ data: [{ id: requestId }], meta: { next_cursor: null } })]);
    await expect(provider.createEnvelope(input)).rejects.toThrow("YOUSIGN_RECONCILIATION_REQUIRED");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(dependencies.state.saveRequest).not.toHaveBeenCalled();
  });

  it("keeps the durable remote reference on an unknown upload outcome without retrying provider POSTs", async () => {
    const { provider, fetch, dependencies } = setup([json({ data: [], meta: { next_cursor: null } }), json({ id: requestId, status: "draft" }, 201)]);
    fetch.mockRejectedValueOnce(new Error("sensitive-provider-error-that-must-not-be-exposed"));
    await expect(provider.createEnvelope(input)).rejects.toThrow(/^YOUSIGN_NETWORK_OUTCOME_UNKNOWN$/u);
    expect(dependencies.state.saveRequest).toHaveBeenCalledWith(envelopeId, requestId, "SIMPLE");
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("rejects source mismatch or missing explicit signer positions before any provider request", async () => {
    const first = setup();
    vi.mocked(first.dependencies.loadDocument).mockResolvedValue(new TextEncoder().encode("%PDF-wrong"));
    await expect(first.provider.createEnvelope(input)).rejects.toThrow("YOUSIGN_SOURCE_DOCUMENT_HASH_MISMATCH");
    expect(first.fetch).not.toHaveBeenCalled();
    const second = setup();
    vi.mocked(second.dependencies.loadSigner).mockResolvedValue({ firstName: "A", lastName: "B", email: "a@example.test", locale: "fr", fields: [] });
    await expect(second.provider.createEnvelope(input)).rejects.toThrow("YOUSIGN_SIGNER_PREPARATION_REQUIRED");
    expect(second.fetch).not.toHaveBeenCalled();
  });

  it("rejects provider document hash mismatch and does not activate or add signers", async () => {
    const { provider, fetch, dependencies } = setup([json({ data: [], meta: { next_cursor: null } }), json({ id: requestId, status: "draft" }, 201), json({ id: documentId, nature: "signable_document", sha256: "a".repeat(64) }, 201)]);
    await expect(provider.createEnvelope(input)).rejects.toThrow("YOUSIGN_PROVIDER_DOCUMENT_HASH_MISMATCH");
    expect(dependencies.state.saveDocument).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("activates only a matching draft and reports SENT instead of claiming signed", async () => {
    const { provider, fetch } = setup([json(remoteRequest("draft")), json(remoteSigner(signerId1, "local-provider")), json(remoteSigner(signerId2, "local-client")), json({ id: documentId, sha256: sourceHash, nature: "signable_document", content_type: "application/pdf", is_signed: false, excluded_signers: [] }), json({ id: requestId, status: "ongoing" }, 201)]);
    await expect(provider.sendEnvelope(requestId, "send")).resolves.toMatchObject({ status: "SENT", requestedLevel: "SIMPLE" });
    expect(fetch.mock.calls[4]?.[0]).toBe(`https://api-sandbox.yousign.app/v3/signature_requests/${requestId}/activate`);
  });

  it("does not re-activate an ongoing request or cancel a completed request", async () => {
    for (const [operation, status] of [["send", "ongoing"], ["void", "done"]] as const) {
      const { provider, fetch } = setup([json(remoteRequest(status))]);
      await expect(operation === "send" ? provider.sendEnvelope(requestId, "key") : provider.voidEnvelope(requestId, "key")).rejects.toThrow("YOUSIGN_RECONCILIATION_REQUIRED");
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  });

  it("cancels only an ongoing request with the documented cancellation reason", async () => {
    const { provider, fetch } = setup([json(remoteRequest("ongoing")), json({ id: requestId, status: "canceled" }, 201)]);
    await expect(provider.voidEnvelope(requestId, "void")).resolves.toMatchObject({ status: "VOIDED" });
    expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))).toEqual({ reason: "contractualization_aborted" });
  });

  it("verifies the raw-body HMAC, signed sandbox and signer mapping with case-insensitive headers", async () => {
    const { provider, fetch } = setup();
    const raw = rawEvent();
    await expect(provider.verifyWebhook(raw, signed(raw), receivedAt)).resolves.toMatchObject({ providerEventId: eventId, nonce: eventId, providerEnvelopeId: requestId, type: "SIGNER_SIGNED", signerId: "local-provider", achievedLevel: "SIMPLE", finalEvidenceRequired: true, payloadSha256: createHash("sha256").update(raw).digest("hex") });
    expect(fetch).not.toHaveBeenCalled();
    await expect(provider.verifyWebhook(rawEvent({ sandbox: false }), signed(raw), receivedAt)).rejects.toThrow("YOUSIGN_WEBHOOK_SIGNATURE_INVALID");
  });

  it("does not request final evidence from an authenticated intermediate signing event", async () => {
    const { provider } = setup();
    const raw = rawEvent({ data: { signature_request: { id: requestId, status: "ongoing", external_id: envelopeId }, signer: { id: signerId1, status: "signed" } } });
    const event = await provider.verifyWebhook(raw, signed(raw), receivedAt);
    expect(event.type).toBe("SIGNER_SIGNED");
    expect(event).not.toHaveProperty("finalEvidenceRequired");
  });

  it("rejects signatures using the wrong timestamp-dot-body algorithm and ambiguous duplicate headers", async () => {
    const { provider } = setup();
    const raw = rawEvent();
    const wrong = createHmac("sha256", webhookSecret).update("1794225600.").update(raw).digest("hex");
    await expect(provider.verifyWebhook(raw, { "x-yousign-signature-256": `sha256=${wrong}` }, receivedAt)).rejects.toThrow("YOUSIGN_WEBHOOK_SIGNATURE_INVALID");
    await expect(provider.verifyWebhook(raw, { ...signed(raw), "x-yousign-signature-256": signed(raw)["X-Yousign-Signature-256"]! }, receivedAt)).rejects.toThrow("YOUSIGN_WEBHOOK_SIGNATURE_INVALID");
  });

  it.each([
    [{ sandbox: false }, "YOUSIGN_WEBHOOK_INVALID"],
    [{ event_time: String(receivedAt.getTime() / 1000 - 301) }, "YOUSIGN_WEBHOOK_STALE"],
    [{ event_time: String(receivedAt.getTime() / 1000 + 31) }, "YOUSIGN_WEBHOOK_STALE"],
    [{ event_name: "signature_request.done" }, "YOUSIGN_WEBHOOK_EVENT_UNSUPPORTED"],
    [{ event_id: "../unknown" }, "YOUSIGN_REFERENCE_INVALID"],
  ])("fails closed for invalid or unsupported authenticated webhook %#", async (change, code) => {
    const { provider } = setup();
    const raw = rawEvent(change as Record<string, unknown>);
    await expect(provider.verifyWebhook(raw, signed(raw), receivedAt)).rejects.toThrow(String(code));
  });

  it("rejects a signer ID belonging to another envelope", async () => {
    const { provider } = setup();
    const raw = rawEvent({ data: { signature_request: { id: requestId, status: "done" }, signer: { id: "40000000-0000-4000-8000-999999999999", status: "signed" } } });
    await expect(provider.verifyWebhook(raw, signed(raw), receivedAt)).rejects.toThrow("YOUSIGN_WEBHOOK_SIGNER_MISMATCH");
  });

  it.each(["email", "field", "level", "authentication"])("rejects a provider-side %s edit before sending", async change => {
    const modified = remoteSigner(signerId1, "local-provider");
    if (change === "email") modified.info.email = "attacker@example.test";
    if (change === "field") modified.fields[0]!.page = 2;
    if (change === "level") modified.signature_level = "qualified_electronic_signature";
    if (change === "authentication") modified.signature_authentication_mode = "no_otp";
    const { provider, fetch } = setup([json(remoteRequest("draft")), json(modified)]);
    await expect(provider.sendEnvelope(requestId, "send")).rejects.toThrow("YOUSIGN_SIGNER_BINDING_MISMATCH");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.some(call => String(call[0]).endsWith("/activate"))).toBe(false);
  });

  it("rejects extra provider documents added after the governed request was prepared", async () => {
    const modified = remoteRequest("draft");
    modified.documents.push({ id: "30000000-0000-4000-8000-000000000002", nature: "signable_document" });
    const { provider, fetch } = setup([json(modified)]);
    await expect(provider.sendEnvelope(requestId, "send")).rejects.toThrow("YOUSIGN_EVIDENCE_BINDING_MISMATCH");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects provider-side signer reordering or source hash changes before activation", async () => {
    const reordered = remoteRequest("draft");
    reordered.signers.reverse();
    const first = setup([json(reordered)]);
    await expect(first.provider.sendEnvelope(requestId, "send")).rejects.toThrow("YOUSIGN_SIGNER_ORDER_MISMATCH");
    expect(first.fetch).toHaveBeenCalledTimes(1);
    const second = setup([json(remoteRequest("draft")), json(remoteSigner(signerId1, "local-provider")), json(remoteSigner(signerId2, "local-client")), json({ id: documentId, sha256: "b".repeat(64), nature: "signable_document", content_type: "application/pdf", is_signed: false, excluded_signers: [] })]);
    await expect(second.provider.sendEnvelope(requestId, "send")).rejects.toThrow("YOUSIGN_PROVIDER_DOCUMENT_HASH_MISMATCH");
    expect(second.fetch.mock.calls.some(call => String(call[0]).endsWith("/activate"))).toBe(false);
  });

  it("binds the final PDF to signed metadata and the later signer's audit, accepting an earlier intermediate hash", async () => {
    const pdf = new TextEncoder().encode("%PDF-1.7\nsigned provider bytes\n%%EOF");
    const audit1 = signerAudit(signerId1, "local-provider");
    const audit2 = signerAudit(signerId2, "local-client", createHash("sha256").update(pdf).digest("hex"));
    const { provider, fetch, dependencies } = setup([
      json({ id: requestId, external_id: envelopeId, status: "done", documents: [{ id: documentId, nature: "signable_document" }], signers: state.signers.map(s => ({ id: s.providerSignerId, status: "signed" })) }),
      json(signedMetadata(pdf)),
      new Response(pdf, { headers: { "content-type": "application/pdf" } }),
      json({ ...remoteSigner(signerId1, "local-provider"), status: "signed" }), json(audit1),
      json({ ...remoteSigner(signerId2, "local-client"), status: "signed" }), json(audit2),
    ]);
    const evidence = await provider.fetchEvidencePackage(requestId);
    expect(evidence).toMatchObject({ providerEnvelopeId: requestId, achievedLevel: "SIMPLE", documentHashes: [sourceHash], finalHash: expect.stringMatching(/^[a-f0-9]{64}$/u) });
    expect(evidence).not.toHaveProperty("certificateFingerprint");
    expect(evidence).not.toHaveProperty("timestampTokenHash");
    const artifacts = vi.mocked(dependencies.state.archiveEvidence).mock.calls[0]?.[1];
    expect(artifacts).toHaveLength(3);
    expect(artifacts?.[0]).toMatchObject({ kind: "SIGNED_PDF", providerReference: documentId, bytes: pdf });
    expect(JSON.parse(new TextDecoder().decode(artifacts?.[1]?.bytes))).toEqual(audit1);
    expect(fetch.mock.calls[1]?.[0]).toBe(`https://api-sandbox.yousign.app/v3/signature_requests/${requestId}/documents/${documentId}`);
    expect(fetch.mock.calls[2]?.[0]).toContain(`/documents/${documentId}/download`);
    expect(fetch.mock.calls[4]?.[0]).toContain(`/signers/${signerId1}/audit_trails`);
  });

  it("does not archive incomplete or unrelated provider evidence", async () => {
    const { provider, fetch, dependencies } = setup([json({ id: requestId, external_id: envelopeId, status: "done", documents: [], signers: [] })]);
    await expect(provider.fetchEvidencePackage(requestId)).rejects.toThrow("YOUSIGN_EVIDENCE_BINDING_MISMATCH");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(dependencies.state.archiveEvidence).not.toHaveBeenCalled();
  });

  it.each(["request", "source", "signer", "level"])("rejects an audit for another %s before archiving or returning evidence", async change => {
    const audit = signerAudit(signerId1, "local-provider");
    if (change === "request") audit.signature_request.id = "20000000-0000-4000-8000-000000000002";
    if (change === "source") audit.documents[0]!.initial_hash = "b".repeat(64);
    if (change === "signer") audit.signer.email_address = "attacker@example.test";
    if (change === "level") audit.electronic_signature_level.level = "Qualified electronic signature";
    const pdf = new TextEncoder().encode("%PDF-1.7\nsigned bytes\n%%EOF");
    const { provider, dependencies } = setup([json(remoteRequest("done")), json(signedMetadata(pdf)), new Response(pdf, { headers: { "content-type": "application/pdf" } }), json({ ...remoteSigner(signerId1, "local-provider"), status: "signed" }), json(audit)]);
    await expect(provider.fetchEvidencePackage(requestId)).rejects.toThrow("YOUSIGN_AUDIT_BINDING_MISMATCH");
    expect(dependencies.state.archiveEvidence).not.toHaveBeenCalled();
  });

  it("rejects arbitrary final PDF bytes whose digest appears in none of the authenticated audits", async () => {
    const pdf = new TextEncoder().encode("%PDF-1.7\nunrelated signed-looking bytes\n%%EOF");
    const { provider, dependencies } = setup([
      json(remoteRequest("done")), json(signedMetadata(pdf)), new Response(pdf, { headers: { "content-type": "application/pdf" } }),
      json({ ...remoteSigner(signerId1, "local-provider"), status: "signed" }), json(signerAudit(signerId1, "local-provider")),
      json({ ...remoteSigner(signerId2, "local-client"), status: "signed" }), json(signerAudit(signerId2, "local-client")),
    ]);
    await expect(provider.fetchEvidencePackage(requestId)).rejects.toThrow("YOUSIGN_FINAL_DOCUMENT_EVIDENCE_MISMATCH");
    expect(dependencies.state.archiveEvidence).not.toHaveBeenCalled();
  });

  it("rejects an unchanged source PDF when metadata attests a different signed version", async () => {
    const signed = new TextEncoder().encode("%PDF-1.7\nactually completed version\n%%EOF");
    const { provider, dependencies, fetch } = setup([json(remoteRequest("done")), json(signedMetadata(signed)), new Response(source, { headers: { "content-type": "application/pdf" } })]);
    await expect(provider.fetchEvidencePackage(requestId)).rejects.toThrow("YOUSIGN_FINAL_DOCUMENT_EVIDENCE_MISMATCH");
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(dependencies.state.archiveEvidence).not.toHaveBeenCalled();
  });

  it("rejects source metadata claiming no completed signature before downloading", async () => {
    const { provider, dependencies, fetch } = setup([json(remoteRequest("done")), json({ ...signedMetadata(source), is_signed: false })]);
    await expect(provider.fetchEvidencePackage(requestId)).rejects.toThrow("YOUSIGN_FINAL_DOCUMENT_EVIDENCE_MISMATCH");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(dependencies.state.archiveEvidence).not.toHaveBeenCalled();
  });

  it("bounds provider responses and never exposes a provider error body", async () => {
    const large = setup([new Response("", { headers: { "content-type": "application/json", "content-length": String(1024 * 1024 + 1) } })]);
    await expect(large.provider.createEnvelope(input)).rejects.toThrow("YOUSIGN_RESPONSE_TOO_LARGE");
    const rejected = setup([new Response("SECRET-DETAIL-DO-NOT-EXPOSE", { status: 401, headers: { "content-type": "application/json" } })]);
    await expect(rejected.provider.createEnvelope(input)).rejects.toThrow(/^YOUSIGN_PROVIDER_RESPONSE_REJECTED$/u);
    await expect(rejected.provider.sendEnvelope("https://attacker.test/", "key")).rejects.toThrow("YOUSIGN_REFERENCE_INVALID");
  });

  it("rejects production, unsupported levels and unsafe runtime credentials", async () => {
    const { provider, dependencies, fetch } = setup();
    expect(() => new YousignSandboxSignatureProvider({ ...dependencies, deploymentEnvironment: "PRODUCTION" as "STAGING" })).toThrow("YOUSIGN_SANDBOX_DEPLOYMENT_REQUIRED");
    expect(() => new YousignSandboxSignatureProvider({ ...dependencies, apiKey: "header\ninjection" })).toThrow("YOUSIGN_CREDENTIALS_INVALID");
    expect(() => new YousignSandboxSignatureProvider({ ...dependencies, webhookMaxAgeSeconds: 901 })).toThrow("YOUSIGN_WEBHOOK_TOLERANCE_INVALID");
    await expect(provider.createEnvelope({ ...input, requestedLevel: "QUALIFIED" })).rejects.toThrow("SIGNATURE_LEVEL_NOT_SUPPORTED");
    expect(fetch).not.toHaveBeenCalled();
  });
});

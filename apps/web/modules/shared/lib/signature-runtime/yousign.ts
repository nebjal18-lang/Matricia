import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { createSignatureWorkflow, YousignSignatureProvider, type SignatureWorkflowEnvelope, type SignatureWorkflowRepository, type YousignProviderRequestState, type YousignProviderState } from "@matricia/signature-v41";
import { getPlatformRuntimeEnvironment } from "@/modules/shared/lib/platform-configuration/runtime";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";

const uuid = z.string().uuid();
const hash = z.string().regex(/^[a-f0-9]{64}$/u);
const level = z.enum(["SIMPLE", "ADVANCED", "QUALIFIED"]);
const identity = z.object({
  signerId: uuid, firstName: z.string().min(1).max(100), lastName: z.string().min(1).max(100), email: z.string().email(), locale: z.enum(["fr", "en"]),
  fields: z.array(z.object({ documentSha256: hash, page: z.number().int().min(1).max(9999), x: z.number().int().min(0).max(9999), y: z.number().int().min(0).max(9999) })).min(1).max(10),
});
const contextSchema = z.object({
  input: z.object({
    envelopeId: uuid, requestedLevel: level, idempotencyKey: z.string().min(8),
    documents: z.array(z.object({ contractVersionId: uuid, sha256: hash, fileName: z.string().min(1), storagePath: z.string().min(1) })).min(1),
    signers: z.array(z.object({ signerId: uuid, organizationId: uuid, userId: uuid, signingOrder: z.number().int().positive() })).min(2),
  }),
  providerCode: z.literal("YOUSIGN"), providerEnvelopeId: uuid.nullish(),
  evidencePolicy: z.object({ version: uuid, requireCertificate: z.boolean(), requireTrustedTimestamp: z.boolean() }),
  remainingSignerIds: z.array(uuid), identities: z.array(identity),
  state: z.object({ envelopeId: uuid, requestedLevel: level, documents: z.array(z.object({ sourceSha256: hash, providerDocumentId: uuid })), signers: z.array(z.object({ signerId: uuid, providerSignerId: uuid, identitySha256: hash })) }),
});
type Context = z.infer<typeof contextSchema>;
type Admin = ReturnType<typeof getSupabaseAdminClient>;
function digest(bytes: Uint8Array) { return createHash("sha256").update(bytes).digest("hex"); }
function envelope(context: Context): SignatureWorkflowEnvelope {
  return { input: context.input, providerCode: context.providerCode, evidencePolicy: context.evidencePolicy, remainingSignerIds: context.remainingSignerIds, ...(context.providerEnvelopeId ? { providerEnvelopeId: context.providerEnvelopeId } : {}) };
}
async function rpc(admin: Admin, name: string, args: Record<string, unknown>) {
  const result = await admin.rpc(name, args);
  if (result.error) throw new Error("YOUSIGN_REPOSITORY_UNAVAILABLE");
  return result.data as unknown;
}

/** Fixed provider endpoints, separate APP_ENV, and governed database policy all
 * have to agree. NODE_ENV=production alone is normal for a Vercel preview. */
export async function createYousignRuntime() {
  const env = await getPlatformRuntimeEnvironment(process.env, ["YOUSIGN"]);
  const configured = env.APP_ENV?.trim().toUpperCase();
  const apiEnvironment = env.YOUSIGN_ENVIRONMENT;
  const sandbox = apiEnvironment === "sandbox" && ["STAGING", "DEVELOPMENT"].includes(configured ?? "");
  const live = apiEnvironment === "live" && configured === "PRODUCTION";
  if ((!sandbox && !live) || env.SIGNATURE_PROVIDER_MODE !== "EXTERNAL" || env.SIGNATURE_PROVIDER_CODE !== "YOUSIGN") throw new Error("YOUSIGN_CONFIGURATION_REQUIRED");
  const deploymentEnvironment = configured as "STAGING" | "DEVELOPMENT" | "PRODUCTION";
  const admin = getSupabaseAdminClient({ timeoutMs: 10_000 });
  // A caller-controlled APP_ENV can never relabel the trusted database. This
  // check occurs before constructing an HTTP adapter or making provider calls.
  if (await rpc(admin, "get_yousign_runtime_environment_v1", {}) !== deploymentEnvironment) throw new Error("YOUSIGN_DEPLOYMENT_ENVIRONMENT_MISMATCH");
  const deadline = AbortSignal.timeout(48_000);
  const getContext = async (args: { p_envelope_id?: string; p_provider_request_id?: string }) => contextSchema.parse(await rpc(admin, "get_yousign_envelope_v1", args));
  let activeContext: Context | undefined;
  const reference = async (id: string, kind: string, remote: string, local?: string, identitySha256?: string) => {
    if (await rpc(admin, "record_yousign_reference_v1", { p_envelope_id: id, p_kind: kind, p_reference: remote, ...(local ? { p_local_reference: local } : {}), ...(identitySha256 ? { p_identity_sha256: identitySha256 } : {}) }) !== true) throw new Error("YOUSIGN_REFERENCE_NOT_PERSISTED");
  };
  const state: YousignProviderState = {
    async saveRequest(id, remote, requestedLevel) {
      if (requestedLevel !== "SIMPLE" || activeContext?.input.envelopeId !== id) throw new Error("YOUSIGN_REFERENCE_SCOPE_INVALID");
      await reference(id, "REQUEST", remote);
    },
    async saveDocument(remote, source, document) {
      const context = await getContext({ p_provider_request_id: remote });
      await reference(context.input.envelopeId, "DOCUMENT", document, source);
    },
    async saveSigner(remote, signer, providerSigner, identitySha256) {
      const context = await getContext({ p_provider_request_id: remote });
      await reference(context.input.envelopeId, "SIGNER", providerSigner, signer, identitySha256);
    },
    async loadRequest(remote): Promise<YousignProviderRequestState> {
      return (await getContext({ p_provider_request_id: remote })).state;
    },
    async archiveEvidence(remote, artifacts) {
      const context = await getContext({ p_provider_request_id: remote });
      const bucket = admin.storage.from("signature-provider-evidence");
      for (const artifact of artifacts) {
        const sha = digest(artifact.bytes), pdf = artifact.kind === "SIGNED_PDF";
        const path = `${context.input.envelopeId}/${artifact.kind.toLowerCase()}/${artifact.providerReference}/${sha}.${pdf ? "pdf" : "json"}`;
        await bucket.upload(path, artifact.bytes, { contentType: pdf ? "application/pdf" : "application/json", upsert: false });
        // A duplicate is valid only after an actual immutable readback. Other
        // upload failures cannot be converted into an invented archive receipt.
        const downloaded = await bucket.download(path);
        if (downloaded.error || !downloaded.data) throw new Error("YOUSIGN_EVIDENCE_ARCHIVE_UNAVAILABLE");
        const readback = new Uint8Array(await downloaded.data.arrayBuffer());
        if (readback.byteLength !== artifact.bytes.byteLength || digest(readback) !== sha) throw new Error("YOUSIGN_EVIDENCE_ARCHIVE_HASH_MISMATCH");
        if (await rpc(admin, "record_yousign_native_artifact_v1", { p_envelope_id: context.input.envelopeId, p_kind: artifact.kind, p_provider_reference: artifact.providerReference, p_sha256: sha, p_storage_path: path }) !== true) throw new Error("YOUSIGN_EVIDENCE_ARCHIVE_NOT_RECORDED");
      }
    },
  };
  const provider = new YousignSignatureProvider({
    apiKey: env.YOUSIGN_API_KEY ?? "", webhookSecret: env.YOUSIGN_WEBHOOK_SECRET ?? "", deploymentEnvironment, apiEnvironment: sandbox ? "sandbox" : "live",
    ...(env.YOUSIGN_WORKSPACE_ID ? { workspaceId: env.YOUSIGN_WORKSPACE_ID } : {}),
    fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.any([deadline, ...(init?.signal ? [init.signal] : [])]) }),
    async loadDocument(document) {
      if (!activeContext?.input.documents.some(current => current.sha256 === document.sha256 && current.storagePath === document.storagePath && current.contractVersionId === document.contractVersionId)) throw new Error("YOUSIGN_DOCUMENT_SCOPE_INVALID");
      const result = await admin.storage.from("signature-source-documents").download(document.storagePath);
      if (result.error || !result.data || result.data.size > 20 * 1024 * 1024) throw new Error("YOUSIGN_SOURCE_DOCUMENT_UNAVAILABLE");
      return new Uint8Array(await result.data.arrayBuffer());
    },
    async loadSigner(signer) {
      const found = activeContext?.identities.find(current => current.signerId === signer.signerId);
      if (!found) throw new Error("YOUSIGN_EXPLICIT_SIGNER_CONFIGURATION_REQUIRED");
      return found;
    }, state,
  });
  const repository: SignatureWorkflowRepository = {
    async beginOperation(id, operation, key) {
      const result = z.object({ outcome: z.enum(["CLAIMED", "COMPLETED", "RECONCILIATION_REQUIRED"]), envelope: contextSchema.optional() }).parse(await rpc(admin, "begin_yousign_dispatch_v1", { p_envelope_id: id, p_operation: operation, p_key: key }));
      if (result.outcome !== "CLAIMED") return { outcome: result.outcome };
      if (!result.envelope) throw new Error("YOUSIGN_CLAIM_CONTEXT_REQUIRED");
      activeContext = result.envelope;
      return { outcome: "CLAIMED", envelope: envelope(result.envelope) };
    },
    async recordProviderReference(id, code, remote) {
      if (code !== "YOUSIGN") throw new Error("YOUSIGN_PROVIDER_MISMATCH");
      await reference(id, "REQUEST", remote);
    },
    async recordOperationAccepted(id, operation, key) {
      if (await rpc(admin, "finish_yousign_dispatch_v1", { p_envelope_id: id, p_operation: operation, p_key: key, p_outcome: "ACCEPTED" }) !== true) throw new Error("YOUSIGN_OPERATION_NOT_RECORDED");
    },
    async recordOperationUnknown(id, operation, key) {
      if (await rpc(admin, "finish_yousign_dispatch_v1", { p_envelope_id: id, p_operation: operation, p_key: key, p_outcome: "UNKNOWN" }) !== true) throw new Error("YOUSIGN_OPERATION_NOT_RECORDED");
    },
    async resolveProviderEnvelope(code, remote) {
      if (code !== "YOUSIGN") throw new Error("YOUSIGN_PROVIDER_MISMATCH");
      return envelope(await getContext({ p_provider_request_id: remote }));
    },
    async recordVerifiedEvent(current, event, evidence) {
      const result = z.object({ replayed: z.boolean() }).passthrough().parse(await rpc(admin, "record_yousign_verified_event_v1", { p_envelope_id: current.input.envelopeId, p_event: event, p_evidence: evidence ?? null }));
      return { replayed: result.replayed };
    },
  };
  return createSignatureWorkflow({ provider, repository, env });
}

const NON_RETRYABLE_SIGNATURE_CODES = [
  "YOUSIGN_CONFIGURATION_REQUIRED",
  "YOUSIGN_DEPLOYMENT_ENVIRONMENT_MISMATCH",
  "SIGNATURE_PROVIDER_NOT_CONFIGURED",
  "SIGNATURE_PROVIDER_CODE_MISMATCH",
  "SIGNATURE_DEVELOPMENT_PROVIDER_FORBIDDEN",
  "SIGNATURE_PROVIDER_MODE_INVALID",
  "SIGNATURE_SANDBOX_PROVIDER_FORBIDDEN",
  "YOUSIGN_EXPLICIT_SIGNER_CONFIGURATION_REQUIRED",
] as const;

function signatureFailureCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return NON_RETRYABLE_SIGNATURE_CODES.find((code) => message.includes(code))
    ?? "SIGNATURE_PROVIDER_DISPATCH_UNAVAILABLE";
}

export async function consumeGovernedSignatureEnvelope(envelopeId: string): Promise<{ ok: boolean; code: string; developmentMock: boolean }> {
  if (!uuid.safeParse(envelopeId).success) return { ok: false, code: "SIGNATURE_ENVELOPE_PAYLOAD_INVALID", developmentMock: false };
  try {
    const admin = getSupabaseAdminClient({ timeoutMs: 5_000 });
    const code = await rpc(admin, "get_signature_dispatch_provider_v1", { p_envelope_id: envelopeId });
    if (code === "YOUSIGN") {
      const result = await (await createYousignRuntime()).execute(envelopeId, "SEND", `yousign-send:${envelopeId}`);
      return { ok: result.outcome === "COMPLETED" || result.outcome === "AWAITING_VERIFIED_WEBHOOK", code: result.outcome === "COMPLETED" ? "SIGNATURE_DISPATCH_ACCEPTED_REPLAY" : result.outcome === "AWAITING_VERIFIED_WEBHOOK" ? "SIGNATURE_AWAITING_VERIFIED_WEBHOOK" : "SIGNATURE_RECONCILIATION_REQUIRED", developmentMock: false };
    }
    // The existing SQL mock retains its own trusted-environment/governance gate.
    if (code !== "MATRICIA_DEV_MOCK") return { ok: false, code: "SIGNATURE_PROVIDER_NOT_REGISTERED", developmentMock: false };
    const result = z.object({ outcome: z.string() }).passthrough().parse(await rpc(admin, "dispatch_governed_signature_envelope_v1", { p_envelope_id: envelopeId }));
    // CANCELLED is a terminal governed outcome: acknowledge so the outbox does not retry forever.
    return { ok: ["SIGNATURE_ENVELOPE_SENT", "SIGNATURE_DISPATCH_CANCELLED"].includes(result.outcome), code: result.outcome, developmentMock: true };
  } catch (error) {
    // Surface the exact configuration/policy code; outbox still returns 503 until ops remediates.
    return { ok: false, code: signatureFailureCode(error), developmentMock: false };
  }
}

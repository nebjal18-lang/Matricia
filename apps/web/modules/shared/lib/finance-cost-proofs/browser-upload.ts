import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export const financeCostComponentSchema = z.enum(["PSP_FEE", "FULFILLMENT_COST"]);
export type FinanceCostComponent = z.infer<typeof financeCostComponentSchema>;
export const financeCostScanSchema = z.enum(["PENDING", "CLEAN", "REJECTED", "ERROR"]);
export type FinanceCostScanStatus = z.infer<typeof financeCostScanSchema>;
export const financeCostUploadContextSchema = z.object({
  upload_id: z.string().uuid(),
  bucket: z.literal("finance-cost-proofs"),
  path: z.string().regex(/^finance-cost\/[0-9a-f-]{36}$/i),
  status: z.enum(["RESERVED", "UPLOADED"]),
  scan_status: financeCostScanSchema,
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  size_bytes: z.number().int().positive().max(10 * 1024 * 1024),
  mime_type: z.enum(["application/pdf", "image/jpeg", "image/png"]),
});
export type FinanceCostUploadContext = z.infer<typeof financeCostUploadContextSchema>;
export type FinanceCostProofFailure = "VALIDATION" | "INVALID_FILE" | "UNAUTHENTICATED" | "MFA_REQUIRED" | "FORBIDDEN" | "CONFLICT" | "INVALID_RESPONSE" | "RESERVATION_FAILED" | "UPLOAD_FAILED" | "UPLOAD_UNCONFIRMED" | "CONNECTION_INTERRUPTED" | "READ_FAILED";
export type FinanceCostUploadResult = { ok: true; upload: FinanceCostUploadContext } | { ok: false; code: FinanceCostProofFailure; uploadId?: string };
export type FinanceCostFileMetadata = { sha256: string; sizeBytes: number; mimeType: "application/pdf" | "image/jpeg" | "image/png"; fileName: string };
export type FinanceCostUploadPhase = "HASHING" | "RESERVING" | "UPLOADING" | "VERIFYING";

const signatures: Record<FinanceCostFileMetadata["mimeType"], readonly number[]> = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46, 0x2d],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};
const toHex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");

/** A replay key identifies the same actor, target and actual bytes across reloads; it never grants access. */
export async function financeCostUploadReplayKey(actorId: string, component: FinanceCostComponent, targetId: string, metadata: FinanceCostFileMetadata) {
  if (!z.string().uuid().safeParse(actorId).success || !z.string().uuid().safeParse(targetId).success || !financeCostComponentSchema.safeParse(component).success) throw new Error("INVALID_FINANCE_COST_SCOPE");
  const digest = toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(["MATRICIA_FINANCE_COST_UPLOAD_V1", actorId, component, targetId, metadata.sha256, metadata.sizeBytes, metadata.mimeType, metadata.fileName]))));
  // RFC 9562 UUIDv8: application-specific SHA-256 data, with the standard variant.
  const variant = ((Number.parseInt(digest[16]!, 16) & 3) | 8).toString(16);
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-8${digest.slice(13, 16)}-${variant}${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

export async function inspectFinanceCostFile(file: File): Promise<FinanceCostFileMetadata | null> {
  if (file.size < 1 || file.size > 10 * 1024 * 1024 || file.name.trim().length < 1 || file.name.length > 180 || !Object.hasOwn(signatures, file.type)) return null;
  const mimeType = file.type as FinanceCostFileMetadata["mimeType"];
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength !== file.size || !signatures[mimeType].every((byte, index) => new Uint8Array(bytes)[index] === byte)) return null;
  return { sha256: toHex(await crypto.subtle.digest("SHA-256", bytes)), sizeBytes: bytes.byteLength, mimeType, fileName: file.name };
}

function rpcFailure(error: { code?: string; message?: string } | null, fallback: FinanceCostProofFailure): FinanceCostProofFailure {
  if (!error) return fallback;
  if (error.code === "42501") return /(?:MFA|AAL2)/i.test(error.message ?? "") ? "MFA_REQUIRED" : "FORBIDDEN";
  if (error.code === "PGRST301" || error.code === "PGRST303") return "UNAUTHENTICATED";
  if (["40001", "23505", "22000"].includes(error.code ?? "")) return "CONFLICT";
  return fallback;
}

/** Only a server code can distinguish a missing second factor from an unrelated HTTP403. */
export async function financeCostHttpPrerequisite(response:Response):Promise<"UNAUTHENTICATED"|"MFA_REQUIRED"|"FORBIDDEN"|null> {
  if(response.status===401)return "UNAUTHENTICATED";
  if(response.status!==403)return null;
  try{const body=z.object({code:z.string()}).safeParse(await response.json());if(body.success&&body.data.code==="FINANCE_COST_MFA_REQUIRED")return "MFA_REQUIRED";}catch{/* A denied response may have no JSON body. */}
  return "FORBIDDEN";
}

export async function readFinanceCostUpload(client: SupabaseClient, uploadId: string): Promise<FinanceCostUploadResult> {
  if (!z.string().uuid().safeParse(uploadId).success) return { ok: false, code: "INVALID_RESPONSE" };
  try {
    const result = await client.rpc("get_finance_cost_upload_context_v1", { p_upload_id: uploadId });
    if (result.error) return { ok: false, code: rpcFailure(result.error, "READ_FAILED"), uploadId };
    const parsed = financeCostUploadContextSchema.safeParse(result.data);
    if (!parsed.success || parsed.data.upload_id !== uploadId) return { ok: false, code: "INVALID_RESPONSE", uploadId };
    return { ok: true, upload: parsed.data };
  } catch { return { ok: false, code: "CONNECTION_INTERRUPTED", uploadId }; }
}

export async function uploadFinanceCostProof(client: SupabaseClient, input: {
  actorId: string; component: FinanceCostComponent; targetId: string; file: File;
  onPhase?: (phase: FinanceCostUploadPhase) => void;
}, request: typeof fetch = fetch): Promise<FinanceCostUploadResult> {
  let uploadId: string | undefined;
  if (!z.string().uuid().safeParse(input.actorId).success || !z.string().uuid().safeParse(input.targetId).success || !financeCostComponentSchema.safeParse(input.component).success) return { ok: false, code: "INVALID_RESPONSE" };
  try {
    input.onPhase?.("HASHING");
    const metadata = await inspectFinanceCostFile(input.file);
    if (!metadata) return { ok: false, code: "INVALID_FILE" };
    const key = await financeCostUploadReplayKey(input.actorId, input.component, input.targetId, metadata);
    input.onPhase?.("RESERVING");
    const reserved = await client.rpc("reserve_finance_cost_document_v1", {
      p_component: input.component, p_target_id: input.targetId, p_file_name: metadata.fileName,
      p_mime_type: metadata.mimeType, p_size_bytes: metadata.sizeBytes, p_sha256: metadata.sha256, p_idempotency_key: key,
    });
    if (reserved.error) return { ok: false, code: rpcFailure(reserved.error, "RESERVATION_FAILED") };
    const parsed = financeCostUploadContextSchema.safeParse(reserved.data);
    if (!parsed.success || parsed.data.sha256 !== metadata.sha256 || parsed.data.size_bytes !== metadata.sizeBytes || parsed.data.mime_type !== metadata.mimeType) return { ok: false, code: "INVALID_RESPONSE" };
    uploadId = parsed.data.upload_id;
    input.onPhase?.("UPLOADING");
    const stored = await client.storage.from(parsed.data.bucket).upload(parsed.data.path, input.file, { contentType: metadata.mimeType, cacheControl: "0", upsert: false });
    if (stored.error && String((stored.error as { statusCode?: unknown }).statusCode ?? "") !== "409") return { ok: false, code: "UPLOAD_FAILED", uploadId };
    // A storage conflict is only a replay candidate. Trusted byte verification remains mandatory.
    input.onPhase?.("VERIFYING");
    const response = await request(`/api/finance/cost-proofs/uploads/${uploadId}`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!response.ok) return { ok: false, code: await financeCostHttpPrerequisite(response) ?? (response.status === 409 ? "CONFLICT" : "UPLOAD_UNCONFIRMED"), uploadId };
    const receipt = z.object({ outcome: z.literal("FINANCE_COST_DOCUMENT_UPLOADED"), upload_id: z.string().uuid(), scan_status: financeCostScanSchema }).safeParse(await response.json());
    if (!receipt.success || receipt.data.upload_id !== uploadId) return { ok: false, code: "INVALID_RESPONSE", uploadId };
    return { ok: true, upload: { ...parsed.data, status: "UPLOADED", scan_status: receipt.data.scan_status } };
  } catch { return { ok: false, code: "CONNECTION_INTERRUPTED", ...(uploadId ? { uploadId } : {}) }; }
}

export type FinanceCostScanRetryResult = {ok:true;uploadId:string;scanStatus:FinanceCostScanStatus;retryScheduled:true}|{ok:false;code:FinanceCostProofFailure;uploadId:string;retryScheduled:boolean};

/** Retry changes operational scheduling only; earlier scan results remain server-owned history. */
export async function retryFinanceCostScan(client:SupabaseClient,uploadId:string,reason:string,request:typeof fetch=fetch):Promise<FinanceCostScanRetryResult> {
  if(!z.string().uuid().safeParse(uploadId).success)return{ok:false,code:"INVALID_RESPONSE",uploadId,retryScheduled:false};
  if(reason.trim().length<10||reason.trim().length>2000)return{ok:false,code:"VALIDATION",uploadId,retryScheduled:false};
  let retryScheduled=false;
  try {
    const retried=await client.rpc("retry_finance_cost_document_scan_v1",{p_upload_id:uploadId,p_reason:reason.trim()});
    if(retried.error)return{ok:false,code:retried.error.code==="55P03"||retried.error.code==="55000"?"CONFLICT":rpcFailure(retried.error,"RESERVATION_FAILED"),uploadId,retryScheduled};
    const receipt=z.object({outcome:z.literal("FINANCE_COST_DOCUMENT_RETRY_SCHEDULED"),upload_id:z.string().uuid(),scan_status:z.literal("PENDING")}).safeParse(retried.data);
    if(!receipt.success||receipt.data.upload_id!==uploadId)return{ok:false,code:"INVALID_RESPONSE",uploadId,retryScheduled};
    retryScheduled=true;
    const response=await request(`/api/finance/cost-proofs/uploads/${uploadId}`,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:"{}"});
    if(!response.ok)return{ok:false,code:await financeCostHttpPrerequisite(response)??(response.status===409?"CONFLICT":"UPLOAD_UNCONFIRMED"),uploadId,retryScheduled};
    const committed=z.object({outcome:z.literal("FINANCE_COST_DOCUMENT_UPLOADED"),upload_id:z.string().uuid(),scan_status:financeCostScanSchema}).safeParse(await response.json());
    return committed.success&&committed.data.upload_id===uploadId?{ok:true,uploadId,scanStatus:committed.data.scan_status,retryScheduled}:{ok:false,code:"INVALID_RESPONSE",uploadId,retryScheduled};
  }catch{return{ok:false,code:"CONNECTION_INTERRUPTED",uploadId,retryScheduled};}
}

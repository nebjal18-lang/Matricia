import { createHash } from "node:crypto";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";
import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { privateFileDisposition, verifiedPrivacyUploadMime } from "@/modules/shared/lib/privacy-files/bytes";
import { financeCostReadContextSchema, financeCostUploadContextSchema } from "./model";
import { scanOneFinanceCostDocument } from "./scan-consumer";
export const financeCostFileHeaders = { "cache-control": "private, no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "content-security-policy": "default-src 'none'; sandbox" };
export function financeCostFileFailure(code: string, status = 503): Response {
  return Response.json({ code }, { status, headers: financeCostFileHeaders });
}
function rpcStatus(code: string | undefined): number {
  return code === "42501" ? 403 : code === "22023" ? 400 : code === "40001" || code === "55000" || code === "55P03" ? 409 : 503;
}
async function deadline<T>(input: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([Promise.resolve(input), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("FINANCE_COST_DOCUMENT_TIMEOUT")), ms); })]); }
  finally { clearTimeout(timer); }
}
export async function transferFinanceCostDocument(uploadId: string, commit: boolean): Promise<Response> {
  if (!z.string().uuid().safeParse(uploadId).success) return financeCostFileFailure("INVALID_FINANCE_COST_DOCUMENT", 400);
  try {
    const client = await getSupabaseServerClient();
    const auth = await deadline(client.auth.getUser(), 5_000);
    const authFailure = classifyAuthReadFailure(auth.error);
    if (authFailure) return financeCostFileFailure(authFailure === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "AUTH_UNAVAILABLE", authFailure === "UNAUTHENTICATED" ? 401 : 503);
    if (!auth.data.user) return financeCostFileFailure("UNAUTHENTICATED", 401);
    const authorized = await deadline(client.rpc(commit ? "get_finance_cost_upload_context_v1" : "authorize_finance_cost_document_read_v1", { p_upload_id: uploadId }), 5_000);
    if (authorized.error) {
      const code = authorized.error.message === "FINANCE_COST_MFA_REQUIRED" ? "FINANCE_COST_MFA_REQUIRED" : authorized.error.message === "FINANCE_COST_UNAUTHENTICATED" ? "UNAUTHENTICATED" : "FINANCE_COST_DOCUMENT_ACCESS_DENIED";
      return financeCostFileFailure(code, code === "UNAUTHENTICATED" ? 401 : rpcStatus(authorized.error.code));
    }
    const parsed = (commit ? financeCostUploadContextSchema : financeCostReadContextSchema).safeParse(authorized.data);
    if (!parsed.success || parsed.data.upload_id !== uploadId || parsed.data.path !== `finance-cost/${uploadId}`) return financeCostFileFailure("FINANCE_COST_DOCUMENT_AUTHORIZATION_INVALID");
    const source = parsed.data;
    if (!commit && (!("actor_id" in source) || source.actor_id !== auth.data.user.id)) return financeCostFileFailure("FINANCE_COST_DOCUMENT_AUTHORIZATION_INVALID");
    // No service-role read occurs before the native Finance session authorizes
    // this exact intent or retrieval capability, document ID, bucket and path.
    const admin = getSupabaseAdminClient();
    const downloaded = await deadline(admin.storage.from(source.bucket).download(source.path), 10_000);
    if (downloaded.error || !downloaded.data) return financeCostFileFailure("FINANCE_COST_DOCUMENT_STORAGE_UNAVAILABLE");
    if (downloaded.data.size !== source.size_bytes) return financeCostFileFailure("FINANCE_COST_DOCUMENT_BYTES_MISMATCH", 409);
    const bytes = Buffer.from(await downloaded.data.arrayBuffer());
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hash !== source.sha256 || bytes.length !== source.size_bytes) return financeCostFileFailure("FINANCE_COST_DOCUMENT_BYTES_MISMATCH", 409);
    try { verifiedPrivacyUploadMime(bytes, source.mime_type); }
    catch { return financeCostFileFailure("FINANCE_COST_DOCUMENT_MIME_MISMATCH", 422); }
    if (commit) {
      const saved = await deadline(client.rpc("commit_finance_cost_document_upload_v1", { p_upload_id: uploadId, p_computed_sha256: hash, p_computed_size_bytes: bytes.length }), 5_000);
      if (saved.error || saved.data?.outcome !== "FINANCE_COST_DOCUMENT_UPLOADED") return financeCostFileFailure("FINANCE_COST_DOCUMENT_COMMIT_UNAVAILABLE", rpcStatus(saved.error?.code));
      // The durable uploaded state/outbox survives a scanner outage. Returning
      // the native scan state never pretends that the evidence is already CLEAN.
      // Keep the upload response within its route budget. The native lease and
      // uploaded outbox event retain retry ownership if scanning takes longer.
      await deadline(scanOneFinanceCostDocument(admin, uploadId), 20_000).catch(() => undefined);
      const refreshed = await deadline(client.rpc("get_finance_cost_upload_context_v1", { p_upload_id: uploadId }), 5_000);
      const state = financeCostUploadContextSchema.safeParse(refreshed.data);
      if (refreshed.error || !state.success || state.data.upload_id !== uploadId) return financeCostFileFailure("FINANCE_COST_DOCUMENT_STATUS_UNAVAILABLE");
      return Response.json({ outcome: "FINANCE_COST_DOCUMENT_UPLOADED", upload_id: uploadId, scan_status: state.data.scan_status }, { headers: financeCostFileHeaders });
    }
    if (!("read_capability_id" in source) || !("file_name" in source)) return financeCostFileFailure("FINANCE_COST_DOCUMENT_AUTHORIZATION_INVALID");
    const recorded = await deadline(admin.rpc("record_finance_cost_document_read_v1", { p_capability_id: source.read_capability_id, p_computed_sha256: hash, p_computed_size_bytes: bytes.length }), 5_000);
    if (recorded.error || recorded.data?.outcome !== "FINANCE_COST_DOCUMENT_READ_RECORDED" || recorded.data?.upload_id !== uploadId) return financeCostFileFailure("FINANCE_COST_DOCUMENT_READ_RECORD_UNAVAILABLE", rpcStatus(recorded.error?.code));
    return new Response(new Uint8Array(bytes), { headers: { ...financeCostFileHeaders, "content-type": source.mime_type, "content-length": String(bytes.length), "content-disposition": privateFileDisposition(source.file_name, source.mime_type), "x-matricia-file-sha256": hash } });
  } catch { return financeCostFileFailure("FINANCE_COST_DOCUMENT_UNAVAILABLE"); }
}

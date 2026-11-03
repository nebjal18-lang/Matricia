import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { scanDocumentBytes } from "@/modules/shared/lib/document-scanning/scanner";
import { verifiedPrivacyUploadMime } from "@/modules/shared/lib/privacy-files/bytes";
import { financeCostDocumentSourceSchema } from "./model";

const claimSchema = financeCostDocumentSourceSchema.omit({ sha256: true }).extend({
  expected_sha256: z.string().regex(/^[a-f0-9]{64}$/u), lease_token: z.string().uuid(), row_version: z.number().int().positive(),
});
export type FinanceCostScanResult = Readonly<{ ok: boolean; code: "NO_JOB" | "FINANCE_COST_DOCUMENT_SCAN_RECORDED" | "FINANCE_COST_SCAN_UNAVAILABLE"; scanStatus?: "CLEAN" | "REJECTED" | "ERROR" }>;
async function deadline<T>(input: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([Promise.resolve(input), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("FINANCE_COST_SCAN_TIMEOUT")), ms); })]); }
  finally { clearTimeout(timer); }
}
/** The trusted worker always downloads and verifies the real private object. */
export async function scanOneFinanceCostDocument(client: SupabaseClient, uploadId?: string): Promise<FinanceCostScanResult> {
  if (uploadId !== undefined && !z.string().uuid().safeParse(uploadId).success) return { ok: false, code: "FINANCE_COST_SCAN_UNAVAILABLE" };
  const workerId = randomUUID();
  try {
    const claimed = await deadline(client.rpc("claim_finance_cost_document_scan_jobs_v1", {
      p_worker_id: workerId, p_upload_id: uploadId ?? null, p_limit: 1, p_lease_seconds: 90,
    }), 5_000);
    if (claimed.error || !Array.isArray(claimed.data) || claimed.data.length > 1) return { ok: false, code: "FINANCE_COST_SCAN_UNAVAILABLE" };
    if (!claimed.data.length) {
      if (!uploadId) return { ok: true, code: "NO_JOB" };
      const native = await deadline(client.rpc("get_finance_cost_scan_state_v1", { p_upload_id: uploadId }), 5_000);
      const terminal = z.object({ upload_id: z.literal(uploadId), status: z.literal("UPLOADED"), scan_status: z.enum(["CLEAN", "REJECTED"]) }).safeParse(native.data);
      return native.error || !terminal.success ? { ok: false, code: "FINANCE_COST_SCAN_UNAVAILABLE" } : { ok: true, code: "FINANCE_COST_DOCUMENT_SCAN_RECORDED", scanStatus: terminal.data.scan_status };
    }
    const parsed = claimSchema.safeParse(claimed.data[0]);
    if (!parsed.success || parsed.data.path !== `finance-cost/${parsed.data.upload_id}` || uploadId !== undefined && parsed.data.upload_id !== uploadId) return { ok: false, code: "FINANCE_COST_SCAN_UNAVAILABLE" };
    const claim = parsed.data;
    let hash: string | null = null, size: number | null = null;
    const record = async (result: "CLEAN" | "INFECTED" | "ERROR", engineCode: string, engineVersion: string): Promise<FinanceCostScanResult> => {
      const saved = await deadline(client.rpc("complete_finance_cost_document_scan_v1", {
        p_upload_id: claim.upload_id, p_worker_id: workerId, p_lease_token: claim.lease_token, p_expected_row_version: claim.row_version,
        p_result: result, p_computed_sha256: hash, p_computed_size_bytes: size, p_engine_code: engineCode, p_engine_version: engineVersion,
      }), 5_000);
      const data = z.object({ outcome: z.literal("FINANCE_COST_DOCUMENT_SCAN_RECORDED"), upload_id: z.literal(claim.upload_id), scan_status: z.enum(["CLEAN", "REJECTED", "ERROR"]) }).safeParse(saved.data);
      return saved.error || !data.success ? { ok: false, code: "FINANCE_COST_SCAN_UNAVAILABLE" } : data.data.scan_status === "ERROR" ? { ok: false, code: "FINANCE_COST_SCAN_UNAVAILABLE", scanStatus: "ERROR" } : { ok: true, code: data.data.outcome, scanStatus: data.data.scan_status };
    };
    try {
      const downloaded = await deadline(client.storage.from(claim.bucket).download(claim.path), 10_000);
      if (downloaded.error || !downloaded.data) return await record("ERROR", "MATRICIA_STORAGE_GUARD", "1.0.0");
      size = downloaded.data.size;
      if (size !== claim.size_bytes) return await record("ERROR", "MATRICIA_SIZE_GUARD", "1.0.0");
      const bytes = Buffer.from(await downloaded.data.arrayBuffer());
      hash = createHash("sha256").update(bytes).digest("hex");
      if (hash !== claim.expected_sha256) return await record("ERROR", "MATRICIA_HASH_GUARD", "1.0.0");
      try { verifiedPrivacyUploadMime(bytes, claim.mime_type); }
      catch { return await record("ERROR", "MATRICIA_MEDIA_GUARD", "1.0.0"); }
      const verdict = await scanDocumentBytes(bytes, hash, claim.mime_type);
      return await record(verdict.result, verdict.engineCode, verdict.engineVersion);
    } catch { return await record("ERROR", "MATRICIA_SCANNER_UNAVAILABLE", "1.0.0"); }
  } catch { return { ok: false, code: "FINANCE_COST_SCAN_UNAVAILABLE" }; }
}

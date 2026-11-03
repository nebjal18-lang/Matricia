import { createHash } from "node:crypto";
import { z } from "zod";
import type { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

const reservation = z.object({ upload_id: z.string().uuid(), storage_bucket: z.literal("provider-qualification"), storage_object_path: z.string().min(40).max(400) });
const signatures: Record<string, readonly number[]> = { "application/pdf": [0x25,0x50,0x44,0x46,0x2d], "image/jpeg": [0xff,0xd8,0xff], "image/png": [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a] };
export async function uploadPaymentProof(client: Awaited<ReturnType<typeof getSupabaseServerClient>>, organizationId: string, key: string, file: FormDataEntryValue | null, purpose:"PAYMENT"|"PAYABLE"="PAYMENT") {
  if (!(file instanceof File) || file.size < 1 || file.size > 10 * 1024 * 1024 || !signatures[file.type]) return { status: "error" as const, reason: "VALIDATION" as const };
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!signatures[file.type]!.every((byte, index) => bytes[index] === byte)) return { status: "error" as const, reason: "VALIDATION" as const };
  const proofHash = createHash("sha256").update(bytes).digest("hex");
  const result = await client.rpc(purpose==="PAYABLE"?"begin_provider_receipt_proof_upload":"begin_provider_payment_proof_upload", { p_provider_organization_id: organizationId, p_original_file_name: file.name, p_declared_mime_type: file.type, p_declared_size_bytes: file.size, p_declared_sha256: proofHash, p_idempotency_key: `${key}:proof` });
  if (result.error) return { status: "error" as const, reason: result.error.code === "42501" ? "FORBIDDEN" as const : "FAILED" as const };
  const parsed = reservation.safeParse(result.data);
  if (!parsed.success) return { status: "error" as const, reason: "FAILED" as const };
  const uploaded = await client.storage.from(parsed.data.storage_bucket).upload(parsed.data.storage_object_path, bytes, { contentType: file.type, cacheControl: "0", upsert: false });
  // Retrying the immutable reserved object may return 409; the trusted scanner
  // still validates the actual bytes against the declared hash before binding.
  if (uploaded.error && String((uploaded.error as { statusCode?: unknown }).statusCode ?? "") !== "409") return { status: "error" as const, reason: "FAILED" as const };
  return { status: "success" as const, proofHash };
}

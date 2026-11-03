import { z } from "zod";
export const financeCostDocumentSourceSchema = z.object({
  upload_id: z.string().uuid(), bucket: z.literal("finance-cost-proofs"),
  path: z.string().regex(/^finance-cost\/[a-f0-9-]{36}$/u),
  sha256: z.string().regex(/^[a-f0-9]{64}$/u), size_bytes: z.number().int().positive().max(10 * 1024 * 1024),
  mime_type: z.enum(["application/pdf", "image/png", "image/jpeg"]),
});
export const financeCostUploadContextSchema = financeCostDocumentSourceSchema.extend({
  status: z.enum(["RESERVED", "UPLOADED"]), scan_status: z.enum(["PENDING", "CLEAN", "REJECTED", "ERROR"]),
});
export const financeCostReadContextSchema = financeCostDocumentSourceSchema.extend({
  read_capability_id: z.string().uuid(), actor_id: z.string().uuid(), file_name: z.string().min(3).max(255),
});

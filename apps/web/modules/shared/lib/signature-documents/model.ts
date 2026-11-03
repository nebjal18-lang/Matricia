import {z} from "zod";
const uuid=z.string().uuid(),hash=z.string().regex(/^[a-f0-9]{64}$/u),minor=z.string().regex(/^\d+$/u),signedMinor=z.string().regex(/^-?\d+$/u);
const safeText=z.string().min(1).max(200000).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f]*$/u);
const party=z.object({party_role:z.enum(["CLIENT","PROVIDER"]),organization_id:uuid,legal_snapshot:z.object({legal_name:safeText,country_code:z.string().length(2),identifiers:z.record(z.string(),z.string()),registered_address:safeText,verified_identity_hash:hash}).passthrough()});
const item=z.object({line_number:z.number().int().positive(),label_fr:safeText,label_ar:z.string().max(200000).nullable().optional(),quantity:z.string().regex(/^\d+(?:\.\d+)?$/u),unit_code:safeText,unit_price_minor:minor,subtotal_minor:minor,tax_minor:minor,total_minor:minor,tax_rate_basis_points:z.number().int().min(0).max(10000),item_kind:z.enum(["ONE_TIME","RECURRING"]),recurrence_interval:z.string().nullable().optional()});
export const signatureDocumentSourceSchema=z.object({
 source_kind:z.enum(["CONTRACT","AMENDMENT"]),source_id:uuid,source_hash:hash,parties_hash:hash,contract_id:uuid,contract_version_id:uuid,contract_version:z.number().int().positive(),created_at:z.string(),
 price_minor:minor,currency:z.string().regex(/^[A-Z]{3}$/u),parties:z.array(party).length(2),
 clauses:z.object({fr:safeText.min(10),ar:safeText.min(10),template_policy_version_id:uuid,template_content_hash:hash,approval_reference:safeText}).passthrough(),
 commission:z.object({commission_basis_points:z.number().int().min(0).max(10000),basis_code:z.literal("CONFIRMED_CLIENT_RECEIPT_AMOUNT"),policy_version_id:uuid,content_hash:hash,approval_reference:safeText}).passthrough(),
 quote:z.object({quote_version_id:uuid,currency:z.string().regex(/^[A-Z]{3}$/u),subtotal_minor:minor,tax_minor:minor,total_minor:minor,items:z.array(item).min(1).max(2000),solution_fr:safeText,solution_ar:z.string().max(200000).nullable().optional(),proposed_start_date:z.string().nullable().optional(),duration_days:z.number().int().optional()}).passthrough(),
 contract_items:z.array(z.object({item_key:safeText,item_type:safeText,label_fr:safeText,label_ar:safeText,details_canonical:z.string(),sort_order:z.number().int()})),
 request_snapshot_canonical:z.string().max(4*1024*1024),quote_snapshot_canonical:z.string().max(4*1024*1024),commission_snapshot_canonical:z.string().max(100000),parties_snapshot_canonical:z.string().max(100000),
 amendment:z.object({id:uuid,number:z.number().int().positive(),reason:safeText,scope_canonical:z.string(),price_delta_minor:signedMinor,deadline_delta_days:z.number().int(),deliverables_canonical:z.string(),commission_canonical:z.string()}).nullable(),
 applied_amendments:z.array(z.object({id:uuid,number:z.number().int().positive(),price_delta_minor:signedMinor,deadline_delta_days:z.number().int(),source_hash:hash})).max(2000),
});
export type SignatureDocumentSource=z.infer<typeof signatureDocumentSourceSchema>;
export const signatureArchiveArtifactSchema=z.object({id:uuid,locale:z.enum(["fr","ar"]),source_hash:hash,parties_hash:hash,pdf_sha256:hash,storage_path:z.string().min(1).max(1000),size_bytes:z.number().int().positive().max(20*1024*1024),render_version:z.string().min(1)});
export type SignatureArchiveArtifact=z.infer<typeof signatureArchiveArtifactSchema>;

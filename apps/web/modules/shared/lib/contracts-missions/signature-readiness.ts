import{z}from"zod";
export const signatureReadinessSchema=z.object({ready:z.boolean(),status:z.enum(["NOT_CONFIGURED","DOCUMENT_ARCHIVE_REQUIRED","ENVELOPE_REQUIRED","AUTHORITIES_REQUIRED","READY_TO_SUBMIT","AWAITING_PROVIDER","SIGNED","BLOCKED"]),reason:z.string().nullable().optional(),development_mock:z.boolean().optional(),provider_code:z.string().nullable().optional(),environment:z.string().nullable().optional(),requested_level:z.string().nullable().optional(),envelope_id:z.string().uuid().nullable().optional()});
export type SignatureReadiness=z.infer<typeof signatureReadinessSchema>;

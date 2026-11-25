import { z } from "zod";
const uuid = z.string().uuid();
const hash = z.string().regex(/^[a-f0-9]{64}$/u);
export const signerPlacementSchema = z.object({ documentSha256: hash, page: z.number().int().min(1).max(9999), x: z.number().int().min(0).max(9999), y: z.number().int().min(0).max(9999) }).strict();
const name = z.string().trim().min(1).max(100).regex(/^[^\u0000-\u001f\u007f]+$/u);
export const signerPreparationInputSchema = z.object({ firstName: name, lastName: name, locale: z.enum(["fr", "en"]), fields: z.array(signerPlacementSchema).min(1).max(10) }).strict();
export const signerPreparationSchema = z.object({
  envelopeId: uuid, signerId: uuid, contractId: uuid, amendmentId: uuid.nullable(), status: z.string().min(1).max(80), canConfigure: z.boolean(),
  firstName: z.string().max(100), lastName: z.string().max(100), locale: z.enum(["fr", "en"]), fields: z.array(signerPlacementSchema).max(10),
  documents: z.array(z.object({ id: uuid, sha256: hash, fileName: z.string().min(1).max(240), contractVersionId: uuid, locale: z.enum(["fr", "ar"]) }).strict()).min(1).max(10),
}).strict().superRefine((row, context) => {
  if (row.fields.some(field => !row.documents.some(document => document.sha256 === field.documentSha256))) context.addIssue({ code: "custom", message: "DOCUMENT_SCOPE_MISMATCH" });
});
export const signerPreparationsSchema = z.array(z.object({ envelopeId: uuid, contractId: uuid, amendmentId: uuid.nullable(), status: z.string().min(1).max(80), configured: z.boolean(), canConfigure: z.boolean() }).strict()).max(50);
export type SignerPreparation = z.infer<typeof signerPreparationSchema>;
export type SignerPreparationInput = z.infer<typeof signerPreparationInputSchema>;
export type PlacementDraft = { documentSha256: string; page: string; x: string; y: string };

export function preparationInput(firstName: string, lastName: string, locale: string, fields: PlacementDraft[], documents: SignerPreparation["documents"]): SignerPreparationInput {
  if (fields.some(row => [row.page, row.x, row.y].some(value => !/^\d{1,4}$/u.test(value)))) throw new Error("INVALID_PREPARATION");
  const parsed = signerPreparationInputSchema.parse({ firstName, lastName, locale, fields: fields.map(row => ({ documentSha256: row.documentSha256, page: Number(row.page), x: Number(row.x), y: Number(row.y) })) });
  if (parsed.fields.some(field => !documents.some(document => document.sha256 === field.documentSha256))) throw new Error("INVALID_PREPARATION");
  return parsed;
}
export function samePreparation(actual: SignerPreparation, expected: SignerPreparationInput) {
  return actual.firstName === expected.firstName && actual.lastName === expected.lastName && actual.locale === expected.locale
    && JSON.stringify(actual.fields) === JSON.stringify(expected.fields);
}
export function preparationDocumentUrl(envelopeId: string, documentId: string) {
  return `/api/signatures/yousign/envelopes/${uuid.parse(envelopeId)}/documents/${uuid.parse(documentId)}`;
}

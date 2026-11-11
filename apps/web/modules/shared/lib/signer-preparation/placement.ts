import "server-only";
import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";
import { getOrArchiveSignatureDocument } from "@/modules/shared/lib/signature-documents/archive";
import type { SignerPreparation, SignerPreparationInput } from "./model";
/** Reserve a complete empty stamp area, rather than accepting an anchor outside
 * the real immutable page. Canonical source documents use A4 pages. */
// YouSign defaults: https://developers.youtrust.com/docs/signature-field
const width = 85, height = 37;
export async function validatePdfPlacements(bytes: Uint8Array, expectedHash: string, fields: SignerPreparationInput["fields"]) {
  if (bytes.length < 5 || bytes.length > 20 * 1024 * 1024 || createHash("sha256").update(bytes).digest("hex") !== expectedHash) throw new Error("DOCUMENT_CHANGED");
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true });
  const pages = pdf.getPages();
  if (!pages.length || pages.length > 9999) throw new Error("INVALID_PLACEMENT");
  for (const field of fields) {
    const page = pages[field.page - 1];
    if (!page) throw new Error("INVALID_PLACEMENT");
    const size = page.getSize();
    if (!Number.isFinite(size.width) || !Number.isFinite(size.height) || page.getRotation().angle !== 0 || field.x < 0 || field.y < 0 || field.x + width > size.width || field.y + height > size.height) throw new Error("INVALID_PLACEMENT");
  }
}
export async function validateSignerPlacements(client: SupabaseClient, actorId: string, workspace: SignerPreparation, input: SignerPreparationInput) {
  for (const sha256 of new Set(input.fields.map(field => field.documentSha256))) {
    const document = workspace.documents.find(row => row.sha256 === sha256);
    if (!document) throw new Error("INVALID_PLACEMENT");
    const source = workspace.amendmentId ? { kind: "AMENDMENT" as const, amendmentId: workspace.amendmentId } : { kind: "CONTRACT" as const, contractId: workspace.contractId, contractVersionId: document.contractVersionId };
    const result = await getOrArchiveSignatureDocument(client, () => getSupabaseAdminClient({ timeoutMs: 10000 }), source, document.locale, actorId);
    if (!result.ok) throw new Error("DOCUMENT_UNAVAILABLE");
    if (result.artifact.pdf_sha256 !== sha256) throw new Error("DOCUMENT_CHANGED");
    await validatePdfPlacements(result.bytes, sha256, input.fields.filter(field => field.documentSha256 === sha256));
  }
}

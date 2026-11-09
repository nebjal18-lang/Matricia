import { z } from "zod";
import { PreparationReadError, readSignerPreparation } from "@/modules/shared/lib/signer-preparation/repository";
import { signatureDocumentResponse } from "@/modules/shared/lib/signature-documents/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "cache-control": "private, no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "content-security-policy": "default-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'", "x-frame-options": "SAMEORIGIN" };
export async function GET(request: Request, context: { params: Promise<{ envelopeId: string; documentId: string }> }) {
  const { envelopeId, documentId } = await context.params;
  if (![envelopeId, documentId].every(id => z.string().uuid().safeParse(id).success)) return Response.json({ code: "SIGNATURE_DOCUMENT_NOT_FOUND" }, { status: 404, headers });
  try {
    const current = await readSignerPreparation(envelopeId);
    const document = current.documents.find(row => row.id === documentId);
    if (!document) return Response.json({ code: "SIGNATURE_DOCUMENT_NOT_FOUND" }, { status: 404, headers });
    const url = new URL(request.url); url.search = ""; url.searchParams.set("locale", document.locale);
    const source = current.amendmentId
      ? { kind: "AMENDMENT" as const, amendmentId: current.amendmentId }
      : { kind: "CONTRACT" as const, contractId: current.contractId, contractVersionId: document.contractVersionId };
    const response = await signatureDocumentResponse(new Request(url, { headers: request.headers }), source);
    if (!response.ok) return response;
    if (response.headers.get("etag") !== `"${document.sha256}"` || !response.headers.get("content-type")?.startsWith("application/pdf")) {
      await response.body?.cancel();
      return Response.json({ code: "SIGNATURE_DOCUMENT_CHANGED" }, { status: 409, headers });
    }
    const confirmed = await readSignerPreparation(envelopeId);
    if (!confirmed.documents.some(row => row.id === documentId && row.sha256 === document.sha256)) {
      await response.body?.cancel();
      return Response.json({ code: "SIGNATURE_DOCUMENT_NOT_FOUND" }, { status: 404, headers });
    }
    return new Response(response.body, { headers: { ...headers, "content-type": "application/pdf", "content-disposition": "inline; filename=signature-source.pdf", etag: `"${document.sha256}"`, "x-matricia-document-kind": "UNSIGNED_SOURCE_DOCUMENT" } });
  } catch (error) {
    const code = error instanceof PreparationReadError ? error.code : "UNAVAILABLE";
    return Response.json({ code: code === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : code === "NOT_FOUND" ? "SIGNATURE_DOCUMENT_NOT_FOUND" : "SIGNATURE_DOCUMENT_UNAVAILABLE" }, { status: code === "UNAUTHENTICATED" ? 401 : code === "NOT_FOUND" ? 404 : 503, headers });
  }
}

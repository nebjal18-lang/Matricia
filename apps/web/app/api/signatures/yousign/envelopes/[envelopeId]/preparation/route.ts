import { z } from "zod";
import { PreparationReadError, readSignerPreparation } from "@/modules/shared/lib/signer-preparation/repository";
export const dynamic = "force-dynamic";
const headers = { "cache-control": "private, no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" };
export async function GET(_request: Request, context: { params: Promise<{ envelopeId: string }> }) {
  const { envelopeId } = await context.params;
  if (!z.string().uuid().safeParse(envelopeId).success) return Response.json({ code: "PREPARATION_NOT_FOUND" }, { status: 404, headers });
  try { return Response.json(await readSignerPreparation(envelopeId), { headers }); }
  catch (error) {
    const code = error instanceof PreparationReadError ? error.code : "UNAVAILABLE";
    return Response.json({ code: code === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : code === "NOT_FOUND" ? "PREPARATION_NOT_FOUND" : "PREPARATION_UNAVAILABLE" }, { status: code === "UNAUTHENTICATED" ? 401 : code === "NOT_FOUND" ? 404 : 503, headers });
  }
}

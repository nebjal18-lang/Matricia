import { z } from "zod";
import { privacyMutationOriginAllowed, readPrivacyJsonBody } from "@/modules/shared/lib/privacy-files/server";
import { financeCostFileFailure, transferFinanceCostDocument } from "@/modules/shared/lib/finance-cost-proofs/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  if (!privacyMutationOriginAllowed(request)) return financeCostFileFailure("REQUEST_ORIGIN_DENIED", 403);
  const body = z.object({}).strict().safeParse(await readPrivacyJsonBody(request).catch(() => null));
  if (!body.success) return financeCostFileFailure("INVALID_REQUEST", 400);
  return transferFinanceCostDocument((await params).uploadId, true);
}

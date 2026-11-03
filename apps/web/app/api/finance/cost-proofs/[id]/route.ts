import { transferFinanceCostDocument } from "@/modules/shared/lib/finance-cost-proofs/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return transferFinanceCostDocument((await params).id, false);
}

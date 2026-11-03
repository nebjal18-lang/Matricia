import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { signalResult, type GovernanceSignalResult } from "./model";
export type { GovernanceSignals, GovernanceSignalResult } from "./model";
const id = z.string().uuid();
export async function loadFranchiseGovernanceSignals(franchiseId: string, reportId?: string): Promise<GovernanceSignalResult> {
  if (!id.safeParse(franchiseId).success || reportId && !id.safeParse(reportId).success) return { status: "error", reason: "INVALID_RESPONSE" };
  try {
    const client = await getSupabaseServerClient(); const auth = await client.auth.getUser(); const failure = classifyAuthReadFailure(auth.error);
    if (failure) return { status: "error", reason: failure === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "QUERY_FAILED" };
    if (!auth.data.user) return { status: "error", reason: "UNAUTHENTICATED" };
    const response = await client.rpc("get_franchise_governance_signals_v1", { p_franchise_id: franchiseId, p_report_id: reportId ?? null });
    if (response.error) return { status: "error", reason: response.error.code === "42501" ? "FORBIDDEN" : "QUERY_FAILED" };
    const parsed = signalResult.safeParse(response.data);
    if (!parsed.success || parsed.data.franchiseId !== franchiseId || parsed.data.status === "AVAILABLE" && (parsed.data.snapshot.franchise_id !== franchiseId || reportId && parsed.data.snapshot.report_id !== reportId)) return { status: "error", reason: "INVALID_RESPONSE" };
    return parsed.data;
  } catch (error) { unstable_rethrow(error); return { status: "error", reason: "QUERY_FAILED" }; }
}

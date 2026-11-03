import { z } from "zod";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";
import { publicationJobSchema } from "./publisher";
import { verifyNativeSocialPublication } from "./native-reconciliation";
const workSchema = z.object({ outcome: z.literal("SOCIAL_VERIFICATION_AUTHORIZED"), publication_id: z.string(), account_reference: z.string(), claimed_at: z.string(), lease_expires_at: z.string(), job: publicationJobSchema });
export async function consumeSocialNativeVerification(requestId: string): Promise<{ ok: boolean; code: string }> {
  const client = getSupabaseAdminClient(), prepared = await client.rpc("prepare_social_native_verification_v1", { p_request_id: requestId });
  if (prepared.error) return { ok: false, code: "SOCIAL_VERIFICATION_UNAUTHORIZED" };
  if ((prepared.data as { outcome?: unknown } | null)?.outcome === "SOCIAL_ALREADY_VERIFIED") return { ok: true, code: "SOCIAL_NATIVE_VERIFIED" };
  const work = workSchema.safeParse(prepared.data);
  if (!work.success) return { ok: false, code: "SOCIAL_VERIFICATION_INVALID" };
  let proof;
  try { proof = await verifyNativeSocialPublication({ job: work.data.job, publicationId: work.data.publication_id, accountReference: work.data.account_reference, claimedAt: work.data.claimed_at, leaseExpiresAt: work.data.lease_expires_at }, { env: process.env, fetch }); }
  catch { return { ok: false, code: "SOCIAL_NATIVE_PROOF_UNVERIFIED" }; }
  const recorded = await client.rpc("complete_social_native_verification_v1", { p_request_id: requestId, p_response_hash: proof.responseHash, p_native_created_at: proof.createdAt });
  return recorded.error || (recorded.data as { outcome?: unknown } | null)?.outcome !== "SOCIAL_NATIVE_VERIFIED" ? { ok: false, code: "SOCIAL_VERIFICATION_RECORD_FAILED" } : { ok: true, code: "SOCIAL_NATIVE_VERIFIED" };
}

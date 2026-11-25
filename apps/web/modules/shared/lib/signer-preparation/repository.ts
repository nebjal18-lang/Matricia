import "server-only";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { signerPreparationSchema, signerPreparationsSchema } from "./model";
export class PreparationReadError extends Error {
  constructor(readonly code: "UNAUTHENTICATED" | "NOT_FOUND" | "UNAVAILABLE") { super(code); }
}
async function clientForUser() {
  const client = await getSupabaseServerClient();
  const auth = await client.auth.getUser();
  if (auth.error) throw new PreparationReadError(classifyAuthReadFailure(auth.error) ?? "UNAVAILABLE");
  if (!auth.data.user) throw new PreparationReadError("UNAUTHENTICATED");
  return client;
}
export async function readSignerPreparation(envelopeId: string) {
  const client = await clientForUser();
  const result = await client.rpc("get_my_yousign_preparation_v1", { p_envelope_id: envelopeId }).abortSignal(AbortSignal.timeout(5000));
  if (result.error) throw new PreparationReadError(result.error.code === "42501" || result.error.code === "P0002" ? "NOT_FOUND" : "UNAVAILABLE");
  const row = signerPreparationSchema.safeParse(result.data);
  if (!row.success || row.data.envelopeId !== envelopeId) throw new PreparationReadError("UNAVAILABLE");
  return row.data;
}
export async function readSignerPreparations() {
  const client = await clientForUser();
  const result = await client.rpc("get_my_yousign_preparations_v1").abortSignal(AbortSignal.timeout(5000));
  if (result.error) throw new PreparationReadError("UNAVAILABLE");
  const rows = signerPreparationsSchema.safeParse(result.data);
  if (!rows.success) throw new PreparationReadError("UNAVAILABLE");
  return rows.data;
}

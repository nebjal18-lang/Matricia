"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { envelopeInputSchema, type EnvelopeState } from "./envelopes-model";
export async function saveBoxEnvelopeAction(_: EnvelopeState, form: FormData): Promise<EnvelopeState> {
  const input = envelopeInputSchema.safeParse(Object.fromEntries(form.entries()));
  if (!input.success) return { status: "error", reason: "VALIDATION" };
  const client = await getSupabaseServerClient();
  const user = await client.auth.getUser();
  if (user.error || !user.data.user) return { status: "error", reason: "FORBIDDEN" };
  const p = input.data;
  const result = await client.rpc("set_customer_box_envelope_v1", { p_customer_box_id: p.boxId, p_scope: p.scope, p_target_id: p.targetId, p_expected_version: p.expectedVersion, p_credit_limit: p.creditLimit, p_reason: p.reason, p_idempotency_key: p.idempotencyKey });
  if (result.error) {
    const reason = result.error.code === "42501" ? "FORBIDDEN" : result.error.code === "40001" ? "STALE" : result.error.message === "BOX_ENVELOPE_TOTAL_BUDGET_EXCEEDED" ? "BUDGET" : result.error.message === "BOX_ENVELOPE_COMMITTED_CREDITS_REQUIRED" ? "COMMITTED" : "UNAVAILABLE";
    return { status: "error", reason };
  }
  if (!z.object({ outcome: z.literal("BOX_ENVELOPE_SAVED") }).safeParse(result.data).success) return { status: "error", reason: "UNAVAILABLE" };
  revalidatePath(`/${p.locale}/client/boxes/configuration`);
  return { status: "success" };
}

"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { parsePreparationInput } from "./model";

export type PreparationState = { status: "idle" } | { status: "success" } | { status: "error"; reason: "VALIDATION" | "DENIED" | "CONFLICT" | "UNAVAILABLE" };

function reason(code: string, message: string): "VALIDATION" | "DENIED" | "CONFLICT" | "UNAVAILABLE" {
  if (code === "42501" || message.includes("DENIED")) return "DENIED";
  if (code === "40001" || message.includes("STALE")) return "CONFLICT";
  if (code === "22023" || message.includes("INVALID")) return "VALIDATION";
  return "UNAVAILABLE";
}

export async function saveDeliveryPreparation(_: PreparationState, formData: FormData): Promise<PreparationState> {
  const parsed = parsePreparationInput(formData);
  if (!parsed) return { status: "error", reason: "VALIDATION" };
  const result = await (await getSupabaseServerClient()).rpc("save_delivery_preparation", {
    p_section: parsed.section,
    p_item_key: parsed.itemKey,
    p_value_text: parsed.valueText,
    p_secret: parsed.secret.trim() === "" ? null : parsed.secret.trim(),
    p_expected_row_version: parsed.rowVersion,
    p_idempotency_key: parsed.idempotencyKey,
  });
  if (result.error) return { status: "error", reason: reason(result.error.code ?? "", result.error.message) };
  revalidatePath(`/${parsed.locale}/administration/preparation`);
  return { status: "success" };
}

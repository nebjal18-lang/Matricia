"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { digestConfigurationInput } from "@/modules/franchise/data/digest/model";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

export type FranchiseDigestActionState = { status: "idle" } | { status: "success"; outcome: string } | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "CONFLICT" | "FAILED" };
const response = z.object({ outcome: z.literal("FRANCHISE_DAILY_DIGEST_CONFIGURED") }).passthrough();
const text = (form: FormData, key: string) => String(form.get(key) ?? "");

export async function configureDigest(_: FranchiseDigestActionState, form: FormData): Promise<FranchiseDigestActionState> {
  const uiLocale = text(form, "uiLocale");
  if (!isLocale(uiLocale)) return { status: "error", reason: "VALIDATION" };
  const parsed = digestConfigurationInput.safeParse({ franchiseId: text(form, "franchiseId"), recipientUserId: text(form, "recipientUserId"), enabled: form.get("enabled") === "on", frequency: text(form, "frequency"), localSendTime: text(form, "localSendTime"), timeZone: text(form, "timeZone"), notificationLocale: text(form, "notificationLocale"), changeReason: text(form, "changeReason"), idempotencyKey: text(form, "idempotencyKey") });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const client = await getSupabaseServerClient(), { data: auth } = await client.auth.getUser();
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  if (parsed.data.recipientUserId !== auth.user.id) return { status: "error", reason: "FORBIDDEN" };
  const result = await client.rpc("configure_franchise_daily_digest", { p_franchise_id: parsed.data.franchiseId, p_recipient_user_id: parsed.data.recipientUserId, p_enabled: parsed.data.enabled, p_frequency: parsed.data.frequency, p_local_send_time: parsed.data.localSendTime, p_time_zone: parsed.data.timeZone, p_locale: parsed.data.notificationLocale, p_change_reason: parsed.data.changeReason, p_idempotency_key: parsed.data.idempotencyKey });
  if (result.error) {
    if (result.error.code === "42501" || /DENIED|SCOPE|RECIPIENT/i.test(result.error.message ?? "")) return { status: "error", reason: "FORBIDDEN" };
    if (["40001", "PT409", "23505"].includes(result.error.code ?? "") || /IDEMPOTENCY|CONFLICT/i.test(result.error.message ?? "")) return { status: "error", reason: "CONFLICT" };
    if (result.error.code === "22023") return { status: "error", reason: "VALIDATION" };
    return { status: "error", reason: "FAILED" };
  }
  const parsedResponse = response.safeParse(result.data);
  if (!parsedResponse.success) return { status: "error", reason: "FAILED" };
  revalidatePath(`/${uiLocale}/franchise/digest`);
  return { status: "success", outcome: parsedResponse.data.outcome };
}

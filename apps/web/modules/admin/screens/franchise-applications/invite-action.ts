"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { moroccoRegions } from "@/modules/shared/lib/geo/morocco-regions";
import { deliverNotification } from "@/modules/shared/lib/notification-delivery/adapter";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

const regions = moroccoRegions.map((region) => region.code) as [string, ...string[]];

export type FranchiseApplicationInviteState =
  | { status: "idle" }
  | { status: "success"; reference: string; mailed: boolean; replayed: boolean }
  | { status: "error"; reason: "VALIDATION" | "DENIED" | "MFA_REQUIRED" | "UNAVAILABLE" };

function mapError(message: string): Extract<FranchiseApplicationInviteState, { status: "error" }> {
  if (message.includes("MFA_REQUIRED")) return { status: "error", reason: "MFA_REQUIRED" };
  if (message.includes("DENIED") || message.includes("42501")) return { status: "error", reason: "DENIED" };
  if (message.includes("INVALID") || message.includes("22023")) return { status: "error", reason: "VALIDATION" };
  return { status: "error", reason: "UNAVAILABLE" };
}

export async function openFranchiseApplicationInvite(
  _: FranchiseApplicationInviteState,
  formData: FormData,
): Promise<FranchiseApplicationInviteState> {
  const parsed = z.object({
    locale: z.enum(["fr", "ar"]),
    applicantName: z.string().trim().min(2).max(120),
    replyEmail: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
    territoryCode: z.enum(regions),
    domainLabel: z.string().trim().min(2).max(200),
    reason: z.string().trim().min(3).max(1000),
    idempotencyKey: z.string().uuid(),
  }).safeParse({
    locale: formData.get("locale"),
    applicantName: formData.get("applicantName"),
    replyEmail: formData.get("replyEmail"),
    territoryCode: formData.get("territoryCode"),
    domainLabel: formData.get("domainLabel"),
    reason: formData.get("reason"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };

  const client = await getSupabaseServerClient();
  const result = await client.rpc("open_franchise_application_invite_v1", {
    p_applicant_name: parsed.data.applicantName,
    p_reply_email: parsed.data.replyEmail,
    p_territory_code: parsed.data.territoryCode,
    p_domain_label: parsed.data.domainLabel,
    p_reason: parsed.data.reason,
    p_locale: parsed.data.locale,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (result.error) return mapError(`${result.error.code ?? ""} ${result.error.message}`);

  const payload = z.object({
    application_id: z.string().uuid(),
    status: z.string(),
    replayed: z.boolean(),
  }).safeParse(result.data);
  if (!payload.success) return { status: "error", reason: "UNAVAILABLE" };

  const reference = payload.data.application_id.slice(0, 8).toUpperCase();
  revalidatePath(`/${parsed.data.locale}/administration/candidatures-franchise`);
  if (payload.data.replayed) {
    return { status: "success", reference, mailed: false, replayed: true };
  }

  const ar = parsed.data.locale === "ar";
  const delivery = await deliverNotification({
    deliveryId: randomUUID(),
    channel: "EMAIL",
    recipientEmail: parsed.data.replyEmail,
    locale: ar ? "ar-MA" : "fr-MA",
    subject: ar ? `دعوة ترشيح امتياز ماتريسيا ${reference}` : `Invitation candidature franchise Matricia ${reference}`,
    body: ar
      ? `فتحت ماتريسيا ملف ترشيح امتياز باسمكم. المرجع: ${reference}. سجّلوا الدخول وأكملوا الملف على مسار الترشيح. القبول غير مضمون.`
      : `Matricia a ouvert un dossier de candidature franchise à votre nom. Référence : ${reference}. Connectez-vous et complétez le dossier sur le parcours candidature. L’acceptation n’est pas garantie.`,
    ctaPath: `/${parsed.data.locale}/franchise/candidature`,
    providerIdempotencyKey: `franchise-application-admin-invite:${payload.data.application_id}`,
  }, { env: process.env, fetch });

  return {
    status: "success",
    reference,
    mailed: delivery.outcome === "SENT" || delivery.outcome === "DELIVERED",
    replayed: false,
  };
}

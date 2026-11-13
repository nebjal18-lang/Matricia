"use server";
import { getPlatformRuntimeEnvironment } from "@/modules/shared/lib/platform-configuration/runtime";

import { createHash, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { moroccoRegions } from "@/modules/shared/lib/geo/morocco-regions";
import { deliverNotification } from "@/modules/shared/lib/notification-delivery/adapter";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";

const regions = moroccoRegions.map((region) => region.code) as [string, ...string[]];
const inputSchema = z.object({
  locale: z.enum(["fr", "ar"]),
  applicantName: z.string().trim().min(2).max(120),
  replyEmail: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  territoryCode: z.enum(regions),
  professionalProfile: z.string().trim().min(2).max(80),
  domainLabel: z.string().trim().min(2).max(200),
  availabilityLabel: z.string().trim().min(2).max(80),
  motivation: z.string().trim().min(40).max(800),
  website: z.string().max(0),
});

export type FranchiseApplicationActionState =
  | { status: "idle" }
  | { status: "success"; reference: string; mailed: boolean }
  | { status: "error"; reason: "VALIDATION" | "RATE_LIMITED" | "UNAVAILABLE" };

function requesterHash(headerStore: Headers) {
  const raw = headerStore.get("cf-connecting-ip") ?? headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return createHash("sha256").update(raw.slice(0, 128)).digest("hex");
}

export async function submitFranchiseApplication(_: FranchiseApplicationActionState, formData: FormData): Promise<FranchiseApplicationActionState> {
  const parsed = inputSchema.safeParse({
    locale: formData.get("locale"),
    applicantName: formData.get("displayName"),
    replyEmail: formData.get("replyEmail"),
    territoryCode: formData.get("zone"),
    professionalProfile: formData.get("profile"),
    domainLabel: formData.get("domain"),
    availabilityLabel: formData.get("availability"),
    motivation: formData.get("motivation"),
    website: formData.get("website") ?? "",
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const result = await getSupabaseAdminClient().rpc("submit_franchise_application", {
    p_applicant_name: parsed.data.applicantName,
    p_reply_email: parsed.data.replyEmail,
    p_territory_code: parsed.data.territoryCode,
    p_professional_profile: parsed.data.professionalProfile,
    p_domain_label: parsed.data.domainLabel,
    p_availability_label: parsed.data.availabilityLabel,
    p_motivation: parsed.data.motivation,
    p_locale: parsed.data.locale,
    p_ip_hash: requesterHash(await headers()),
  });
  if (result.error) return { status: "error", reason: result.error.message.includes("RATE_LIMITED") ? "RATE_LIMITED" : result.error.message.includes("INVALID") ? "VALIDATION" : "UNAVAILABLE" };
  const applicationId = typeof result.data === "string" ? result.data : "";
  const reference = applicationId.slice(0, 8).toUpperCase();
  if (!reference) return { status: "error", reason: "UNAVAILABLE" };
  const locale = parsed.data.locale === "ar" ? "ar-MA" : "fr-MA";
  const candidate = await deliverNotification({
    deliveryId: applicationId,
    channel: "EMAIL",
    recipientEmail: parsed.data.replyEmail,
    locale,
    subject: parsed.data.locale === "ar" ? `ترشيح ماتريسيا ${reference}` : `Candidature Matricia ${reference}`,
    body: parsed.data.locale === "ar"
      ? `تم تسجيل ترشيحكم. المرجع: ${reference}. الحالة: مسجّل. ستدرس ماتريسيا الملف قبل أي تعاقد.`
      : `Votre candidature est enregistrée. Référence : ${reference}. Statut : inscrit. Matricia examine le dossier avant toute contractualisation.`,
    ctaPath: `/${parsed.data.locale}/franchise/candidature`,
    providerIdempotencyKey: `franchise-application:${applicationId}`,
  }, { env: process.env, fetch });
  let environment: Record<string, string | undefined> = {};
  try { environment = await getPlatformRuntimeEnvironment(process.env, ["COMPANY", "RESEND"]); }
  catch { /* Keep the persisted application; no unverified fallback mailbox. */ }
  const support = environment.PUBLIC_CONTACT_NOTIFICATION_EMAIL?.trim();
  if (support) {
    await deliverNotification({
      deliveryId: randomUUID(),
      channel: "EMAIL",
      recipientEmail: support,
      locale,
      subject: `[Matricia] Candidature franchise ${reference}`,
      body: `Référence : ${reference}\nCandidat : ${parsed.data.applicantName}\nAdresse : ${parsed.data.replyEmail}\nTerritoire : ${parsed.data.territoryCode}\nDomaine : ${parsed.data.domainLabel}`,
      ctaPath: `/${parsed.data.locale}/administration/candidatures-franchise`,
      providerIdempotencyKey: `franchise-application-support:${applicationId}`,
    }, { env: environment, fetch });
  }
  const mailed = candidate.outcome === "SENT" || candidate.outcome === "DELIVERED";
  return { status: "success", reference, mailed };
}

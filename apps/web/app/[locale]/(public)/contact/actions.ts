"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { deliverNotification } from "@/modules/shared/lib/notification-delivery/adapter";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";
import { getPlatformRuntimeEnvironment } from "@/modules/shared/lib/platform-configuration/runtime";

const inputSchema = z.object({
  locale: z.enum(["fr", "ar"]),
  category: z.enum(["CLIENT", "PROVIDER", "FRANCHISE", "OTHER"]),
  replyEmail: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  message: z.string().trim().min(20).max(4000),
  website: z.string().max(0),
  sourcePath: z.string().trim().regex(/^\/(fr|ar)\/(contact|franchise)$/u).optional(),
});

export type ContactActionState = { status: "idle" } | { status: "success"; reference: string } | { status: "error"; reason: "VALIDATION" | "RATE_LIMITED" | "UNAVAILABLE" };

function requesterHash(headerStore: Headers) {
  const raw = headerStore.get("cf-connecting-ip") ?? headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return createHash("sha256").update(raw.slice(0, 128)).digest("hex");
}

async function notifySupport(requestId: string, input: z.infer<typeof inputSchema>) {
  let environment: Record<string, string | undefined>;
  try { environment = await getPlatformRuntimeEnvironment(process.env, ["COMPANY", "RESEND"]); }
  catch { return; } // The intake is already persisted; do not invent delivery.
  const recipientEmail = environment.PUBLIC_CONTACT_NOTIFICATION_EMAIL?.trim() || null;
  if (!recipientEmail) return;
  await deliverNotification({
    deliveryId: requestId,
    channel: "EMAIL",
    recipientEmail,
    locale: input.locale === "ar" ? "ar-MA" : "fr-MA",
    subject: `[Matricia] Nouvelle demande publique ${input.category}`,
    body: `Référence : ${requestId.slice(0, 8).toUpperCase()}\nCatégorie : ${input.category}\nAdresse de réponse : ${input.replyEmail}\n\n${input.message}`,
    ctaPath: null,
    providerIdempotencyKey: `public-contact:${requestId}`,
  }, { env: environment, fetch });
}

export async function submitContactRequest(_: ContactActionState, formData: FormData): Promise<ContactActionState> {
  const sourceRaw = String(formData.get("sourcePath") ?? "").trim();
  const parsed = inputSchema.safeParse({
    locale: formData.get("locale"),
    category: formData.get("category"),
    replyEmail: formData.get("replyEmail"),
    message: formData.get("message"),
    website: formData.get("website") ?? "",
    sourcePath: sourceRaw || undefined,
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const headerStore = await headers();
  const sourcePath = parsed.data.sourcePath ?? `/${parsed.data.locale}/contact`;
  const result = await getSupabaseAdminClient().rpc("submit_public_contact_request", {
    p_category: parsed.data.category,
    p_reply_email: parsed.data.replyEmail,
    p_message: parsed.data.message,
    p_locale: parsed.data.locale,
    p_source_path: sourcePath,
    p_ip_hash: requesterHash(headerStore),
  });
  if (result.error) return { status: "error", reason: result.error.message.includes("RATE_LIMITED") ? "RATE_LIMITED" : "UNAVAILABLE" };
  const requestId = typeof result.data === "string" ? result.data : "";
  const reference = requestId.slice(0, 8).toUpperCase();
  if (reference) await notifySupport(requestId, parsed.data);
  return reference ? { status: "success", reference } : { status: "error", reason: "UNAVAILABLE" };
}

import { z } from "zod";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";
import { deliverNotification } from "@/modules/shared/lib/notification-delivery/adapter";
import { networkInvitationToken, networkInvitationTokenHash } from "./invitation-token";

const loaded = z.object({
  outcome: z.literal("READY"), invitation_id: z.string().uuid(), locale: z.enum(["fr", "ar"]),
  contact_email: z.string().email(), operator_name: z.string().min(1).max(200),
  prospect_type: z.enum(["CLIENT", "PROVIDER"]), expires_at: z.string(), token_hash: z.string().regex(/^[0-9a-f]{64}$/u),
}).strict();
const done = z.object({ outcome: z.enum(["ALREADY_SENT", "CANCELLED"]), invitation_id: z.string().uuid() }).strict();

export async function consumeFranchiseNetworkInvitation(outboxId: string, invitationId: string): Promise<{ ok: boolean; code: string }> {
  const admin = getSupabaseAdminClient();
  const response = await admin.rpc("load_franchise_network_invitation_delivery_v1", { p_outbox_id: outboxId, p_invitation_id: invitationId });
  if (response.error) return { ok: false, code: "FRANCHISE_NETWORK_DELIVERY_UNAVAILABLE" };
  const finished = done.safeParse(response.data);
  if (finished.success && finished.data.invitation_id === invitationId) return { ok: true, code: finished.data.outcome };
  const parsed = loaded.safeParse(response.data);
  if (!parsed.success || parsed.data.invitation_id !== invitationId) return { ok: false, code: "FRANCHISE_NETWORK_DELIVERY_INVALID" };
  const i = parsed.data;
  let token: string;
  try { token = networkInvitationToken(invitationId); } catch { return { ok: false, code: "FRANCHISE_NETWORK_KEY_UNCONFIGURED" }; }
  if (networkInvitationTokenHash(token) !== i.token_hash) return { ok: false, code: "FRANCHISE_NETWORK_KEY_MISMATCH" };
  // Fail closed rather than silently sending an email without its usable link.
  try {
    const origin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "");
    if (origin.protocol !== "https:" || origin.username || origin.password) return { ok: false, code: "FRANCHISE_NETWORK_ORIGIN_INVALID" };
  } catch { return { ok: false, code: "FRANCHISE_NETWORK_ORIGIN_INVALID" }; }
  const ar = i.locale === "ar";
  const path = `/${i.locale}/rejoindre-reseau?${new URLSearchParams({ invitationId, token })}`;
  const result = await deliverNotification({
    deliveryId: outboxId, channel: "EMAIL", recipientEmail: i.contact_email, locale: ar ? "ar-MA" : "fr-MA",
    subject: ar ? `دعوة إلى شبكة ماتريسيا من ${i.operator_name}` : `Invitation au réseau Matricia par ${i.operator_name}`,
    body: ar
      ? "دعوة للتعرّف على شبكة الخدمات المهنية. سجّلوا الدخول ببريد الدعوة واختاروا مؤسستكم المخوّلة. لا تمنح الدعوة دوراً أو اعتماداً مهنياً أو حقاً مالياً. الرابط صالح لمدة 30 يوماً من إنشائه."
      : "Vous êtes invité(e) à rejoindre le réseau de services professionnels. Connectez-vous avec l’adresse destinataire puis sélectionnez votre organisation autorisée. Cette invitation n’accorde aucun rôle, aucune qualification ni aucun droit économique. Le lien expire 30 jours après sa création.",
    ctaPath: path, providerIdempotencyKey: `franchise-network-invitation:${invitationId}`,
  }, { env: process.env, fetch });
  if (result.outcome !== "DELIVERED" && result.outcome !== "SENT") return { ok: false, code: "errorCode" in result ? result.errorCode : "FRANCHISE_NETWORK_DELIVERY_INVALID" };
  const complete = await admin.rpc("complete_franchise_network_invitation_delivery_v1", {
    p_outbox_id: outboxId, p_invitation_id: invitationId, p_provider_message_id: result.providerMessageId,
    p_delivery_mode: result.evidence.adapter === "EMAIL_DEMO" ? "NON_CONTRACTUAL_DEMO" : "EXTERNAL",
  });
  const final = z.object({ outcome: z.enum(["FRANCHISE_NETWORK_INVITATION_SENT", "CANCELLED"]), invitation_id: z.literal(invitationId) }).safeParse(complete.data);
  return complete.error || !final.success ? { ok: false, code: "FRANCHISE_NETWORK_DELIVERY_UNCONFIRMED" } : { ok: true, code: final.data.outcome };
}

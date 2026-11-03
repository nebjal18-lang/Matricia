"use server";

import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { networkInvitationTokenHash } from "@/modules/franchise/data/network/invitation-token";
import { networkLinkSchema, openedInvitationSchema, type NetworkRecipientState } from "./recipient-model";

function failure(error: { code?: string; message?: string }): NetworkRecipientState {
  return { status: "error", reason: /MFA_REQUIRED/u.test(error.message ?? "") ? "MFA_REQUIRED" : error.code === "42501" ? "FORBIDDEN" : error.code === "55000" ? "INACTIVE" : error.code === "23505" || error.code === "22000" ? "CONFLICT" : "FAILED" };
}

export async function openFranchiseNetworkInvitation(_: NetworkRecipientState, form: FormData): Promise<NetworkRecipientState> {
  const parsed = networkLinkSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const client = await getSupabaseServerClient();
  const auth = await client.auth.getUser();
  if (auth.error && auth.error.status !== 401) return { status: "error", reason: "FAILED" };
  if (!auth.data.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const loaded = await client.rpc("open_franchise_network_invitation_v1", { p_invitation_id: parsed.data.invitationId, p_token_hash: networkInvitationTokenHash(parsed.data.token) });
  if (loaded.error) return failure(loaded.error);
  const invitation = openedInvitationSchema.safeParse(loaded.data);
  return invitation.success && invitation.data.invitation_id === parsed.data.invitationId ? { status: "opened", invitation: invitation.data } : { status: "error", reason: "FAILED" };
}

export async function acceptFranchiseNetworkInvitation(_: NetworkRecipientState, form: FormData): Promise<NetworkRecipientState> {
  const parsed = networkLinkSchema.extend({ organizationId: z.string().uuid(), idempotencyKey: z.string().uuid(), confirmed: z.literal("yes") }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const client = await getSupabaseServerClient();
  const auth = await client.auth.getUser();
  if (auth.error && auth.error.status !== 401) return { status: "error", reason: "FAILED" };
  if (!auth.data.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const accepted = await client.rpc("accept_franchise_network_invitation_v1", {
    p_invitation_id: parsed.data.invitationId, p_token_hash: networkInvitationTokenHash(parsed.data.token),
    p_target_organization_id: parsed.data.organizationId, p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (accepted.error) return failure(accepted.error);
  const result = z.object({ outcome: z.literal("FRANCHISE_NETWORK_REFERRAL_REGISTERED"), invitation_id: z.literal(parsed.data.invitationId), organization_id: z.literal(parsed.data.organizationId), prospect_type: z.enum(["CLIENT", "PROVIDER"]) }).safeParse(accepted.data);
  return result.success ? { status: "success", organizationId: result.data.organization_id, prospectType: result.data.prospect_type } : { status: "error", reason: "FAILED" };
}

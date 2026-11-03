"use server";

import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { invitationStatusRows, type NetworkInvitationStatusState } from "./invitation-status-model";

export async function loadFranchiseNetworkInvitationStatus(_: NetworkInvitationStatusState, form: FormData): Promise<NetworkInvitationStatusState> {
  const input = z.object({ franchiseId: z.string().uuid(), page: z.coerce.number().int().min(1).max(100000) }).safeParse(Object.fromEntries(form));
  if (!input.success) return { status: "error", reason: "VALIDATION" };
  const client = await getSupabaseServerClient(), auth = await client.auth.getUser();
  if (auth.error && auth.error.status !== 401) return { status: "error", reason: "FAILED" };
  if (!auth.data.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const access = await client.rpc("franchise_actor_capabilities", { p_franchise_id: input.data.franchiseId });
  if (access.error) return { status: "error", reason: access.error.code === "42501" ? "FORBIDDEN" : "FAILED" };
  const scope = z.object({ read: z.boolean() }).safeParse(access.data);
  if (!scope.success) return { status: "error", reason: "FAILED" };
  if (!scope.data.read) return { status: "error", reason: "FORBIDDEN" };
  const result = await client.from("franchise_network_invitation_status_v1")
    .select("id,contact_email,locale,status,delivery_mode,created_at,sent_at,opened_at,registered_at,expires_at", { count: "exact" })
    .eq("franchise_id", input.data.franchiseId).order("created_at", { ascending: false }).order("id", { ascending: false })
    .range((input.data.page - 1) * 25, input.data.page * 25 - 1);
  if (result.error) return { status: "error", reason: result.error.code === "42501" ? "FORBIDDEN" : "FAILED" };
  const rows = invitationStatusRows.safeParse(result.data);
  return rows.success && Number.isSafeInteger(result.count) && result.count !== null && result.count >= 0
    ? { status: "success", rows: rows.data, page: input.data.page, total: result.count }
    : { status: "error", reason: "FAILED" };
}

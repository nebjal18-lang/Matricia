import {
  buildDemoNetworkInvitations,
  canApplyAdminDemoNetworkInvitations,
} from "@/modules/admin/data/spaces/demo-network-invitations";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

export type NetworkInvitationRow = {
  id: string;
  franchiseId: string;
  status: string;
  statusLabel: string;
  prospectType: string;
  contactEmailMasked: string;
  locale: string;
  deliveryMode: string;
  queuedAt: string;
  sentAt: string | null;
  openedAt: string | null;
  registeredAt: string | null;
  expiresAt: string;
  referralOrganizationId: string | null;
  operatorLabel: string;
};

export type NetworkInvitationsLoad =
  | { status: "success"; rows: NetworkInvitationRow[] }
  | { status: "error"; reason: "FORBIDDEN" | "MFA_REQUIRED" | "FAILED" };

export async function loadAdminNetworkInvitationsSupervision(locale: "fr" | "ar"): Promise<NetworkInvitationsLoad> {
  if (canApplyAdminDemoNetworkInvitations()) {
    return { status: "success", rows: buildDemoNetworkInvitations(locale) };
  }
  const client = await getSupabaseServerClient();
  const { data, error } = await client.rpc("get_admin_network_invitations_supervision_v1", { p_locale: locale });
  if (error) {
    const message = error.message ?? "";
    if (message.includes("MFA_REQUIRED") || message.includes("AAL")) return { status: "error", reason: "MFA_REQUIRED" };
    if (message.includes("DENIED") || message.includes("42501")) return { status: "error", reason: "FORBIDDEN" };
    return { status: "error", reason: "FAILED" };
  }
  const rows = Array.isArray((data as { rows?: unknown })?.rows)
    ? ((data as { rows: NetworkInvitationRow[] }).rows ?? [])
    : [];
  return { status: "success", rows };
}

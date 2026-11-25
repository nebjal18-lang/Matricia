import { createHash } from "node:crypto";
import { demoRegionalIds } from "@/app/[locale]/connexion/demo-regional-ensure";
import {
  listDemoRegionalActors,
  listDemoRegionalTerritories,
} from "@/app/[locale]/connexion/demo-regional-directory";
import { isDemoClientHomeEnabled } from "@/modules/client/data/home/demo-scenario";
import type { NetworkInvitationRow } from "@/modules/admin/screens/network-invitations/load";

export function canApplyAdminDemoNetworkInvitations() {
  return isDemoClientHomeEnabled();
}

function demoId(seed: string): string {
  const hex = createHash("sha256").update(`DEMO_NETWORK_INVITE_V1:${seed}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@matricia.test";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

const STATUS_FLOW = ["SENT", "OPENED", "REGISTERED", "SENT", "EXPIRED", "REGISTERED"] as const;

function statusLabel(status: string, locale: "fr" | "ar") {
  const map: Record<string, { fr: string; ar: string }> = {
    SENT: { fr: "Envoyée", ar: "مُرسلة" },
    OPENED: { fr: "Ouverte", ar: "مفتوحة" },
    REGISTERED: { fr: "Inscrit", ar: "مسجّل" },
    EXPIRED: { fr: "Expirée", ar: "منتهية" },
  };
  return map[status]?.[locale] ?? status;
}

/** Supervision démo : une invitation CLIENT + une PROVIDER par région. */
export function buildDemoNetworkInvitations(locale: "fr" | "ar" = "fr"): NetworkInvitationRow[] {
  const rows: NetworkInvitationRow[] = [];
  for (const [index, territory] of listDemoRegionalTerritories().entries()) {
    const actors = listDemoRegionalActors(territory.code);
    const franchise = actors.find((item) => item.kind === "franchise");
    const client = actors.find((item) => item.kind === "client" && item.slot === "1");
    const provider = actors.find((item) => item.kind === "provider" && item.slot === "A");
    if (!franchise) continue;
    const specs = [
      { kind: "CLIENT" as const, actor: client, status: STATUS_FLOW[index % STATUS_FLOW.length]! },
      { kind: "PROVIDER" as const, actor: provider, status: STATUS_FLOW[(index + 2) % STATUS_FLOW.length]! },
    ];
    for (const spec of specs) {
      if (!spec.actor) continue;
      const registered = spec.status === "REGISTERED";
      const opened = registered || spec.status === "OPENED";
      const expired = spec.status === "EXPIRED";
      rows.push({
        id: demoId(`invite:${territory.code}:${spec.kind}`),
        franchiseId: demoId(`franchise:${territory.code}`),
        status: spec.status,
        statusLabel: statusLabel(spec.status, locale),
        prospectType: spec.kind,
        contactEmailMasked: maskEmail(spec.actor.email),
        locale,
        deliveryMode: "EMAIL",
        queuedAt: "2026-09-10T09:00:00.000Z",
        sentAt: expired ? "2026-08-01T09:00:00.000Z" : "2026-09-10T09:05:00.000Z",
        openedAt: opened ? "2026-09-11T10:00:00.000Z" : null,
        registeredAt: registered ? "2026-09-12T14:00:00.000Z" : null,
        expiresAt: expired ? "2026-08-15T09:00:00.000Z" : "2026-12-31T23:59:59.000Z",
        referralOrganizationId: registered ? demoRegionalIds(spec.actor).organizationId : null,
        operatorLabel: franchise.labelFr,
      });
    }
  }
  return rows;
}

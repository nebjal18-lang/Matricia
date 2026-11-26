import { createHash } from "node:crypto";
import { demoRegionalIds } from "@/app/[locale]/connexion/demo-regional-ensure";
import {
  listDemoRegionalActors,
  listDemoRegionalTerritories,
} from "@/app/[locale]/connexion/demo-regional-directory";
import { isDemoClientHomeEnabled } from "@/modules/client/data/home/demo-scenario";
import type { AdminCommandCenter } from "@/modules/admin/data/command-center/model";
import type {
  AdminCommerceCatalog,
  AdminDocumentVault,
  AdminVolumeDemand,
} from "@/modules/admin/data/catalog/model";
import type { AdminFinanceDashboard } from "@/modules/admin/data/finance/model";
import type { AdminOperationsDashboard } from "@/modules/admin/data/operations/model";

export function canApplyAdminDemoHubs() {
  return isDemoClientHomeEnabled();
}

function demoId(seed: string): string {
  const hex = createHash("sha256").update(`DEMO_HUB_V1:${seed}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function hash64(seed: string) {
  return createHash("sha256").update(seed).digest("hex");
}

function clientProviderPairs() {
  const pairs: Array<{
    territory: string;
    clientId: string;
    clientName: string;
    providerId: string;
    providerName: string;
  }> = [];
  for (const territory of listDemoRegionalTerritories()) {
    const actors = listDemoRegionalActors(territory.code);
    const client = actors.find((item) => item.kind === "client" && item.slot === "1");
    const provider = actors.find((item) => item.kind === "provider" && item.slot === "A");
    if (!client || !provider) continue;
    pairs.push({
      territory: territory.code,
      clientId: demoRegionalIds(client).organizationId,
      clientName: client.labelFr,
      providerId: demoRegionalIds(provider).organizationId,
      providerName: provider.labelFr,
    });
  }
  return pairs;
}

export function buildDemoCommandCenter(nowIso = new Date().toISOString()): AdminCommandCenter {
  const pairs = clientProviderPairs();
  const now = new Date(nowIso).getTime();
  const dayMs = 86_400_000;
  const workItems = pairs.slice(0, 12).map((pair, index) => {
    const id = demoId(`work:${pair.territory}`);
    // Mix overdue / today / future relative to the hub clock (Casablanca day bounds via dueAt).
    const dueOffsetDays = index < 4 ? -(index + 1) : index === 4 || index === 5 ? 0 : index - 4;
    const dueAt = new Date(now + dueOffsetDays * dayMs).toISOString();
    const priority = (index % 5 === 0 ? "CRITICAL" : index % 4 === 0 ? "HIGH" : "MEDIUM") as "CRITICAL" | "HIGH" | "MEDIUM";
    return {
      id,
      queueKey: index % 2 === 0 ? "COMPLIANCE_REVIEW" : "MISSION_FOLLOWUP",
      queueLabelFr: index % 2 === 0 ? "Revue conformité" : "Suivi mission",
      queueLabelAr: index % 2 === 0 ? "مراجعة الامتثال" : "متابعة المهمة",
      organizationId: index % 2 === 0 ? pair.clientId : pair.providerId,
      sourceKind: "SYSTEM",
      resourceType: index % 2 === 0 ? "organization" : "mission",
      resourceId: demoId(`resource:${pair.territory}:${index}`),
      titleFr: `${index % 2 === 0 ? "Conformité" : "Jalon"} · ${pair.clientName}`,
      titleAr: `${index % 2 === 0 ? "امتثال" : "معلم"} · ${pair.clientName}`,
      priority,
      status: "OPEN",
      dueAt,
      assignedTo: null,
      rowVersion: 1,
      canClaim: true,
      canResolve: false,
    };
  });
  return {
    actionPage: 1,
    actionStatus: "ALL",
    hasMoreActions: false,
    capabilities: { requestAction: true },
    workItems,
    actions: workItems.slice(0, 4).map((item, index) => {
      const pair = pairs[index]!;
      return {
        id: demoId(`action:${index}:${pair.territory}`),
        workItemId: item.id,
        organizationId: item.organizationId,
        actionType: "ASSIGN_CASE" as const,
        targetEnvironment: "DEVELOPMENT" as const,
        resourceType: item.resourceType,
        resourceId: item.resourceId,
        reason: `Attribution démo — ${pair.clientName} (${item.resourceType}).`,
        approvalsRequired: 1,
        status: "PENDING_APPROVAL" as const,
        requestedAt: new Date(now - (index + 1) * dayMs).toISOString(),
        rowVersion: 1,
        canDecide: true,
      };
    }),
  };
}

export function buildDemoFinanceDashboard(): AdminFinanceDashboard {
  const pairs = clientProviderPairs();
  const asOf = "2026-09-20T12:00:00.000Z";
  return {
    as_of: asOf,
    payment_intents: pairs.slice(0, 8).map((pair) => ({
      id: demoId(`intent:${pair.territory}`),
      organization_id: pair.clientId,
      organization_name: pair.clientName,
      plan_version_id: demoId("plan:GOLD"),
      billing_interval: "MONTHLY" as const,
      gateway: "DEMO" as const,
      amount_minor: "299000",
      currency: "MAD",
      status: "ACTIVATED" as const,
      created_at: asOf,
    })),
    payment_events: pairs.slice(0, 8).map((pair, index) => ({
      id: String(9000 + index),
      payment_intent_id: demoId(`intent:${pair.territory}`),
      organization_id: pair.clientId,
      organization_name: pair.clientName,
      gateway: "DEMO" as const,
      event_type: "PAYMENT_SUCCEEDED" as const,
      amount_minor: "299000",
      currency: "MAD",
      paid_at: asOf,
      received_at: asOf,
    })),
    subscriptions: pairs.slice(0, 8).map((pair) => ({
      id: demoId(`sub:${pair.territory}`),
      organization_id: pair.clientId,
      organization_name: pair.clientName,
      status: "ACTIVE" as const,
      plan_code: "GOLD" as const,
      billing_interval: "MONTHLY" as const,
      current_period_start: "2026-09-01T00:00:00.000Z",
      current_period_end: "2026-10-01T00:00:00.000Z",
      pending_plan_version_id: null,
      pending_change_effective_at: null,
      row_version: "1",
      updated_at: asOf,
    })),
    cycles: pairs.slice(0, 8).map((pair) => ({
      id: demoId(`cycle:${pair.territory}`),
      subscription_id: demoId(`sub:${pair.territory}`),
      organization_id: pair.clientId,
      organization_name: pair.clientName,
      plan_code: "GOLD" as const,
      cycle_number: 1,
      period_start: "2026-09-01T00:00:00.000Z",
      period_end: "2026-10-01T00:00:00.000Z",
      currency: "MAD",
      amount_minor: "299000",
      created_at: asOf,
    })),
    provider_payments: pairs.slice(0, 8).map((pair) => ({
      id: demoId(`ppay:${pair.territory}`),
      organization_id: pair.providerId,
      organization_name: pair.providerName,
      payment_reference: `DEMO-PAY-${pair.territory.slice(0, 8)}`,
      currency: "MAD",
      amount_minor: "800000",
      allocated_minor: "500000",
      unallocated_minor: "300000",
      paid_on: "2026-09-15",
    })),
    provider_invoices: pairs.slice(0, 8).map((pair) => ({
      id: demoId(`pinv:${pair.territory}`),
      organization_id: pair.providerId,
      organization_name: pair.providerName,
      invoice_number: `FAC-DEMO-${pair.territory.slice(0, 6)}`,
      currency: "MAD",
      total_minor: "800000",
      paid_minor: "500000",
      outstanding_minor: "300000",
      payment_status: "PARTIALLY_PAID" as const,
      due_on: "2026-09-30",
    })),
  };
}

export function buildDemoCommerceCatalog(): AdminCommerceCatalog {
  const now = "2026-09-01T00:00:00.000Z";
  return {
    generated_at: now,
    capabilities: { can_write: true, can_activate: true },
    packs: [
      {
        id: demoId("pack:starter"),
        pack_id: demoId("pack:starter:root"),
        code: "DEMO_CREDITS_STARTER",
        version: 1,
        status: "ACTIVE",
        name_fr: "Pack crédits Starter",
        name_ar: "حزمة أرصدة للمبتدئين",
        quantity: "100",
        price_minor: "9900",
        currency: "MAD",
        validity_days: 365,
      },
      {
        id: demoId("pack:pro"),
        pack_id: demoId("pack:pro:root"),
        code: "DEMO_CREDITS_PRO",
        version: 1,
        status: "ACTIVE",
        name_fr: "Pack crédits Pro",
        name_ar: "حزمة أرصدة احترافية",
        quantity: "500",
        price_minor: "39900",
        currency: "MAD",
        validity_days: 365,
      },
    ],
    promotions: [
      {
        id: demoId("promo:welcome"),
        code: "DEMO_WELCOME",
        version: 1,
        status: "ACTIVE",
        name_fr: "Bonus bienvenue",
        name_ar: "مكافأة ترحيب",
        bonus_credits: "25",
        validity_days: 30,
        effective_from: now,
        effective_until: "2026-12-31T23:59:59.000Z",
        approval_reference: "DEMO-PROMO-1",
      },
    ],
    parameters: [
      {
        id: demoId("param:margin"),
        parameter_key: "BOX_PLATFORM_MARGIN_BPS",
        version: 1,
        status: "ACTIVE",
        value_integer: "1500",
        effective_from: now,
        change_reason: "Marge plateforme démo versionnée pour Box wholesale.",
      },
    ],
  };
}

export function buildDemoVolumeDemand(): AdminVolumeDemand {
  return {
    generated_at: "2026-09-20T12:00:00.000Z",
    default_reservation_ttl_hours: "72",
    history: [
      {
        month_start: "2026-08-01",
        sku_code: "DEMO_COM_STRATEGY",
        reserved_units: "120",
        consumed_units: "95",
        reservation_count: 12,
      },
    ],
    forecasts: [
      {
        agreement_code: "DEMO_CASABLANCA_SETTAT_COM_A",
        sku_code: "DEMO_COM_STRATEGY",
        status: "ACTIVE",
        forecast_units: "140",
        valid_from: "2026-09-01",
        valid_to: "2026-12-31",
      },
    ],
  };
}

export function buildDemoDocumentVault(): AdminDocumentVault {
  const pairs = clientProviderPairs();
  return {
    generated_at: "2026-09-20T12:00:00.000Z",
    warning_days: 30,
    documents: pairs.flatMap((pair) => [
      {
        id: demoId(`vault:client:${pair.territory}`),
        organization_id: pair.clientId,
        organization_name: pair.clientName,
        source: "CLIENT" as const,
        document_type: "RC",
        status: "VERIFIED",
        expires_on: null,
        version: 1,
        expiring: false,
      },
      {
        id: demoId(`vault:provider:${pair.territory}`),
        organization_id: pair.providerId,
        organization_name: pair.providerName,
        source: "PROVIDER" as const,
        document_type: "INSURANCE",
        status: "EXPIRING",
        expires_on: "2026-12-01",
        version: 2,
        expiring: true,
      },
    ]),
  };
}

export function buildDemoOperationsDashboard(): AdminOperationsDashboard {
  const correlation = demoId("ops:correlation");
  const events = [
    {
      id: "10001",
      actorType: "SYSTEM" as const,
      action: "outbox.dispatch",
      resourceType: "event_outbox",
      correlationId: correlation,
      occurredAt: "2026-09-20T11:00:00.000Z",
      eventHash: hash64("outbox.dispatch"),
      signal: "OUTBOX" as const,
    },
    {
      id: "10002",
      actorType: "SERVICE" as const,
      action: "notification.delivered",
      resourceType: "notification",
      correlationId: correlation,
      occurredAt: "2026-09-20T11:01:00.000Z",
      eventHash: hash64("notification.delivered"),
      signal: "NOTIFICATION" as const,
    },
    {
      id: "10003",
      actorType: "SYSTEM" as const,
      action: "worker.dead_letter",
      resourceType: "job",
      correlationId: demoId("ops:dlq"),
      occurredAt: "2026-09-20T11:02:00.000Z",
      eventHash: hash64("worker.dead_letter"),
      signal: "DEAD_LETTER" as const,
    },
  ];
  return {
    capabilities: {
      audit: true,
      outbox: { available: true, reason: null },
      notificationDeliveries: { available: true, reason: null },
      actions: true,
    },
    summary: {
      auditedEvents: events.length,
      systemEvents: 2,
      notificationSignals: 1,
      deadLetterSignals: 1,
      outboxSignals: 1,
    },
    events,
    social: { jobs: [], requests: [] },
    media: { jobs: [], executions: [] },
    attachmentScans: [{ status: "CLEAN", count: "12", oldest_seconds: "0" }],
    privacyFileScans: { available: true, rows: [{ status: "CLEAN", count: "4", oldest_seconds: "0" }] },
    refunds: { canAct: true, reconciliations: [], payments: [], requests: [] },
    operational: {
      heartbeats: [
        { service: "worker", observed_at: "2026-09-20T12:00:00.000Z", healthy: true },
        { service: "outbox", observed_at: "2026-09-20T12:00:00.000Z", healthy: true },
      ],
      deadLetters: [
        {
          id: "42",
          event_type: "notification.dispatch",
          attempt_count: 5,
          dead_lettered_at: "2026-09-19T08:00:00.000Z",
          last_error_code: "DEMO_RETRY_EXHAUSTED",
          replayable: true,
        },
      ],
      replayRequests: [],
    },
  };
}

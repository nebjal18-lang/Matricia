export type OperationsCapability = {
  available: boolean;
  reason: "SAFE_PROJECTION_UNAVAILABLE" | null;
};

export type SafeAuditEvent = {
  id: string;
  actorType: "USER" | "SERVICE" | "SYSTEM";
  action: string;
  resourceType: string;
  correlationId: string;
  occurredAt: string;
  eventHash: string;
  signal: "GENERAL" | "NOTIFICATION" | "DEAD_LETTER" | "OUTBOX";
};

export type AdminOperationsDashboard = {
  capabilities: {
    audit: true;
    outbox: OperationsCapability;
    notificationDeliveries: OperationsCapability;
    actions: boolean;
  };
  summary: {
    auditedEvents: number;
    systemEvents: number;
    notificationSignals: number;
    deadLetterSignals: number;
    outboxSignals: number;
  };
  events: SafeAuditEvent[];
  privacyFileScans?: {available:boolean;rows:Array<{status:string;count:string;oldest_seconds:string}>};
  attachmentScans?: Array<{status:string;count:string;oldest_seconds:string}>;
  media?: { jobs: Array<{id:string;channel:string;asset_ready:boolean}>;executions:Array<{id:string;job_id:string;state:string;error_code:string|null;container_id:string|null;deadline_at:string;investigation_status:string|null}> };
  social?: { jobs: Array<{ id: string; provider: string; channel: string; claimed_at: string | null }>; requests: Array<{ id: string; job_id: string; status: string; requested_at: string }> };
  refunds?: {
    canAct: boolean;
    reconciliations: Array<{ id: string; refund_request_id: string; provider_refund_id: string; reason: string; status: string; requested_at: string; other_requester: boolean }>;
    payments: Array<{ id: string; organization_id: string; amount_minor: string; refunded_minor: string; currency: string; paid_at: string }>;
    requests: Array<{ id: string; payment_event_id: string; amount_minor: string; currency: string; reason: string; status: string; requested_at: string; other_requester: boolean }>;
  };
  operational?: {
    heartbeats: Array<{ service: string; observed_at: string; healthy: boolean }>;
    deadLetters: Array<{ id: string; event_type: string; attempt_count: number; dead_lettered_at: string; last_error_code: string | null; replayable: boolean }>;
    replayRequests: Array<{ id: string; event_id: string; reason: string; canApprove: boolean }>;
  };
};

export type AdminOperationsResult =
  | { status: "success"; value: AdminOperationsDashboard }
  | { status: "error"; reason: "UNAUTHENTICATED" | "MFA_REQUIRED" | "FORBIDDEN" | "UNAVAILABLE" | "INVALID_RESPONSE" };

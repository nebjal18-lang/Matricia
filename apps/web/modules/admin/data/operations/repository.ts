import { z } from "zod";
import { hasPlatformRole, loadMyPlatformAccess } from "@/modules/shared/lib/account-security/platform-access";
import type { AdminOperationsResult, SafeAuditEvent } from "./model";

const allowedRoles = ["SUPER_ADMIN", "MATRICIA_ADMIN", "FINANCE_MANAGER", "READ_ONLY_AUDITOR"] as const;
const bigintId = z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]).transform(String);
const auditRow = z.object({
  id: bigintId,
  actor_type: z.enum(["USER", "SERVICE", "SYSTEM"]),
  action: z.string().min(1).max(160),
  resource_type: z.string().min(1).max(160),
  correlation_id: z.string().uuid(),
  occurred_at: z.string(),
  event_hash: z.string().regex(/^[0-9a-f]{64}$/),
}).strict();

function classify(action: string): SafeAuditEvent["signal"] {
  const normalized = action.toLowerCase();
  if (normalized.includes("dead_letter")) return "DEAD_LETTER";
  if (normalized.startsWith("notification.")) return "NOTIFICATION";
  if (normalized.includes("outbox")) return "OUTBOX";
  return "GENERAL";
}

export async function loadAdminOperationsDashboard(): Promise<AdminOperationsResult> {
  const access = await loadMyPlatformAccess();
  if (access.status === "error") {
    return { status: "error", reason: access.reason === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : access.reason === "INVALID_RESPONSE" ? "INVALID_RESPONSE" : "UNAVAILABLE" };
  }
  if (!hasPlatformRole(access.roles, allowedRoles)) return { status: "error", reason: "FORBIDDEN" };
  if (!access.requirementSatisfied) return { status: "error", reason: "MFA_REQUIRED" };

  // Deliberately excludes organization/user identifiers, IP, user-agent and metadata/payload.
  const eventsQuery = await access.client.from("audit_events")
    .select("id,actor_type,action,resource_type,correlation_id,occurred_at,event_hash")
    .order("occurred_at", { ascending: false }).order("id", { ascending: false }).limit(200);
  if (eventsQuery.error) return { status: "error", reason: "UNAVAILABLE" };
  const rows = z.array(auditRow).safeParse(eventsQuery.data);
  if (!rows.success) return { status: "error", reason: "INVALID_RESPONSE" };

  const events: SafeAuditEvent[] = rows.data.map((event) => ({
    id: event.id,
    actorType: event.actor_type,
    action: event.action,
    resourceType: event.resource_type,
    correlationId: event.correlation_id,
    occurredAt: event.occurred_at,
    eventHash: event.event_hash,
    signal: classify(event.action),
  }));
  const count = (signal: SafeAuditEvent["signal"]) => events.filter((event) => event.signal === signal).length;

  const healthResult = await access.client.rpc("operational_health_v1", { p_required_services: [] });
  const health = z.object({
    heartbeats: z.array(z.object({ service: z.string(), observed_at: z.string(), healthy: z.boolean() })),
    dead_letters: z.array(z.object({ id: bigintId, event_type: z.string(), attempt_count: z.number(), dead_lettered_at: z.string(), last_error_code: z.string().nullable(), replayable: z.boolean() })),
  }).safeParse(healthResult.data);
  if (healthResult.error || !health.success) return { status: "error", reason: "UNAVAILABLE" };
  const pending = await access.client.from("operational_replay_requests").select("id,event_id::text,reason,requested_by").eq("status", "PENDING").order("requested_at", { ascending: true }).limit(100);
  const requests = z.array(z.object({ id: z.string().uuid(), event_id: bigintId, reason: z.string(), requested_by: z.string().uuid() })).safeParse(pending.data);
  if (pending.error || !requests.success) return { status: "error", reason: "UNAVAILABLE" };
  const refundResult = await access.client.rpc("list_subscription_refund_operations_v1");
  const refunds = z.object({
    can_act: z.boolean(),
    reconciliations: z.array(z.object({ id: z.string().uuid(), refund_request_id: z.string().uuid(), provider_refund_id: z.string(), reason: z.string(), status: z.string(), requested_at: z.string(), other_requester: z.boolean() })),
    payments: z.array(z.object({ id: bigintId, organization_id: z.string().uuid(), amount_minor: z.string().regex(/^\d+$/u), refunded_minor: z.string().regex(/^\d+$/u), currency: z.string(), paid_at: z.string() })),
    requests: z.array(z.object({ id: z.string().uuid(), payment_event_id: bigintId, amount_minor: z.string(), currency: z.string(), reason: z.string(), status: z.string(), requested_at: z.string(), other_requester: z.boolean() })),
  }).safeParse(refundResult.data);
  if (refundResult.error || !refunds.success) return { status: "error", reason: "UNAVAILABLE" };
  const socialResult = await access.client.rpc("list_social_native_operations_v1");
  const social = z.object({ jobs: z.array(z.object({ id: z.string().uuid(), provider: z.string(), channel: z.string(), claimed_at: z.string().nullable() })), requests: z.array(z.object({ id: z.string().uuid(), job_id: z.string().uuid(), status: z.string(), requested_at: z.string() })) }).safeParse(socialResult.data);
  if (socialResult.error || !social.success) return { status: "error", reason: "UNAVAILABLE" };
  const mediaResult=await access.client.rpc("list_social_media_operations_v1");
  const media=z.object({jobs:z.array(z.object({id:z.string().uuid(),channel:z.string(),asset_ready:z.boolean()})),executions:z.array(z.object({id:z.string().uuid(),job_id:z.string().uuid(),state:z.string(),error_code:z.string().nullable(),container_id:z.string().nullable(),deadline_at:z.string(),investigation_status:z.string().nullable()}))}).safeParse(mediaResult.data);
  if(mediaResult.error||!media.success)return {status:"error",reason:"UNAVAILABLE"};
  const attachmentsResult=await access.client.rpc("get_internal_message_attachment_operations_v1");
  const attachments=z.array(z.object({status:z.enum(["PENDING","RETRY_PENDING","DEAD_LETTER","CLEAN","REJECTED","HISTORICAL_ERROR"]),count:z.string().regex(/^\d+$/u),oldest_seconds:z.string().regex(/^\d+$/u)})).safeParse(attachmentsResult.data);
  if(attachmentsResult.error||!attachments.success)return {status:"error",reason:"UNAVAILABLE"};
  const privacyFilesResult=await access.client.rpc("get_privacy_file_operations_v1").abortSignal(AbortSignal.timeout(5000));
  const privacyFiles=z.array(z.object({status:z.enum(["PENDING","RETRY_PENDING","DEAD_LETTER","CLEAN","REJECTED","HISTORICAL_ERROR"]),count:z.string().regex(/^\d+$/u),oldest_seconds:z.string().regex(/^\d+$/u)})).safeParse(privacyFilesResult.data);
  const canAct = hasPlatformRole(access.roles, ["SUPER_ADMIN", "MATRICIA_ADMIN"]);
  return { status: "success", value: {
    capabilities: {
      audit: true,
      outbox: { available: true, reason: null },
      notificationDeliveries: { available: false, reason: "SAFE_PROJECTION_UNAVAILABLE" },
      actions: canAct,
    },
    summary: {
      auditedEvents: events.length,
      systemEvents: events.filter((event) => event.actorType !== "USER").length,
      notificationSignals: count("NOTIFICATION"),
      deadLetterSignals: count("DEAD_LETTER"),
      outboxSignals: count("OUTBOX"),
    },
    events,
    social: social.data,
    media: media.data,
    attachmentScans:attachments.data,
    privacyFileScans:{available:!privacyFilesResult.error&&privacyFiles.success,rows:privacyFiles.success?privacyFiles.data:[]},
    refunds: { canAct: refunds.data.can_act, reconciliations: refunds.data.reconciliations, payments: refunds.data.payments, requests: refunds.data.requests },
    operational: { heartbeats: health.data.heartbeats, deadLetters: health.data.dead_letters,
      replayRequests: requests.data.map(row => ({ id: row.id, event_id: row.event_id, reason: row.reason, canApprove: canAct && row.requested_by !== access.userId })) },
  } };
}

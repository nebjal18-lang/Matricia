import { scanOneFinanceCostDocument } from "@/modules/shared/lib/finance-cost-proofs/scan-consumer";
import { consumeFranchiseNetworkInvitation } from "@/modules/franchise/data/network/invitation-consumer";
import { consumeVerifiedPaymentInbox } from "@/modules/shared/lib/payment-dispatch/consumer";
import { consumeClientCommercialDocumentIssued } from "@/modules/client/data/billing/issued-consumer";
import { consumeSocialNativeVerification } from "@/modules/shared/lib/marketing-autopilot/native-verification-consumer";
import { consumeProviderBillingIssued } from "@/modules/provider/data/billing/issued-consumer";
import { consumeRefundReconciliation } from "@/modules/shared/lib/payment-refunds/reconciliation-consumer";
import { consumeSubscriptionRefund } from "@/modules/shared/lib/payment-refunds/consumer";
import { timingSafeEqual } from "node:crypto";
import { createJsonLogger } from "@matricia/observability";
import { z } from "zod";
import { deliverNotification } from "@/modules/shared/lib/notification-delivery/adapter";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const headers = { "cache-control": "no-store" } as const;
const MAX_BODY_BYTES = 128 * 1024;
const CONSUMER_CODE = "TERMINAL_OBSERVABILITY";
const persistedDsrInventoryFacts = new Set(["DsrAllInventoryDraftedV1","DsrAllSourceClassifiedV1","DsrAllInventorySubmittedV1","DsrAllInventoryReviewedV1","DsrAllCapturedV1","DsrAllExclusionProposedV1","DsrAllExclusionReviewedV1","DsrAllResponsePreparedV1"]);
const persistedDsrErasureFacts = new Set(["DsrErasureScopeConfirmedV1","DsrErasureDraftedV1","DsrErasureSourceConfiguredV1","DsrErasurePlanSubmittedV1","DsrErasurePlanReviewedV1","DsrErasureSourceExecutedV1","DsrErasureReportPreparedV1","DsrErasureReportReviewedV1","DsrErasureReportAcknowledgedV1","DsrErasurePlanRevokedV1"]);
// These facts report effects already committed by their domain transactions.
// Observation never repeats a grant or treats a human receipt as an antivirus verdict.
const persistedBenefitFacts = new Set(["BenefitScheduledV1", "BenefitStartedV1", "BenefitDeliveryProposedV1", "BenefitDeliveryAcceptedV1", "BenefitDeliveryRejectedV1"]);
const persistedManualCreditFacts = new Set(["ManualCreditGrantRequestedV1", "ManualCreditGrantReviewedV1", "ManualCreditGrantExecutedV1"]);
const INVITATION_CONSUMER = "ORGANIZATION_EMAIL_INVITATION";
const log = createJsonLogger((record) => process.stdout.write(`${record}\n`));

const envelopeSchema = z.object({
  id: z.string().regex(/^[0-9]+$/),
  eventType: z.string().min(3).max(160),
  aggregateId: z.string().min(1).max(240),
  occurredAt: z.string().datetime({ offset: true }),
  correlationId: z.string().uuid(),
  payload: z.record(z.string(), z.unknown()),
}).strict();

const invitationPayload = z.object({
  invitation_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  invited_email: z.string().email().optional(),
  organization_name: z.string().min(1).max(200).optional(),
  locale: z.enum(["fr-MA", "ar-MA"]).optional(),
  expires_at: z.string().optional(),
  role_codes: z.array(z.string()).optional(),
}).passthrough();

const loadedInvitation = z.object({
  invitation_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  organization_name: z.string().min(1).max(200),
  invited_email: z.string().email(),
  expires_at: z.string(),
  role_codes: z.array(z.string()),
}).strict();

function authorized(request: Request): boolean {
  const expected = process.env.INTERNAL_WEBHOOK_SECRET?.trim() ?? "";
  const supplied = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length >= 32
    && expectedBytes.length === suppliedBytes.length
    && timingSafeEqual(expectedBytes, suppliedBytes);
}

function invitationCopy(locale: "fr-MA" | "ar-MA", organizationName: string) {
  if (locale === "ar-MA") {
    return {
      subject: `دعوة للانضمام إلى ${organizationName} على ماتريسيا`,
      body: `تمت دعوتك للانضمام إلى مؤسسة ${organizationName} على منصة ماتريسيا.\n\nأنشئ حساباً أو سجّل الدخول ثم افتح صفحة الدعوات لقبول الدعوة.`,
      ctaPath: "/ar/invitations",
    };
  }
  return {
    subject: `Invitation à rejoindre ${organizationName} sur Matricia`,
    body: `Vous êtes invité(e) à rejoindre l’organisation ${organizationName} sur Matricia.\n\nCréez un compte ou connectez-vous, puis ouvrez la page Invitations pour accepter.`,
    ctaPath: "/fr/invitations",
  };
}

async function deliverOrganizationInvitation(envelope: z.infer<typeof envelopeSchema>) {
  const parsedPayload = invitationPayload.safeParse(envelope.payload);
  if (!parsedPayload.success) return { ok: false as const, code: "INVITATION_PAYLOAD_INVALID" };

  const admin = getSupabaseAdminClient();
  const loaded = await admin.rpc("load_organization_invitation_email_v1", {
    p_invitation_id: parsedPayload.data.invitation_id,
  });
  if (loaded.error) return { ok: false as const, code: "INVITATION_LOAD_FAILED" };
  const invitation = loadedInvitation.safeParse(loaded.data);
  if (!invitation.success) return { ok: false as const, code: "INVITATION_LOAD_INVALID" };

  const locale = parsedPayload.data.locale === "ar-MA" ? "ar-MA" : "fr-MA";
  const copy = invitationCopy(locale, invitation.data.organization_name);
  const result = await deliverNotification({
    deliveryId: envelope.id,
    channel: "EMAIL",
    recipientEmail: invitation.data.invited_email,
    locale,
    subject: copy.subject,
    body: copy.body,
    ctaPath: copy.ctaPath,
    providerIdempotencyKey: `organization-invitation:${invitation.data.invitation_id}`,
  }, { env: process.env, fetch });

  if (result.outcome !== "DELIVERED" && result.outcome !== "SENT") {
    return { ok: false as const, code: "errorCode" in result ? result.errorCode : "DELIVERY_RESULT_INVALID" };
  }
  return { ok: true as const, invitationId: invitation.data.invitation_id };
}

export async function POST(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ code: "UNAUTHORIZED" }, { status: 401, headers });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return Response.json({ code: "PAYLOAD_TOO_LARGE" }, { status: 413, headers });
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return Response.json({ code: "PAYLOAD_TOO_LARGE" }, { status: 413, headers });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ code: "INVALID_REQUEST" }, { status: 400, headers });
  }

  const parsed = envelopeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ code: "INVALID_REQUEST" }, { status: 400, headers });
  }

  if (parsed.data.eventType === "FinanceCostDocumentUploadedV1") {
    const id = z.string().uuid().safeParse(parsed.data.payload.upload_id);
    if (!id.success || id.data !== parsed.data.aggregateId) return Response.json({ code: "FINANCE_COST_DOCUMENT_EVENT_INVALID" }, { status: 400, headers });
    const result = await scanOneFinanceCostDocument(getSupabaseAdminClient(), id.data);
    const completed = result.ok && result.code === "FINANCE_COST_DOCUMENT_SCAN_RECORDED";
    return Response.json({ outcome: result.code }, { status: completed ? 202 : 503, headers: { ...headers, ...(completed ? { "x-matricia-outbox-consumer": "FINANCE_COST_SCAN" } : {}) } });
  }
  if (parsed.data.eventType === "FranchiseNetworkInvitationRequestedV1") {
    const id = z.string().uuid().safeParse(parsed.data.payload.invitation_id);
    if (!id.success || id.data !== parsed.data.aggregateId) return Response.json({ code: "FRANCHISE_NETWORK_EVENT_INVALID" }, { status: 400, headers });
    const result = await consumeFranchiseNetworkInvitation(parsed.data.id, id.data);
    return Response.json({ outcome: result.code }, { status: result.ok ? 202 : 503, headers: { ...headers, ...(result.ok ? { "x-matricia-outbox-consumer": "FRANCHISE_NETWORK_INVITATION" } : {}) } });
  }
  if (parsed.data.eventType === "ClientCommercialDocumentIssuedV1") {
    const id = z.string().uuid().safeParse(parsed.data.payload.document_id ?? parsed.data.aggregateId);
    if (!id.success) return Response.json({ code: "CLIENT_DOCUMENT_PAYLOAD_INVALID" }, { status: 400, headers });
    const result = await consumeClientCommercialDocumentIssued(id.data);
    return Response.json({ outcome: result.code, eventId: parsed.data.id }, { status: result.ok ? 202 : 503, headers: { ...headers, "x-matricia-outbox-consumer": "CLIENT_BILLING_DOCUMENTS" } });
  }
  if (parsed.data.eventType === "SocialNativeVerificationRequestedV1") {
    const id = z.string().uuid().safeParse(parsed.data.payload.verification_request_id);
    if (!id.success) return Response.json({ code: "SOCIAL_VERIFICATION_PAYLOAD_INVALID" }, { status: 400, headers });
    const result = await consumeSocialNativeVerification(id.data);
    return Response.json({ outcome: result.code, eventId: parsed.data.id }, { status: result.ok ? 202 : 503, headers: { ...headers, "x-matricia-outbox-consumer": "SOCIAL_NATIVE_VERIFICATION" } });
  }
  if (parsed.data.eventType === "SubscriptionPaidV1") {
    const id=z.string().uuid().safeParse(parsed.data.aggregateId);
    if(!id.success)return Response.json({code:"SC_PAID_EVENT_INVALID"},{status:422,headers});
    const result=await getSupabaseAdminClient({timeoutMs:5000}).rpc("track_subscription_paid_credit_jobs_v1",{p_outbox_id:parsed.data.id,p_subscription_id:id.data});
    if(result.error||result.data?.outcome!=="SUBSCRIPTION_CREDIT_JOBS_TRACKED")return Response.json({code:"SC_PAID_EVENT_UNVERIFIED"},{status:503,headers});
    return Response.json({outcome:"SUBSCRIPTION_CREDIT_JOBS_TRACKED"},{status:202,headers:{...headers,"x-matricia-outbox-consumer":"SUBSCRIPTION_CREDIT_FULFILLMENT"}});
  }
  if (parsed.data.eventType === "VerifiedPaymentDispatchRequestedV1") {
    const id=z.string().uuid().safeParse(parsed.data.payload.receipt_id);
    if(!id.success||id.data!==parsed.data.aggregateId)return Response.json({code:"PAYMENT_RECEIPT_METADATA_INVALID"},{status:422,headers});
    const result=await consumeVerifiedPaymentInbox(id.data);
    return Response.json({outcome:result.code},{status:result.ok?202:503,headers:{...headers,...(result.ok?{"x-matricia-outbox-consumer":"VERIFIED_PAYMENT_DISPATCH"}:{})}});
  }
  if (parsed.data.eventType === "PrivacyRetentionActionRequestedV1") {
    const id = z.string().uuid().safeParse(parsed.data.payload.action_id);
    if (!id.success) return Response.json({ code: "PRIVACY_WORK_ITEM_PAYLOAD_INVALID" }, { status: 400, headers });
    const result = await getSupabaseAdminClient().rpc("attest_privacy_retention_work_item_v1", { p_action_request_id: id.data, p_correlation_id: parsed.data.correlationId });
    if (result.error || (result.data as { outcome?: unknown } | null)?.outcome !== "PRIVACY_WORK_ITEM_TRACKED") return Response.json({ code: "PRIVACY_WORK_ITEM_UNVERIFIED" }, { status: 503, headers });
    return Response.json({ outcome: "PRIVACY_WORK_ITEM_TRACKED", eventId: parsed.data.id }, { status: 202, headers: { ...headers, "x-matricia-outbox-consumer": "PRIVACY_WORK_ITEM_TRACKED" } });
  }
  if (parsed.data.eventType === "ServiceRequestStageChangedV1") {
    const id=z.string().uuid().safeParse(parsed.data.aggregateId);
    if(!id.success)return Response.json({code:"SERVICE_REQUEST_STAGE_PAYLOAD_INVALID"},{status:400,headers});
    const result=await getSupabaseAdminClient().rpc("verify_service_request_stage_event_v1",{p_event_id:parsed.data.id,p_request_id:id.data});
    if(result.error||result.data!==true)return Response.json({code:"SERVICE_REQUEST_STAGE_UNVERIFIED"},{status:503,headers});
    return Response.json({outcome:"SERVICE_REQUEST_STAGE_VERIFIED"},{status:202,headers:{...headers,"x-matricia-outbox-consumer":"SERVICE_REQUEST_PROGRESSION"}});
  }
  if (["OrganizationJoinRequestedV1","OrganizationJoinDecidedV1","OrganizationMergedV1","OrganizationMergeRejectedV1","OrganizationMergeExceptionRaisedV1"].includes(parsed.data.eventType)) {
    const resource=z.string().uuid().safeParse(parsed.data.aggregateId);
    if(!resource.success)return Response.json({code:"ORGANIZATION_WORKFLOW_PAYLOAD_INVALID"},{status:400,headers});
    const result=await getSupabaseAdminClient().rpc("verify_organization_workflow_event_v1",{p_outbox_id:parsed.data.id,p_event_type:parsed.data.eventType,p_resource_id:resource.data});
    if(result.error||result.data!==true)return Response.json({code:"ORGANIZATION_WORKFLOW_UNVERIFIED"},{status:503,headers});
    return Response.json({outcome:"ORGANIZATION_WORKFLOW_VERIFIED"},{status:202,headers:{...headers,"x-matricia-outbox-consumer":"ORGANIZATION_WORKFLOWS"}});
  }
  if (parsed.data.eventType === "MarketingBusinessFactReadyV2" || parsed.data.eventType === "ContractSignedV1") {
    const contract=parsed.data.eventType === "ContractSignedV1";
    const id=z.string().uuid().safeParse(parsed.data.payload[contract?"envelope_id":"fact_id"]);
    if(!id.success)return Response.json({code:"MARKETING_BUSINESS_SOURCE_PAYLOAD_INVALID"},{status:400,headers});
    const result=await getSupabaseAdminClient().rpc(contract?"process_marketing_contract_conversion_v2":"process_marketing_business_fact_v2",contract?{p_envelope_id:id.data}:{p_fact_id:id.data});
    const outcome=(result.data as{outcome?:unknown}|null)?.outcome;
    if(result.error||!["MARKETING_BUSINESS_ATTRIBUTED","MARKETING_BUSINESS_DEDUPLICATED","MARKETING_BUSINESS_SKIPPED_NO_TOUCH","MARKETING_BUSINESS_SKIPPED_CONSENT","MARKETING_BUSINESS_SKIPPED_NO_OPPORTUNITY","MARKETING_BUSINESS_SKIPPED_SIMULATION","MARKETING_BUSINESS_SKIPPED_RESTRICTION"].includes(String(outcome)))return Response.json({code:"MARKETING_BUSINESS_SOURCE_UNVERIFIED"},{status:503,headers});
    return Response.json({outcome},{status:202,headers:{...headers,"x-matricia-outbox-consumer":"MARKETING_VERIFIED_CONVERSION"}});
  }
  if (parsed.data.eventType === "SignatureSimulationStepRequestedV1") {
    const id = z.string().uuid().safeParse(parsed.data.payload.command_id);
    if (!id.success) return Response.json({ code: "SIGNATURE_SIMULATION_PAYLOAD_INVALID" }, { status: 400, headers });
    const result = await getSupabaseAdminClient().rpc("execute_signature_mock_step_v1", { p_command_id: id.data });
    const outcome=(result.data as {outcome?:unknown}|null)?.outcome;
    if(result.error||!["SIGNATURE_ENVELOPE_SENT","SIGNATURE_ENVELOPE_PARTIALLY_SIGNED","SIGNATURE_ENVELOPE_SIGNED","SIGNATURE_SIMULATION_CANCELLED"].includes(String(outcome)))return Response.json({code:"SIGNATURE_SIMULATION_UNAVAILABLE"},{status:503,headers});
    return Response.json({outcome,development_mock:true},{status:202,headers:{...headers,"x-matricia-outbox-consumer":"SIGNATURE_SIMULATION"}});
  }
  if (["SignatureEnvelopeReadyV1", "ContractSignatureRequestedV1", "ContractAmendmentSignatureRequestedV1"].includes(parsed.data.eventType)) {
    const id=z.string().uuid().safeParse(parsed.data.payload.envelope_id);
    if(!id.success)return Response.json({code:"SIGNATURE_ENVELOPE_PAYLOAD_INVALID"},{status:400,headers});
    const result=await getSupabaseAdminClient().rpc("dispatch_governed_signature_envelope_v1",{p_envelope_id:id.data});
    const outcome=(result.data as {outcome?:unknown}|null)?.outcome;
    if(result.error||!["SIGNATURE_ENVELOPE_SENT","SIGNATURE_DISPATCH_CANCELLED"].includes(String(outcome)))return Response.json({code:"SIGNATURE_PROVIDER_DISPATCH_UNAVAILABLE"},{status:503,headers});
    return Response.json({outcome,development_mock:true},{status:202,headers:{...headers,"x-matricia-outbox-consumer":"SIGNATURE_PROVIDER"}});
  }
  if (parsed.data.eventType === "ProviderInvoiceIssuedV1" || parsed.data.eventType === "ProviderStatementIssuedV1" || parsed.data.eventType === "ProviderCreditNoteIssuedV1") {
    const kind = parsed.data.eventType === "ProviderInvoiceIssuedV1" ? "invoice" : parsed.data.eventType === "ProviderCreditNoteIssuedV1" ? "credit_note" : "statement";
    const id = z.string().uuid().safeParse(parsed.data.payload[kind === "invoice" ? "invoice_id" : kind === "credit_note" ? "credit_note_id" : "statement_id"] ?? parsed.data.aggregateId);
    if (!id.success) return Response.json({ code: "BILLING_SOURCE_INVALID" }, { status: 400, headers });
    const result = await consumeProviderBillingIssued(kind, id.data);
    return Response.json({ outcome: result.code, eventId: parsed.data.id }, { status: result.ok ? 202 : 503, headers: { ...headers, "x-matricia-outbox-consumer": "PROVIDER_BILLING_DOCUMENTS" } });
  }
  if (parsed.data.eventType === "ProviderBillingDocumentsReadyV1") {
    const id = z.string().uuid().safeParse(parsed.data.payload.artifact_id);
    if (!id.success) return Response.json({ code: "BILLING_PDF_PAYLOAD_INVALID" }, { status: 400, headers });
    const result = await getSupabaseAdminClient().rpc("enqueue_provider_billing_pdf_notification", { p_artifact_id: id.data, p_correlation_id: parsed.data.correlationId });
    const outcome = (result.data as { outcome?: unknown } | null)?.outcome;
    if (result.error || !["NOTIFICATION_ENQUEUED", "NOTIFICATION_DEDUPLICATED", "BILLING_ORIGINAL_RETAINED_BY_CORRECTION"].includes(String(outcome))) return Response.json({ code: "BILLING_PDF_NOTIFICATION_UNAVAILABLE" }, { status: 503, headers });
    return Response.json({ outcome: outcome === "BILLING_ORIGINAL_RETAINED_BY_CORRECTION" ? outcome : "BILLING_PDF_NOTIFICATION_ENQUEUED" }, { status: 202, headers: { ...headers, "x-matricia-outbox-consumer": "PROVIDER_BILLING_NOTIFICATION" } });
  }
  if (parsed.data.eventType === "SubscriptionRefundReconciliationAuthorizedV1") {
    const id = z.string().uuid().safeParse(parsed.data.payload.reconciliation_request_id);
    if (!id.success) return Response.json({ code: "REFUND_RECONCILIATION_PAYLOAD_INVALID" }, { status: 400, headers });
    const result = await consumeRefundReconciliation(id.data);
    return Response.json({ outcome: result.code }, { status: result.ok ? 202 : 503, headers: { ...headers, "x-matricia-outbox-consumer": "SUBSCRIPTION_REFUND_RECONCILIATION" } });
  }
  if (parsed.data.eventType === "SubscriptionRefundAuthorizedV1") {
    const id = z.string().uuid().safeParse(parsed.data.payload.refund_request_id);
    if (!id.success) return Response.json({ code: "REFUND_PAYLOAD_INVALID" }, { status: 400, headers });
    const result = await consumeSubscriptionRefund(id.data);
    return Response.json({ outcome: result.code }, { status: result.ok ? 202 : 503, headers: { ...headers, "x-matricia-outbox-consumer": "SUBSCRIPTION_REFUND" } });
  }
  if (parsed.data.eventType === "OrganizationEmailInvitationRequestedV1") {
    const delivery = await deliverOrganizationInvitation(parsed.data);
    if (!delivery.ok) {
      return Response.json({ code: delivery.code }, { status: 503, headers });
    }
    log("info", {
      requestId: request.headers.get("x-request-id") ?? parsed.data.correlationId,
      correlationId: parsed.data.correlationId,
      event: "outbox.invitation.email.accepted",
      outcome: "success",
      aggregateType: parsed.data.eventType,
      aggregateId: parsed.data.aggregateId,
      data: { eventId: parsed.data.id, consumer: INVITATION_CONSUMER, invitationId: delivery.invitationId },
    });
    return Response.json(
      { outcome: "ORGANIZATION_INVITATION_EMAIL_ACCEPTED", eventId: parsed.data.id, consumer: INVITATION_CONSUMER },
      { status: 202, headers: { ...headers, "x-matricia-outbox-consumer": INVITATION_CONSUMER } },
    );
  }

  if (parsed.data.eventType === "AdminActionAuthorizedV1") {
    const id = z.string().uuid().safeParse(parsed.data.payload.action_request_id);
    if (!id.success) return Response.json({ code: "ADMIN_ACTION_PAYLOAD_INVALID" }, { status: 422, headers });
    const result = await getSupabaseAdminClient().rpc("execute_admin_operational_action_v1", { p_action_request_id: id.data, p_correlation_id: parsed.data.correlationId });
    const outcome = z.enum(["ADMIN_ACTION_EXECUTED", "ADMIN_ACTION_REQUEST_TRACKED"]).safeParse((result.data as { outcome?: unknown } | null)?.outcome);
    if (result.error || !outcome.success) return Response.json({ code: "ADMIN_ACTION_EXECUTION_FAILED" }, { status: 503, headers });
    return Response.json({ outcome: outcome.data, eventId: parsed.data.id }, { status: 202, headers: { ...headers, "x-matricia-outbox-consumer": "ADMIN_OPERATIONAL_ACTION" } });
  }
  // These events require a registered domain consumer; observing them is not execution.
  if (["PrivacyDispositionRequestedV1", "PrivacyExportRequestedV1", "PrivacyErasureRequestedV1"].includes(parsed.data.eventType)) {
    return Response.json({ code: "DOMAIN_CONSUMER_REQUIRED" }, { status: 503, headers });
  }

  // The authoritative account commands have already persisted their effects and audit.
  // Correlate this observation to the typed request, never to a target identity or free text.
  if (["PlatformAccountChangeRequestedV1", "PlatformAccountAccessChangedV1", "PlatformAccountChangeRejectedV1"].includes(parsed.data.eventType)) {
    const accountRequest = z.string().uuid().safeParse(parsed.data.payload.request_id);
    if (!accountRequest.success || accountRequest.data !== parsed.data.aggregateId || accountRequest.data !== parsed.data.correlationId) return Response.json({ code: "ACCOUNT_FACT_METADATA_INVALID" }, { status: 422, headers });
    log("info", {
      requestId: accountRequest.data,
      correlationId: accountRequest.data,
      event: "outbox.event.observed",
      outcome: "success",
      aggregateType: parsed.data.eventType,
      aggregateId: accountRequest.data,
      data: { eventId: parsed.data.id, consumer: CONSUMER_CODE },
    });
    return Response.json({ outcome: "OUTBOX_EVENT_OBSERVED", eventId: parsed.data.id, consumer: CONSUMER_CODE }, { status: 202, headers: { ...headers, "x-matricia-outbox-consumer": CONSUMER_CODE } });
  }

  const benefitFact = persistedBenefitFacts.has(parsed.data.eventType);
  const manualCreditFact = persistedManualCreditFacts.has(parsed.data.eventType);
  if (benefitFact || manualCreditFact) {
    const resource = z.string().uuid().safeParse(parsed.data.payload[benefitFact ? "redemption_id" : "request_id"]);
    if (!resource.success || resource.data !== parsed.data.aggregateId) return Response.json({ code: "PERSISTED_FINANCIAL_FACT_METADATA_INVALID" }, { status: 422, headers });
    log("info", {
      requestId: parsed.data.correlationId,
      correlationId: parsed.data.correlationId,
      event: "outbox.event.observed",
      outcome: "success",
      aggregateType: parsed.data.eventType,
      aggregateId: resource.data,
      data: { eventId: parsed.data.id, consumer: CONSUMER_CODE, factClass: benefitFact ? "PERSISTED_BENEFIT_FULFILLMENT" : "PERSISTED_MANUAL_CREDIT_GOVERNANCE" },
    });
    return Response.json({ outcome: "OUTBOX_EVENT_OBSERVED", eventId: parsed.data.id, consumer: CONSUMER_CODE }, { status: 202, headers: { ...headers, "x-matricia-outbox-consumer": CONSUMER_CODE } });
  }

  // Terminal observer for events without a dedicated consumer.
  // Payloads can contain tenant data and must never be copied to application logs.
  log("info", {
    requestId: request.headers.get("x-request-id") ?? parsed.data.correlationId,
    correlationId: parsed.data.correlationId,
    event: "outbox.event.observed",
    outcome: "success",
    aggregateType: parsed.data.eventType,
    aggregateId: parsed.data.aggregateId,
    data: { eventId: parsed.data.id, consumer: CONSUMER_CODE, ...(persistedDsrInventoryFacts.has(parsed.data.eventType) ? { factClass: "PERSISTED_DSR_INVENTORY" } : persistedDsrErasureFacts.has(parsed.data.eventType) ? {factClass:"PERSISTED_DSR_ERASURE_WORKFLOW"} : {}) },
  });

  return Response.json(
    { outcome: "OUTBOX_EVENT_OBSERVED", eventId: parsed.data.id, consumer: CONSUMER_CODE },
    { status: 202, headers: { ...headers, "x-matricia-outbox-consumer": CONSUMER_CODE } },
  );
}

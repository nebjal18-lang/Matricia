import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  deliver: vi.fn(),
  issued: vi.fn(),
  social: vi.fn(),
  clientIssued: vi.fn(),
  paymentDispatch:vi.fn(),
}));

vi.mock("@/modules/shared/lib/payment-dispatch/consumer",()=>({consumeVerifiedPaymentInbox:mocks.paymentDispatch}));
vi.mock("@/modules/client/data/billing/issued-consumer", () => ({ consumeClientCommercialDocumentIssued: mocks.clientIssued }));
vi.mock("@/modules/shared/lib/marketing-autopilot/native-verification-consumer", () => ({ consumeSocialNativeVerification: mocks.social }));
vi.mock("@/modules/provider/data/billing/issued-consumer", () => ({ consumeProviderBillingIssued: mocks.issued }));
vi.mock("@/modules/shared/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/modules/shared/lib/notification-delivery/adapter", () => ({
  deliverNotification: mocks.deliver,
}));

import { POST } from "./route";

const secret = "s".repeat(32);
const envelope = {
  id: "42",
  eventType: "OrganizationCreatedV1",
  aggregateId: "58a947b1-a23f-4ad1-90e8-af68f65e12ee",
  occurredAt: "2026-09-14T20:00:00.000Z",
  correlationId: "179c0f83-b91e-46b2-a18d-5a9436c66cd4",
  payload: { organization_id: "58a947b1-a23f-4ad1-90e8-af68f65e12ee" },
};

const invitationEnvelope = {
  id: "77",
  eventType: "OrganizationEmailInvitationRequestedV1",
  aggregateId: "invitation:a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  occurredAt: "2026-09-14T20:00:00.000Z",
  correlationId: "179c0f83-b91e-46b2-a18d-5a9436c66cd4",
  payload: {
    invitation_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    organization_id: "58a947b1-a23f-4ad1-90e8-af68f65e12ee",
    locale: "fr-MA",
  },
};

function request(body: unknown = envelope, token = secret): Request {
  return new Request("https://matricia.vercel.app/api/internal/outbox", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("internal outbox receiver", () => {
  let write: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    process.env.INTERNAL_WEBHOOK_SECRET = secret;
    write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    mocks.rpc.mockReset();
    mocks.deliver.mockReset();
  });
  afterEach(() => write.mockRestore());

  it("rejects unauthorized dispatches", async () => {
    expect((await POST(request(envelope, "bad"))).status).toBe(401);
  });

  it("rejects malformed envelopes", async () => {
    expect((await POST(request({ ...envelope, correlationId: "invalid" }))).status).toBe(400);
  });

  it("observes a valid envelope through the explicit terminal consumer", async () => {
    const response = await POST(request());
    expect(response.status).toBe(202);
    expect(response.headers.get("x-matricia-outbox-consumer")).toBe("TERMINAL_OBSERVABILITY");
    await expect(response.json()).resolves.toEqual({ outcome: "OUTBOX_EVENT_OBSERVED", eventId: "42", consumer: "TERMINAL_OBSERVABILITY" });
    expect(write).toHaveBeenCalledOnce();
    const record = JSON.parse(String(write.mock.calls[0]?.[0]));
    expect(record).toMatchObject({ event: "outbox.event.observed", outcome: "success", aggregate_type: envelope.eventType, data: { eventId: "42", consumer: "TERMINAL_OBSERVABILITY" } });
    expect(JSON.stringify(record)).not.toContain("organization_id");
  });

  it("delivers organization invitation emails through the dedicated consumer", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        invitation_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        organization_id: "58a947b1-a23f-4ad1-90e8-af68f65e12ee",
        organization_name: "NeoXa Demo",
        invited_email: "invitee@example.com",
        expires_at: "2026-09-21T20:00:00+00:00",
        role_codes: ["ORG_ADMIN"],
      },
      error: null,
    });
    mocks.deliver.mockResolvedValue({ outcome: "DELIVERED" });

    const response = await POST(request(invitationEnvelope));
    expect(response.status).toBe(202);
    expect(response.headers.get("x-matricia-outbox-consumer")).toBe("ORGANIZATION_EMAIL_INVITATION");
    await expect(response.json()).resolves.toEqual({
      outcome: "ORGANIZATION_INVITATION_EMAIL_ACCEPTED",
      eventId: "77",
      consumer: "ORGANIZATION_EMAIL_INVITATION",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("load_organization_invitation_email_v1", {
      p_invitation_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    });
    expect(mocks.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "EMAIL",
        recipientEmail: "invitee@example.com",
        providerIdempotencyKey: "organization-invitation:a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      }),
      expect.any(Object),
    );
  });

  it("returns 503 when invitation email delivery fails", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        invitation_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        organization_id: "58a947b1-a23f-4ad1-90e8-af68f65e12ee",
        organization_name: "NeoXa Demo",
        invited_email: "invitee@example.com",
        expires_at: "2026-09-21T20:00:00+00:00",
        role_codes: ["ORG_ADMIN"],
      },
      error: null,
    });
    mocks.deliver.mockResolvedValue({ outcome: "FAILED", errorCode: "PROVIDER_REJECTED" });

    const response = await POST(request(invitationEnvelope));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ code: "PROVIDER_REJECTED" });
  });
});

describe("authoritative work-item and execution acknowledgements", () => {
  beforeEach(() => { process.env.INTERNAL_WEBHOOK_SECRET = secret; mocks.rpc.mockReset(); });
  it("refuses to acknowledge a retention request without its durable work item", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "55000" } });
    expect((await POST(request({ ...envelope, eventType: "PrivacyRetentionActionRequestedV1", payload: { action_id: envelope.aggregateId } }))).status).toBe(503);
  });
  it("acknowledges only tracked work, without claiming any purge", async () => {
    mocks.rpc.mockResolvedValue({ data: { outcome: "PRIVACY_WORK_ITEM_TRACKED" }, error: null });
    const response = await POST(request({ ...envelope, eventType: "PrivacyRetentionActionRequestedV1", payload: { action_id: envelope.aggregateId } }));
    expect(response.status).toBe(202); expect(response.headers.get("x-matricia-outbox-consumer")).toBe("PRIVACY_WORK_ITEM_TRACKED");
    expect(await response.json()).toEqual({ outcome: "PRIVACY_WORK_ITEM_TRACKED", eventId: envelope.id });
    expect(mocks.rpc).toHaveBeenCalledWith("attest_privacy_retention_work_item_v1", { p_action_request_id: envelope.aggregateId, p_correlation_id: envelope.correlationId });
  });
  it("does not turn an admin failure into execution success", async () => {
    mocks.rpc.mockResolvedValue({ data: { outcome: "ADMIN_ACTION_FAILED" }, error: null });
    expect((await POST(request({ ...envelope, eventType: "AdminActionAuthorizedV1", payload: { action_request_id: envelope.aggregateId } }))).status).toBe(503);
  });
  it("does not acknowledge a privacy export on mere observation", async () => {
    expect((await POST(request({ ...envelope, eventType: "PrivacyExportRequestedV1" }))).status).toBe(503); expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("billing documents at issuance", () => {
  beforeEach(() => { process.env.INTERNAL_WEBHOOK_SECRET = secret; mocks.rpc.mockReset(); mocks.issued.mockReset(); });
  it("archives the invoice from issuance, without waiting for a document GET", async () => {
    mocks.issued.mockResolvedValue({ ok: true, code: "PROVIDER_BILLING_DOCUMENTS_READY" });
    const response = await POST(request({ ...envelope, eventType: "ProviderInvoiceIssuedV1", payload: { invoice_id: envelope.aggregateId } }));
    expect(response.status).toBe(202); expect(response.headers.get("x-matricia-outbox-consumer")).toBe("PROVIDER_BILLING_DOCUMENTS"); expect(mocks.issued).toHaveBeenCalledWith("invoice", envelope.aggregateId);
  });
  it("does not acknowledge issuance when immutable bilingual archives fail", async () => {
    mocks.issued.mockResolvedValue({ ok: false, code: "BILLING_ISSUER_NOT_CONFIGURED" });
    expect((await POST(request({ ...envelope, eventType: "ProviderStatementIssuedV1", payload: { statement_id: envelope.aggregateId } }))).status).toBe(503);
  });
  it("enqueues notification only after both issued translations are ready", async () => {
    mocks.rpc.mockResolvedValue({ data: { outcome: "NOTIFICATION_ENQUEUED" }, error: null });
    const response = await POST(request({ ...envelope, eventType: "ProviderBillingDocumentsReadyV1", payload: { artifact_id: envelope.aggregateId } }));
    expect(response.status).toBe(202); expect(mocks.rpc).toHaveBeenCalledWith("enqueue_provider_billing_pdf_notification", { p_artifact_id: envelope.aggregateId, p_correlation_id: envelope.correlationId });
  });
  it("observes a later archive download without causing a new email", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    try { const response = await POST(request({ ...envelope, eventType: "ProviderBillingPdfArchivedV1", payload: { artifact_id: envelope.aggregateId } })); expect(response.headers.get("x-matricia-outbox-consumer")).toBe("TERMINAL_OBSERVABILITY"); expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.issued).not.toHaveBeenCalled(); } finally { write.mockRestore(); }
  });
});

it("preserves an authoritative admin request-tracked outcome without calling it executed", async () => {
 process.env.INTERNAL_WEBHOOK_SECRET = secret; mocks.rpc.mockResolvedValue({ data: { outcome: "ADMIN_ACTION_REQUEST_TRACKED" }, error: null });
 const response = await POST(request({ ...envelope, eventType: "AdminActionAuthorizedV1", payload: { action_request_id: envelope.aggregateId } }));
 expect(response.status).toBe(202); expect(await response.json()).toEqual({ outcome: "ADMIN_ACTION_REQUEST_TRACKED", eventId: envelope.id });
});

it("does not acknowledge social native verification without its authoritative proof", async () => {
 process.env.INTERNAL_WEBHOOK_SECRET = secret; mocks.social.mockResolvedValue({ ok: false, code: "SOCIAL_NATIVE_PROOF_UNVERIFIED" });
 expect((await POST(request({ ...envelope, eventType: "SocialNativeVerificationRequestedV1", payload: { verification_request_id: envelope.aggregateId } }))).status).toBe(503);
 mocks.social.mockResolvedValue({ ok: true, code: "SOCIAL_NATIVE_VERIFIED" });
 const response = await POST(request({ ...envelope, eventType: "SocialNativeVerificationRequestedV1", payload: { verification_request_id: envelope.aggregateId } }));
 expect(response.status).toBe(202); expect(response.headers.get("x-matricia-outbox-consumer")).toBe("SOCIAL_NATIVE_VERIFICATION");
});

it("acknowledges client issued documents only after both private archives are ready", async () => {
 process.env.INTERNAL_WEBHOOK_SECRET = secret; mocks.clientIssued.mockResolvedValue({ ok: false, code: "CLIENT_BILLING_READINESS_PENDING" });
 expect((await POST(request({ ...envelope, eventType: "ClientCommercialDocumentIssuedV1", payload: { document_id: envelope.aggregateId } }))).status).toBe(503);
 mocks.clientIssued.mockResolvedValue({ ok: true, code: "CLIENT_COMMERCIAL_DOCUMENT_READY" });
 const response = await POST(request({ ...envelope, eventType: "ClientCommercialDocumentIssuedV1", payload: {} }));
 expect(response.status).toBe(202); expect(response.headers.get("x-matricia-outbox-consumer")).toBe("CLIENT_BILLING_DOCUMENTS"); expect(mocks.clientIssued).toHaveBeenCalledWith(envelope.aggregateId);
});

it("requires both immutable credit-note archives before acknowledging ProviderCreditNoteIssuedV1",async()=>{
 process.env.INTERNAL_WEBHOOK_SECRET=secret;mocks.issued.mockResolvedValueOnce({ok:false,code:"BILLING_POLICY_REQUIRED"}).mockResolvedValueOnce({ok:true,code:"PROVIDER_BILLING_DOCUMENTS_READY"});
 const event={...envelope,eventType:"ProviderCreditNoteIssuedV1",payload:{credit_note_id:envelope.aggregateId}};
 expect((await POST(request(event))).status).toBe(503);const response=await POST(request(event));expect(response.status).toBe(202);expect(response.headers.get("x-matricia-outbox-consumer")).toBe("PROVIDER_BILLING_DOCUMENTS");expect(mocks.issued).toHaveBeenLastCalledWith("credit_note",envelope.aggregateId);
});
it.each(["ProviderPayableEvidenceArchivedV1","ProviderBillingIntentSavedV1","ProviderBillingIntentCancelledV1","ProviderBillingIntentFinalizedV1","ProviderInterventionModesDeclaredV1","ProviderCurrentIdentityVerifiedV1","NotificationTemplatePairActivatedV1"])("observes completed provider fact%s without issuing documents or email",async eventType=>{
 process.env.INTERNAL_WEBHOOK_SECRET=secret;vi.clearAllMocks();const write=vi.spyOn(process.stdout,"write").mockImplementation(()=>true);try{const response=await POST(request({...envelope,eventType,payload:{private_data:"never-log-this"}}));expect(response.status).toBe(202);expect(response.headers.get("x-matricia-outbox-consumer")).toBe("TERMINAL_OBSERVABILITY");expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.issued).not.toHaveBeenCalled();expect(JSON.stringify(write.mock.calls)).not.toContain("never-log-this");}finally{write.mockRestore();}
});

it.each(["ContractSignatureRequestedV1","ContractAmendmentSignatureRequestedV1"])("does not acknowledge %s through mere observation",async eventType=>{
 process.env.INTERNAL_WEBHOOK_SECRET=secret;mocks.rpc.mockResolvedValueOnce({data:null,error:{code:"55000"}});expect((await POST(request({...envelope,eventType,payload:{envelope_id:envelope.aggregateId}}))).status).toBe(503);
});
it("observes explicit franchise simulation as simulation fact without issuing legal effects or email",async()=>{
 process.env.INTERNAL_WEBHOOK_SECRET=secret;vi.clearAllMocks();const write=vi.spyOn(process.stdout,"write").mockImplementation(()=>true);try{const response=await POST(request({...envelope,eventType:"FranchiseDemoActivatedV1",payload:{mode:"NON_CONTRACTUAL_DEMO"}}));expect(response.status).toBe(202);expect(response.headers.get("x-matricia-outbox-consumer")).toBe("TERMINAL_OBSERVABILITY");expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.issued).not.toHaveBeenCalled();}finally{write.mockRestore();}
});

it("acknowledges the preserved corrected billing original without claiming a new notification",async()=>{
 process.env.INTERNAL_WEBHOOK_SECRET=secret; mocks.rpc.mockResolvedValueOnce({data:{outcome:"BILLING_ORIGINAL_RETAINED_BY_CORRECTION"},error:null});
 const response=await POST(request({...envelope,eventType:"ProviderBillingDocumentsReadyV1",payload:{artifact_id:envelope.aggregateId}}));
 expect(response.status).toBe(202);expect(await response.json()).toMatchObject({outcome:"BILLING_ORIGINAL_RETAINED_BY_CORRECTION"});expect(response.headers.get("x-matricia-outbox-consumer")).toBe("PROVIDER_BILLING_NOTIFICATION");
});
it("acknowledges a preserved corrected billing source without archiving or notifying it again",async()=>{
 process.env.INTERNAL_WEBHOOK_SECRET=secret;mocks.issued.mockResolvedValueOnce({ok:true,code:"BILLING_ORIGINAL_RETAINED_BY_CORRECTION"});
 const response=await POST(request({...envelope,eventType:"ProviderInvoiceIssuedV1",payload:{invoice_id:envelope.aggregateId}}));
 expect(response.status).toBe(202);expect(await response.json()).toMatchObject({outcome:"BILLING_ORIGINAL_RETAINED_BY_CORRECTION"});
});

it.each(["SignatureEnvelopeReadyV1","ContractSignatureRequestedV1","ContractAmendmentSignatureRequestedV1"])("acknowledges %s only after governed provider dispatch",async eventType=>{
 process.env.INTERNAL_WEBHOOK_SECRET=secret;mocks.rpc.mockResolvedValueOnce({data:{outcome:"SIGNATURE_ENVELOPE_SENT"},error:null});const response=await POST(request({...envelope,eventType,payload:{envelope_id:envelope.aggregateId}}));expect(response.status).toBe(202);expect(response.headers.get("x-matricia-outbox-consumer")).toBe("SIGNATURE_PROVIDER");expect(mocks.rpc).toHaveBeenLastCalledWith("dispatch_governed_signature_envelope_v1",{p_envelope_id:envelope.aggregateId});
});
it("does not acknowledge queued signature simulation before the exact step is executed",async()=>{
 process.env.INTERNAL_WEBHOOK_SECRET=secret;mocks.rpc.mockResolvedValueOnce({data:null,error:{code:"55000"}}).mockResolvedValueOnce({data:{outcome:"SIGNATURE_ENVELOPE_PARTIALLY_SIGNED"},error:null});const event={...envelope,eventType:"SignatureSimulationStepRequestedV1",payload:{command_id:envelope.aggregateId}};expect((await POST(request(event))).status).toBe(503);const response=await POST(request(event));expect(response.status).toBe(202);expect(response.headers.get("x-matricia-outbox-consumer")).toBe("SIGNATURE_SIMULATION");
});

it("does not mark a business conversion on cookie claims or an unavailable authoritative source",async()=>{
 process.env.INTERNAL_WEBHOOK_SECRET=secret;mocks.rpc.mockResolvedValueOnce({data:null,error:{code:"55000"}}).mockResolvedValueOnce({data:{outcome:"MARKETING_BUSINESS_SKIPPED_SIMULATION"},error:null});const event={...envelope,eventType:"ContractSignedV1",payload:{envelope_id:envelope.aggregateId}};expect((await POST(request(event))).status).toBe(503);const response=await POST(request(event));expect(response.status).toBe(202);expect(await response.json()).toMatchObject({outcome:"MARKETING_BUSINESS_SKIPPED_SIMULATION"});expect(response.headers.get("x-matricia-outbox-consumer")).toBe("MARKETING_VERIFIED_CONVERSION");
});
it("acknowledges a durable verified marketing fact with no touch without inventing attribution",async()=>{
 process.env.INTERNAL_WEBHOOK_SECRET=secret;mocks.rpc.mockResolvedValueOnce({data:{outcome:"MARKETING_BUSINESS_SKIPPED_NO_TOUCH"},error:null});const response=await POST(request({...envelope,eventType:"MarketingBusinessFactReadyV2",payload:{fact_id:envelope.aggregateId}}));expect(response.status).toBe(202);expect(await response.json()).toMatchObject({outcome:"MARKETING_BUSINESS_SKIPPED_NO_TOUCH"});expect(mocks.rpc).toHaveBeenLastCalledWith("process_marketing_business_fact_v2",{p_fact_id:envelope.aggregateId});
});
it.each(["OrganizationJoinRequestedV1","OrganizationJoinDecidedV1","OrganizationMergedV1","OrganizationMergeRejectedV1","OrganizationMergeExceptionRaisedV1"])("requires stored workflow proof for %s and never sends mail",async eventType=>{
 process.env.INTERNAL_WEBHOOK_SECRET=secret;vi.clearAllMocks();mocks.rpc.mockResolvedValueOnce({data:false,error:null}).mockResolvedValueOnce({data:true,error:null});const event={...envelope,eventType};expect((await POST(request(event))).status).toBe(503);const response=await POST(request(event));expect(response.status).toBe(202);expect(response.headers.get("x-matricia-outbox-consumer")).toBe("ORGANIZATION_WORKFLOWS");expect(mocks.rpc).toHaveBeenLastCalledWith("verify_organization_workflow_event_v1",{p_outbox_id:envelope.id,p_event_type:eventType,p_resource_id:envelope.aggregateId});expect(mocks.issued).not.toHaveBeenCalled();
});

it("acknowledges request progression only after the stored authoritative transition is verified",async()=>{
 process.env.INTERNAL_WEBHOOK_SECRET=secret;mocks.rpc.mockResolvedValueOnce({data:false,error:null}).mockResolvedValueOnce({data:true,error:null});const event={...envelope,eventType:"ServiceRequestStageChangedV1"};expect((await POST(request(event))).status).toBe(503);const response=await POST(request(event));expect(response.headers.get("x-matricia-outbox-consumer")).toBe("SERVICE_REQUEST_PROGRESSION");expect(mocks.rpc).toHaveBeenLastCalledWith("verify_service_request_stage_event_v1",{p_event_id:envelope.id,p_request_id:envelope.aggregateId});
});
it("acknowledges a cancelled queued mock step as cancelled, never SENT or SIGNED",async()=>{
 process.env.INTERNAL_WEBHOOK_SECRET=secret;mocks.rpc.mockResolvedValueOnce({data:{outcome:"SIGNATURE_SIMULATION_CANCELLED"},error:null});const response=await POST(request({...envelope,eventType:"SignatureSimulationStepRequestedV1",payload:{command_id:envelope.aggregateId}}));expect(response.status).toBe(202);expect(await response.json()).toMatchObject({outcome:"SIGNATURE_SIMULATION_CANCELLED",development_mock:true});
});
it.each(["SelectedQuoteIdentityProposedV1","SelectedQuoteIdentityRespondedV1","SelectedQuoteContractDraftRefreshedV1","InternalMessageAttachmentScanRecordedV1"])("observes persisted %s without sending mail or repeating a business effect",async eventType=>{
 process.env.INTERNAL_WEBHOOK_SECRET=secret;vi.clearAllMocks();const write=vi.spyOn(process.stdout,"write").mockImplementation(()=>true);try{const response=await POST(request({...envelope,eventType,payload:{private_reason:"do-not-log-personal-reason",user_id:"do-not-log-user-id"}}));expect(response.status).toBe(202);expect(response.headers.get("x-matricia-outbox-consumer")).toBe("TERMINAL_OBSERVABILITY");expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.issued).not.toHaveBeenCalled();expect(JSON.stringify(write.mock.calls)).not.toContain("do-not-log-");}finally{write.mockRestore();}
});

it.each(["PlatformAccountChangeRequestedV1","PlatformAccountAccessChangedV1","PlatformAccountChangeRejectedV1"])("observes %s through request metadata without logging identities or repeating effects",async eventType=>{
 process.env.INTERNAL_WEBHOOK_SECRET=secret;vi.clearAllMocks();const write=vi.spyOn(process.stdout,"write").mockImplementation(()=>true);try{
  const event={...envelope,eventType,aggregateId:envelope.correlationId,payload:{request_id:envelope.correlationId,target_user_id:"f2410000-0000-4000-8000-000000000099",reason:"Private personal reason must never enter logs",action:"SUSPEND_ACCOUNT"}};
  const response=await POST(request(event));expect(response.status).toBe(202);expect(response.headers.get("x-matricia-outbox-consumer")).toBe("TERMINAL_OBSERVABILITY");expect(await response.json()).toEqual({outcome:"OUTBOX_EVENT_OBSERVED",eventId:envelope.id,consumer:"TERMINAL_OBSERVABILITY"});
  expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.deliver).not.toHaveBeenCalled();expect(mocks.issued).not.toHaveBeenCalled();expect(mocks.clientIssued).not.toHaveBeenCalled();expect(mocks.social).not.toHaveBeenCalled();
  expect(write).toHaveBeenCalledTimes(1);const record=JSON.parse(String(write.mock.calls[0][0]));expect(record).toMatchObject({correlation_id:envelope.correlationId,request_id:envelope.correlationId,aggregate_id:envelope.correlationId,aggregate_type:eventType,data:{eventId:envelope.id,consumer:"TERMINAL_OBSERVABILITY"}});const serialized=JSON.stringify(record);expect(serialized).not.toContain(event.payload.target_user_id);expect(serialized).not.toContain(event.payload.reason);expect(serialized).not.toContain(event.payload.action);expect(serialized).not.toContain("payload");
 }finally{write.mockRestore();}
});
it.each(["PlatformAccountChangeRequestedV1","PlatformAccountAccessChangedV1","PlatformAccountChangeRejectedV1"])("rejects mismatched %s request metadata without acknowledgement or logs",async eventType=>{
 process.env.INTERNAL_WEBHOOK_SECRET=secret;vi.clearAllMocks();const write=vi.spyOn(process.stdout,"write").mockImplementation(()=>true);try{for(const payload of[{}, {request_id:"not-an-id"}, {request_id:envelope.aggregateId}]){const response=await POST(request({...envelope,eventType,payload}));expect(response.status).toBe(422);expect(response.headers.get("x-matricia-outbox-consumer")).toBeNull();}expect(write).not.toHaveBeenCalled();expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.deliver).not.toHaveBeenCalled();}finally{write.mockRestore();}
});

it.each(["DsrAllInventoryDraftedV1","DsrAllSourceClassifiedV1","DsrAllInventorySubmittedV1","DsrAllInventoryReviewedV1","DsrAllCapturedV1","DsrAllExclusionProposedV1","DsrAllExclusionReviewedV1","DsrAllResponsePreparedV1"])("observes immutable inventory fact %s without claiming a disposition or disclosing records",async eventType=>{
 process.env.INTERNAL_WEBHOOK_SECRET=secret;vi.clearAllMocks();const write=vi.spyOn(process.stdout,"write").mockImplementation(()=>true);try{const response=await POST(request({...envelope,eventType,payload:{private_records:"PERSONAL-RECORD-MUST-NOT-BE-LOGGED",target_user_id:"PERSONAL-USER-MUST-NOT-BE-LOGGED",purged:false,delivery_completed:false}}));expect(response.status).toBe(202);expect(response.headers.get("x-matricia-outbox-consumer")).toBe("TERMINAL_OBSERVABILITY");expect(await response.json()).toMatchObject({outcome:"OUTBOX_EVENT_OBSERVED"});expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.deliver).not.toHaveBeenCalled();expect(mocks.issued).not.toHaveBeenCalled();expect(mocks.clientIssued).not.toHaveBeenCalled();expect(mocks.social).not.toHaveBeenCalled();const record=JSON.parse(String(write.mock.calls[0][0]));expect(record.data).toEqual({eventId:envelope.id,consumer:"TERMINAL_OBSERVABILITY",factClass:"PERSISTED_DSR_INVENTORY"});expect(JSON.stringify(record)).not.toContain("PERSONAL-");expect(JSON.stringify(record)).not.toContain("purged");expect(JSON.stringify(record)).not.toContain("delivery_completed");}finally{write.mockRestore();}
});

const persistedFinancialFacts = [
  ...["BenefitScheduledV1", "BenefitStartedV1", "BenefitDeliveryProposedV1", "BenefitDeliveryAcceptedV1", "BenefitDeliveryRejectedV1"].map(eventType => ({ eventType, field: "redemption_id", factClass: "PERSISTED_BENEFIT_FULFILLMENT" })),
  ...["ManualCreditGrantRequestedV1", "ManualCreditGrantReviewedV1", "ManualCreditGrantExecutedV1"].map(eventType => ({ eventType, field: "request_id", factClass: "PERSISTED_MANUAL_CREDIT_GOVERNANCE" })),
];
it.each(persistedFinancialFacts)("observes $eventType without repeating money or delivery effects", async ({eventType, field, factClass}) => {
  process.env.INTERNAL_WEBHOOK_SECRET = secret; vi.clearAllMocks();
  const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  try {
    // Correlation belongs to the transaction; it need not equal the redemption or grant request.
    expect(envelope.correlationId).not.toBe(envelope.aggregateId);
    const response = await POST(request({...envelope, eventType, payload:{[field]:envelope.aggregateId, private_note:"NEVER-LOG-FINANCIAL-NOTE", scan_verdict:"UNTRUSTED", quantity:99999}}));
    expect(response.status).toBe(202);
    expect(response.headers.get("x-matricia-outbox-consumer")).toBe("TERMINAL_OBSERVABILITY");
    expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.deliver).not.toHaveBeenCalled();expect(mocks.issued).not.toHaveBeenCalled();expect(mocks.clientIssued).not.toHaveBeenCalled();expect(mocks.social).not.toHaveBeenCalled();
    const record = JSON.parse(String(write.mock.calls[0][0]));
    expect(record).toMatchObject({correlation_id:envelope.correlationId, aggregate_id:envelope.aggregateId, data:{factClass, consumer:"TERMINAL_OBSERVABILITY"}});
    expect(JSON.stringify(record)).not.toMatch(/NEVER-LOG|scan_verdict|quantity|UNTRUSTED/);
  } finally {write.mockRestore();}
});
it.each(persistedFinancialFacts)("rejects mismatched $eventType source metadata", async ({eventType, field}) => {
  process.env.INTERNAL_WEBHOOK_SECRET = secret; vi.clearAllMocks();
  const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  try {
    const response = await POST(request({...envelope, eventType, payload:{[field]:envelope.correlationId}}));
    expect(response.status).toBe(422);expect(response.headers.get("x-matricia-outbox-consumer")).toBeNull();expect(write).not.toHaveBeenCalled();expect(mocks.rpc).not.toHaveBeenCalled();
  } finally {write.mockRestore();}
});

it("acknowledges a verified payment dispatch only after the durable inbox consumer succeeds",async()=>{process.env.INTERNAL_WEBHOOK_SECRET=secret;vi.clearAllMocks();mocks.paymentDispatch.mockResolvedValueOnce({ok:true,code:"VERIFIED_PAYMENT_DISPATCHED"});const response=await POST(request({...envelope,eventType:"VerifiedPaymentDispatchRequestedV1",payload:{receipt_id:envelope.aggregateId}}));expect(response.status).toBe(202);expect(response.headers.get("x-matricia-outbox-consumer")).toBe("VERIFIED_PAYMENT_DISPATCH");expect(mocks.paymentDispatch).toHaveBeenCalledWith(envelope.aggregateId);expect(mocks.deliver).not.toHaveBeenCalled();});
it("does not mark an unresolved verified payment fact as terminally observed",async()=>{process.env.INTERNAL_WEBHOOK_SECRET=secret;vi.clearAllMocks();mocks.paymentDispatch.mockResolvedValueOnce({ok:false,code:"PAYMENT_PURPOSE_RESOLUTION_REQUIRED"});const response=await POST(request({...envelope,eventType:"VerifiedPaymentDispatchRequestedV1",payload:{receipt_id:envelope.aggregateId}}));expect(response.status).toBe(503);expect(response.headers.get("x-matricia-outbox-consumer")).toBeNull();expect(mocks.deliver).not.toHaveBeenCalled();});

it("acknowledges a verified restriction skip without claiming a marketing conversion",async()=>{process.env.INTERNAL_WEBHOOK_SECRET=secret;vi.clearAllMocks();mocks.rpc.mockResolvedValueOnce({data:{outcome:"MARKETING_BUSINESS_SKIPPED_RESTRICTION"},error:null});const response=await POST(request({...envelope,eventType:"MarketingBusinessFactReadyV2",payload:{fact_id:envelope.aggregateId}}));expect(response.status).toBe(202);expect(response.headers.get("x-matricia-outbox-consumer")).toBe("MARKETING_VERIFIED_CONVERSION");expect(await response.json()).toEqual({outcome:"MARKETING_BUSINESS_SKIPPED_RESTRICTION"});expect(mocks.deliver).not.toHaveBeenCalled();});

it.each(["DsrErasureScopeConfirmedV1","DsrErasureDraftedV1","DsrErasureSourceConfiguredV1","DsrErasurePlanSubmittedV1","DsrErasurePlanReviewedV1","DsrErasureSourceExecutedV1","DsrErasureReportPreparedV1","DsrErasureReportReviewedV1","DsrErasureReportAcknowledgedV1","DsrErasurePlanRevokedV1"])("observes %s without claiming an additional erasure or logging source records",async eventType=>{process.env.INTERNAL_WEBHOOK_SECRET=secret;vi.clearAllMocks();const write=vi.spyOn(process.stdout,"write").mockImplementation(()=>true);try{const response=await POST(request({...envelope,eventType,payload:{private_source:"NEVER-LOG-ERASED-VALUE",subject_user_id:"NEVER-LOG-ERASURE-SUBJECT",all_data_erased:false}}));expect(response.status).toBe(202);expect(response.headers.get("x-matricia-outbox-consumer")).toBe("TERMINAL_OBSERVABILITY");expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.deliver).not.toHaveBeenCalled();expect(mocks.issued).not.toHaveBeenCalled();expect(mocks.clientIssued).not.toHaveBeenCalled();expect(mocks.paymentDispatch).not.toHaveBeenCalled();const record=JSON.parse(String(write.mock.calls[0][0]));expect(record.data).toMatchObject({factClass:"PERSISTED_DSR_ERASURE_WORKFLOW"});expect(JSON.stringify(record)).not.toMatch(/NEVER-LOG|all_data_erased/);}finally{write.mockRestore();}});
it("tracks paid subscription credit jobs only after canonical SQL attestation",async()=>{process.env.INTERNAL_WEBHOOK_SECRET=secret;vi.clearAllMocks();mocks.rpc.mockResolvedValueOnce({data:{outcome:"SUBSCRIPTION_CREDIT_JOBS_TRACKED"},error:null});const response=await POST(request({...envelope,eventType:"SubscriptionPaidV1",payload:{}}));expect(response.status).toBe(202);expect(response.headers.get("x-matricia-outbox-consumer")).toBe("SUBSCRIPTION_CREDIT_FULFILLMENT");expect(mocks.rpc).toHaveBeenCalledWith("track_subscription_paid_credit_jobs_v1",{p_outbox_id:envelope.id,p_subscription_id:envelope.aggregateId});expect(mocks.deliver).not.toHaveBeenCalled();});
it("does not observe a paid subscription when canonical job tracking failed",async()=>{process.env.INTERNAL_WEBHOOK_SECRET=secret;vi.clearAllMocks();mocks.rpc.mockResolvedValueOnce({data:null,error:{code:"55000"}});const response=await POST(request({...envelope,eventType:"SubscriptionPaidV1",payload:{}}));expect(response.status).toBe(503);expect(response.headers.get("x-matricia-outbox-consumer")).toBeNull();});

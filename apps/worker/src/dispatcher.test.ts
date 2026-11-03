import { describe, expect, it, vi } from "vitest";
import { createWorkerDispatcher } from "./dispatcher";
import type { OutboxEnvelope } from "./index";

const envelope: OutboxEnvelope = {
  id: "42",
  eventType: "DocumentUploadedV1",
  aggregateId: "a1111111-1111-4111-8111-111111111111",
  occurredAt: "2026-09-11T00:00:00.000Z",
  correlationId: "a4444444-4444-4444-8444-444444444444",
  payload: {},
};

it("requires the acquisition invitation consumer acknowledgement instead of a terminal observation", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 202, headers: { "x-matricia-outbox-consumer": "TERMINAL_OBSERVABILITY" } }));
  const dispatcher = createWorkerDispatcher({ documentScanConsumer: { consume: vi.fn().mockResolvedValue(null) }, dispatchUrl: new URL("https://internal.example.test/events"), webhookSecret: "local-test-secret", fetcher });
  const event = { ...envelope, eventType: "FranchiseNetworkInvitationRequestedV1" };
  await expect(dispatcher.dispatch(event)).rejects.toThrow();
  fetcher.mockResolvedValue(new Response(null, { status: 202, headers: { "x-matricia-outbox-consumer": "FRANCHISE_NETWORK_INVITATION" } }));
  await expect(dispatcher.dispatch(event)).resolves.toBeUndefined();
});

describe("worker dispatcher", () => {
  it("handles document uploads locally without exposing them to the webhook", async () => {
    const consume = vi.fn().mockResolvedValue({ outcome: "DOCUMENT_SCAN_RECORDED" });
    const fetcher = vi.fn();
    const dispatcher = createWorkerDispatcher({
      documentScanConsumer: { consume },
      dispatchUrl: new URL("https://internal.example.test/events"),
      webhookSecret: "test-secret",
      fetcher,
    });

    await dispatcher.dispatch(envelope);

    expect(consume).toHaveBeenCalledWith(envelope);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("forwards unrelated events through the existing authenticated webhook", async () => {
    const consume = vi.fn().mockResolvedValue(null);
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 202, headers: { "x-matricia-outbox-consumer": "TERMINAL_OBSERVABILITY" } }));
    const dispatcher = createWorkerDispatcher({
      documentScanConsumer: { consume },
      dispatchUrl: new URL("https://internal.example.test/events"),
      webhookSecret: "test-secret",
      fetcher,
    });
    const event = { ...envelope, eventType: "OrganizationCreatedV1" };

    await dispatcher.dispatch(event);

    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://internal.example.test/events"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer test-secret" }),
        body: JSON.stringify(event),
      }),
    );
  });

  it("fails closed when document scanning fails", async () => {
    const fetcher = vi.fn();
    const dispatcher = createWorkerDispatcher({
      documentScanConsumer: { consume: vi.fn().mockRejectedValue(new Error("scan unavailable")) },
      dispatchUrl: new URL("https://internal.example.test/events"),
      webhookSecret: "test-secret",
      fetcher,
    });

    await expect(dispatcher.dispatch(envelope)).rejects.toThrow("scan unavailable");
    expect(fetcher).not.toHaveBeenCalled();
  });
});

it("does not download or scan a document when antivirus is known unavailable", async () => {
  const consume = vi.fn(), fetcher = vi.fn();
  const dispatcher = createWorkerDispatcher({ documentScanConsumer: { consume }, dispatchUrl: new URL("http://127.0.0.1/events"), webhookSecret: "test", fetcher, canScanDocuments: () => false });
  await expect(dispatcher.dispatch(envelope)).rejects.toThrow("ANTIVIRUS_UNAVAILABLE"); expect(consume).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
});

it.each([null, "TERMINAL_OBSERVABILITY", "OTHER_CONSUMER"])("requires the authoritative consumer acknowledgement for a refund, got %s", async consumer => {
  const headers: Record<string, string> = consumer ? { "x-matricia-outbox-consumer": consumer } : {};
  const dispatcher = createWorkerDispatcher({ documentScanConsumer: { consume: vi.fn(async () => null) }, dispatchUrl: new URL("http://127.0.0.1/events"), webhookSecret: "test", fetcher: vi.fn(async () => new Response(null, { status: 202, headers })) });
  await expect(dispatcher.dispatch({ ...envelope, eventType: "SubscriptionRefundAuthorizedV1" })).rejects.toThrow("OUTBOX_CONSUMER_ACK_INVALID");
});

it("requires tracked-work acknowledgement for retention without claiming disposition", async () => {
 const dispatcher = createWorkerDispatcher({ documentScanConsumer: { consume: vi.fn(async () => null) }, dispatchUrl: new URL("http://127.0.0.1/events"), webhookSecret: "test", fetcher: vi.fn(async () => new Response(null, { status: 202, headers: { "x-matricia-outbox-consumer": "PRIVACY_DISPOSITION" } })) });
 await expect(dispatcher.dispatch({ ...envelope, eventType: "PrivacyRetentionActionRequestedV1" })).rejects.toThrow("OUTBOX_CONSUMER_ACK_INVALID");
});

it("requires the real billing consumer for credit-note issuance rather than terminal observation",async()=>{
 const fetcher=vi.fn(async()=>new Response(null,{status:202,headers:{"x-matricia-outbox-consumer":"TERMINAL_OBSERVABILITY"}}));
 const dispatcher=createWorkerDispatcher({documentScanConsumer:{consume:async()=>null},dispatchUrl:new URL("http://127.0.0.1/events"),webhookSecret:"test",fetcher});
 await expect(dispatcher.dispatch({...envelope,eventType:"ProviderCreditNoteIssuedV1"})).rejects.toThrow("OUTBOX_CONSUMER_ACK_INVALID");
 fetcher.mockResolvedValue(new Response(null,{status:202,headers:{"x-matricia-outbox-consumer":"PROVIDER_BILLING_DOCUMENTS"}}));
 await expect(dispatcher.dispatch({...envelope,eventType:"ProviderCreditNoteIssuedV1"})).resolves.toBeUndefined();
});

it.each(["ContractSignatureRequestedV1","ContractAmendmentSignatureRequestedV1"])("refuses a terminal observer acknowledgement for actual legal request%s",async eventType=>{
 const dispatcher=createWorkerDispatcher({documentScanConsumer:{consume:async()=>null},dispatchUrl:new URL("http://127.0.0.1/events"),webhookSecret:"test",fetcher:async()=>new Response(null,{status:202,headers:{"x-matricia-outbox-consumer":"TERMINAL_OBSERVABILITY"}})});
 await expect(dispatcher.dispatch({...envelope,eventType})).rejects.toThrow("OUTBOX_CONSUMER_ACK_INVALID");
});
it("requires the actual simulation consumer acknowledgement for a queued signature step",async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(new Response(null,{status:202,headers:{"x-matricia-outbox-consumer":"TERMINAL_OBSERVABILITY"}})).mockResolvedValueOnce(new Response(null,{status:202,headers:{"x-matricia-outbox-consumer":"SIGNATURE_SIMULATION"}}));
 const dispatcher=createWorkerDispatcher({documentScanConsumer:{consume:vi.fn().mockResolvedValue(null)},dispatchUrl:new URL("https://internal.example.test/events"),webhookSecret:"test-secret",fetcher});const event={...envelope,eventType:"SignatureSimulationStepRequestedV1"};
 await expect(dispatcher.dispatch(event)).rejects.toThrow();await expect(dispatcher.dispatch(event)).resolves.toBeUndefined();
});
it.each([["SubscriptionPaidV1","SUBSCRIPTION_CREDIT_FULFILLMENT"],["MarketingBusinessFactReadyV2","MARKETING_VERIFIED_CONVERSION"],["ContractSignedV1","MARKETING_VERIFIED_CONVERSION"],["OrganizationMergedV1","ORGANIZATION_WORKFLOWS"],["VerifiedPaymentDispatchRequestedV1","VERIFIED_PAYMENT_DISPATCH"]])("requires source-verified acknowledgement for%s",async(eventType,consumer)=>{
 const fetcher=vi.fn().mockResolvedValueOnce(new Response(null,{status:202,headers:{"x-matricia-outbox-consumer":"TERMINAL_OBSERVABILITY"}})).mockResolvedValueOnce(new Response(null,{status:202,headers:{"x-matricia-outbox-consumer":consumer!}}));const dispatcher=createWorkerDispatcher({documentScanConsumer:{consume:vi.fn().mockResolvedValue(null)},dispatchUrl:new URL("https://internal.example.test/events"),webhookSecret:"test-secret",fetcher});const event={...envelope,eventType:eventType!};await expect(dispatcher.dispatch(event)).rejects.toThrow();await expect(dispatcher.dispatch(event)).resolves.toBeUndefined();
});

it.each(["PlatformAccountChangeRequestedV1","PlatformAccountAccessChangedV1","PlatformAccountChangeRejectedV1"])("requires only the terminal account-fact acknowledgement for %s",async eventType=>{
 const fetcher=vi.fn().mockResolvedValueOnce(new Response(null,{status:202,headers:{"x-matricia-outbox-consumer":"ADMIN_OPERATIONAL_ACTION"}})).mockResolvedValueOnce(new Response(null,{status:202,headers:{"x-matricia-outbox-consumer":"TERMINAL_OBSERVABILITY"}}));const dispatcher=createWorkerDispatcher({documentScanConsumer:{consume:vi.fn().mockResolvedValue(null)},dispatchUrl:new URL("https://internal.example.test/events"),webhookSecret:"test-secret",fetcher});
 const event={...envelope,eventType,aggregateId:envelope.correlationId,payload:{request_id:envelope.correlationId}};await expect(dispatcher.dispatch(event)).rejects.toThrow("OUTBOX_CONSUMER_ACK_INVALID");await expect(dispatcher.dispatch(event)).resolves.toBeUndefined();expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toMatchObject({eventType,aggregateId:envelope.correlationId,correlationId:envelope.correlationId});
});


it("requires finance scanner completion instead of terminal acknowledgement", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 202, headers: { "x-matricia-outbox-consumer": "TERMINAL_OBSERVABILITY" } }));
  const dispatcher = createWorkerDispatcher({ documentScanConsumer: { consume: vi.fn().mockResolvedValue(null) }, dispatchUrl: new URL("https://internal.example.test/events"), webhookSecret: "test-only", fetcher });
  const event = { ...envelope, eventType: "FinanceCostDocumentUploadedV1" };
  await expect(dispatcher.dispatch(event)).rejects.toThrow("OUTBOX_CONSUMER_ACK_INVALID");
  fetcher.mockResolvedValue(new Response(null, { status: 202, headers: { "x-matricia-outbox-consumer": "FINANCE_COST_SCAN" } }));
  await expect(dispatcher.dispatch(event)).resolves.toBeUndefined();
});

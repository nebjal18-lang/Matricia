import { OutboxAcknowledgementError, OutboxDependencyUnavailableError } from "./dispatch-errors";
import type { DocumentScanOutboxConsumer } from "./client-compliance";
import type { OutboxDispatcher, OutboxEnvelope } from "./index";

type Fetch = typeof fetch;

export type WorkerDispatcherDependencies = Readonly<{
  documentScanConsumer: DocumentScanOutboxConsumer;
  dispatchUrl: URL;
  webhookSecret: string;
  fetcher?: Fetch;
  canScanDocuments?: () => boolean;
}>;

function expectedConsumer(eventType: string): string {
  if (eventType === "SubscriptionPaidV1") return "SUBSCRIPTION_CREDIT_FULFILLMENT";
  if (eventType === "VerifiedPaymentDispatchRequestedV1") return "VERIFIED_PAYMENT_DISPATCH";
  if (eventType === "ServiceRequestStageChangedV1") return "SERVICE_REQUEST_PROGRESSION";
  if (["OrganizationJoinRequestedV1","OrganizationJoinDecidedV1","OrganizationMergedV1","OrganizationMergeRejectedV1","OrganizationMergeExceptionRaisedV1"].includes(eventType)) return "ORGANIZATION_WORKFLOWS";
  if (["MarketingBusinessFactReadyV2","ContractSignedV1"].includes(eventType)) return "MARKETING_VERIFIED_CONVERSION";
  if (eventType === "SignatureSimulationStepRequestedV1") return "SIGNATURE_SIMULATION";
  if (eventType === "ClientCommercialDocumentIssuedV1") return "CLIENT_BILLING_DOCUMENTS";
  if (eventType === "SocialNativeVerificationRequestedV1") return "SOCIAL_NATIVE_VERIFICATION";
  if (eventType === "OrganizationEmailInvitationRequestedV1") return "ORGANIZATION_EMAIL_INVITATION";
  if (eventType === "AdminActionAuthorizedV1") return "ADMIN_OPERATIONAL_ACTION";
  if (eventType === "SubscriptionRefundReconciliationAuthorizedV1") return "SUBSCRIPTION_REFUND_RECONCILIATION";
  if (eventType === "SubscriptionRefundAuthorizedV1") return "SUBSCRIPTION_REFUND";
  if (eventType === "ProviderInvoiceIssuedV1" || eventType === "ProviderStatementIssuedV1" || eventType === "ProviderCreditNoteIssuedV1") return "PROVIDER_BILLING_DOCUMENTS";
  if (eventType === "ProviderBillingDocumentsReadyV1") return "PROVIDER_BILLING_NOTIFICATION";
  if (["SignatureEnvelopeReadyV1","ContractSignatureRequestedV1","ContractAmendmentSignatureRequestedV1"].includes(eventType)) return "SIGNATURE_PROVIDER";
  if (eventType === "PrivacyRetentionActionRequestedV1") return "PRIVACY_WORK_ITEM_TRACKED";
  if (eventType.startsWith("Privacy") && eventType.endsWith("RequestedV1")) return "PRIVACY_DISPOSITION";
  if (["DsrAllInventoryDraftedV1","DsrAllSourceClassifiedV1","DsrAllInventorySubmittedV1","DsrAllInventoryReviewedV1","DsrAllCapturedV1","DsrAllExclusionProposedV1","DsrAllExclusionReviewedV1","DsrAllResponsePreparedV1"].includes(eventType)) return "TERMINAL_OBSERVABILITY";
  if (["PlatformAccountChangeRequestedV1", "PlatformAccountAccessChangedV1", "PlatformAccountChangeRejectedV1"].includes(eventType)) return "TERMINAL_OBSERVABILITY";
  return "TERMINAL_OBSERVABILITY";
}

export function createWorkerDispatcher(dependencies: WorkerDispatcherDependencies): OutboxDispatcher {
  const fetcher = dependencies.fetcher ?? fetch;
  return Object.freeze({
    async dispatch(event: OutboxEnvelope) {
      if (event.eventType === "DocumentUploadedV1" && dependencies.canScanDocuments?.() === false) throw new OutboxDependencyUnavailableError();
      const scan = await dependencies.documentScanConsumer.consume(event);
      if (scan !== null) return;

      const response = await fetcher(dependencies.dispatchUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${dependencies.webhookSecret}`,
          "content-type": "application/json",
          "x-correlation-id": event.correlationId,
        },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(10_000),
        redirect: "error",
      });
      if (!response.ok) throw new Error("OUTBOX_DISPATCH_REJECTED");
      if (response.headers.get("x-matricia-outbox-consumer") !== expectedConsumer(event.eventType)) throw new OutboxAcknowledgementError();
    },
  });
}

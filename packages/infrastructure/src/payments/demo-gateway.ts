import {
  assertPaymentRequest,
  type PaymentGateway,
  type PaymentIntent,
  type PaymentIntentRequest,
  type PaymentWebhookVerifier,
  type VerifiedPaymentEvent,
} from "./contracts";
import { sha256Hex, signWebhook, verifyPaymentWebhook } from "./webhook";

export class DemoPaymentGateway implements PaymentGateway, PaymentWebhookVerifier {
  readonly code = "DEMO" as const;
  readonly providerEnvironment="DEMO" as const;

  constructor(private readonly webhookSecret?: string) {}

  async createIntent(request: PaymentIntentRequest): Promise<PaymentIntent> {
    assertPaymentRequest(request);
    const digest = await sha256Hex(
      request.purchaseKind === "CREDIT_PACK"
        ? `demo-pack-intent:${request.idempotencyKey}:${request.organizationId}:${request.packVersionId}:${request.amountMinor}:${request.currency}`
        : `demo-intent:${request.idempotencyKey}:${request.organizationId}:${request.planVersionId}:${request.billingInterval}:${request.amountMinor}:${request.currency}`,
    );
    return {
      gateway: this.code,
      providerEnvironment:this.providerEnvironment,
      providerIntentId: `demo_pi_${digest.slice(0, 32)}`,
      status: "REQUIRES_CONFIRMATION",
      amountMinor: request.amountMinor,
      currency: request.currency,
      confirmation: null,
    };
  }

  verifyWebhook(
    rawBody: Uint8Array,
    headers: Readonly<Record<string, string | undefined>>,
  ): Promise<VerifiedPaymentEvent> {
    return verifyPaymentWebhook(rawBody, headers["x-matricia-signature"] ?? "", this.webhookSecret ?? "", this.code);
  }

  async simulateSucceededWebhook(
    input: { providerIntentId: string; amountMinor: string; currency: string; paidAt: string; paymentReference: string },
    secret: string,
  ) {
    const eventDigest = await sha256Hex(`demo-event:${input.providerIntentId}:${input.paymentReference}`);
    const rawBody = new TextEncoder().encode(JSON.stringify({
      gateway: this.code,
      providerEnvironment:this.providerEnvironment,
      providerEventId: `demo_evt_${eventDigest.slice(0, 32)}`,
      providerIntentId: input.providerIntentId,
      eventType: "PAYMENT_SUCCEEDED",
      amountMinor: input.amountMinor,
      currency: input.currency,
      paidAt: input.paidAt,
      paymentReference: input.paymentReference,
    }));
    return { rawBody, signatureHeader: await signWebhook(rawBody, secret) };
  }
}

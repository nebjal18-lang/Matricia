export type PaymentProviderEnvironment = "DEMO" | "SANDBOX" | "LIVE" | "UNVERIFIED";
export type PaymentGatewayCode = "DEMO" | "CMI" | "PAYPAL";
export type BillingInterval = "MONTHLY" | "ANNUAL";

type PaymentIntentCommon = {
  organizationId: string;
  amountMinor: string;
  currency: string;
  idempotencyKey: string;
  returnUrl: string;
};
export type PaymentIntentRequest = PaymentIntentCommon & (
  | { purchaseKind?: "SUBSCRIPTION"; planVersionId: string; billingInterval: BillingInterval }
  | { purchaseKind: "CREDIT_PACK"; packVersionId: string }
);
export type VerifiedOrderLookup = {
  orderId: string;
  status: "CREATED" | "SAVED" | "APPROVED" | "PAYER_ACTION_REQUIRED" | "VOIDED" | "COMPLETED";
  amountMinor: string;
  currency: string;
  verificationMethod: "API_OAUTH2_TLS";
  responseHash: string;
  observedAt: string;
  confirmation: PaymentConfirmation | null;
  capture: null | { captureId: string; amountMinor: string; currency: string; paidAt: string };
};
export interface PaymentOrderLookupGateway {
  readonly code: "PAYPAL";
  readonly providerEnvironment: PaymentProviderEnvironment;
  lookupOrder(orderId: string, expected: PaymentIntentRequest): Promise<VerifiedOrderLookup>;
}

export type PaymentConfirmation =
  | { method: "GET"; url: string }
  | { method: "POST"; url: string; fields: Readonly<Record<string, string>> };

export type PaymentIntent = {
  gateway: PaymentGatewayCode;
  providerEnvironment:PaymentProviderEnvironment;
  providerIntentId: string;
  status: "REQUIRES_CONFIRMATION";
  amountMinor: string;
  currency: string;
  confirmation: PaymentConfirmation | null;
};

export type VerifiedPaymentSuccessEvent = {
  gateway: PaymentGatewayCode;
  providerEnvironment:PaymentProviderEnvironment;
  providerEventId: string;
  providerIntentId: string;
  eventType: "PAYMENT_SUCCEEDED";
  amountMinor: string;
  currency: string;
  paidAt: string;
  paymentReference: string;
  payloadHash: string;
  signatureFingerprint: string;
};

export type VerifiedPaymentAdjustmentEvent = {
  gateway: "PAYPAL";
  providerEnvironment:PaymentProviderEnvironment;
  providerEventId: string;
  eventType: "REFUND_SUCCEEDED" | "PAYMENT_REVERSED" | "DISPUTE_OPENED" | "DISPUTE_WON" | "DISPUTE_LOST";
  providerPaymentId: string;
  providerAdjustmentId: string;
  merchantReference?: string;
  amountMinor: string;
  currency: string;
  occurredAt: string;
  payloadHash: string;
  signatureFingerprint: string;
};
export type VerifiedPaymentEvent = VerifiedPaymentSuccessEvent | VerifiedPaymentAdjustmentEvent;
export type PaymentRefundRequest = { captureId: string; amountMinor: string; currency: string; idempotencyKey: string };
export type VerifiedRefundLookup = { refundId: string; captureId: string; invoiceId: string; amountMinor: string; currency: string; status: "COMPLETED" | "PENDING" | "FAILED" | "CANCELLED"; verificationMethod: "API_OAUTH2_TLS"; responseHash: string; occurredAt: string };
export interface PaymentRefundGateway {
  readonly code: "PAYPAL";
  readonly providerEnvironment:PaymentProviderEnvironment;
  lookupRefund(refundId: string): Promise<VerifiedRefundLookup>;
  requestRefund(request: PaymentRefundRequest): Promise<{ refundId: string; status: "PENDING_WEBHOOK" }>;
}

export interface PaymentGateway {
  readonly code: PaymentGatewayCode;
  readonly providerEnvironment:PaymentProviderEnvironment;
  createIntent(request: PaymentIntentRequest): Promise<PaymentIntent>;
}

export interface PaymentCaptureGateway {
  readonly code: "PAYPAL";
  readonly providerEnvironment:PaymentProviderEnvironment;
  requestCapture(providerIntentId: string, idempotencyKey: string): Promise<{ status: "PENDING_WEBHOOK" }>;
}

export interface PaymentWebhookVerifier {
  readonly code: PaymentGatewayCode;
  readonly providerEnvironment:PaymentProviderEnvironment;
  verifyWebhook(rawBody: Uint8Array, headers: Readonly<Record<string, string | undefined>>, receivedAt?: Date): Promise<VerifiedPaymentEvent>;
}

export type PaymentGatewayErrorCode =
  | "CONFIGURATION_INVALID"
  | "INVALID_REQUEST"
  | "INVALID_AMOUNT"
  | "INVALID_CURRENCY"
  | "INVALID_SIGNATURE"
  | "INVALID_EVENT"
  | "UNSUPPORTED_EVENT"
  | "PROVIDER_UNAVAILABLE";

export class PaymentGatewayError extends Error {
  constructor(readonly code: PaymentGatewayErrorCode) {
    super(code);
    this.name = "PaymentGatewayError";
  }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const maximumMinor = BigInt("9223372036854775807");

export function assertPaymentRequest(request: PaymentIntentRequest): void {
  if (!uuid.test(request.organizationId) || !uuid.test(request.purchaseKind === "CREDIT_PACK" ? request.packVersionId : request.planVersionId) || !uuid.test(request.idempotencyKey)) {
    throw new PaymentGatewayError("INVALID_REQUEST");
  }
  if (request.purchaseKind !== undefined && request.purchaseKind !== "SUBSCRIPTION" && request.purchaseKind !== "CREDIT_PACK") throw new PaymentGatewayError("INVALID_REQUEST");
  if (request.purchaseKind !== "CREDIT_PACK" && !["MONTHLY", "ANNUAL"].includes(request.billingInterval)) throw new PaymentGatewayError("INVALID_REQUEST");
  assertMinorAmount(request.amountMinor);
  if (!/^[A-Z]{3}$/u.test(request.currency)) throw new PaymentGatewayError("INVALID_CURRENCY");
  let returnUrl: URL;
  try {
    returnUrl = new URL(request.returnUrl);
  } catch {
    throw new PaymentGatewayError("INVALID_REQUEST");
  }
  if (returnUrl.protocol !== "https:" && returnUrl.hostname !== "localhost" && returnUrl.hostname !== "127.0.0.1") {
    throw new PaymentGatewayError("INVALID_REQUEST");
  }
}

export function assertMinorAmount(value: string): void {
  if (!/^[1-9]\d*$/u.test(value) || BigInt(value) > maximumMinor) {
    throw new PaymentGatewayError("INVALID_AMOUNT");
  }
}

export function minorToDecimal(value: string): string {
  assertMinorAmount(value);
  return `${value.slice(0, -2) || "0"}.${value.slice(-2).padStart(2, "0")}`;
}

export function decimalToMinor(value: string): string {
  const match = /^(0|[1-9]\d*)\.(\d{2})$/u.exec(value);
  if (!match) throw new PaymentGatewayError("INVALID_AMOUNT");
  const minor = `${match[1]}${match[2]}`.replace(/^0+(?=\d)/u, "");
  assertMinorAmount(minor);
  return minor;
}

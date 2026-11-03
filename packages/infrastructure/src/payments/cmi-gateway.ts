import {
  assertPaymentRequest,
  decimalToMinor,
  minorToDecimal,
  PaymentGatewayError,
  type PaymentGateway,
  type PaymentIntent,
  type PaymentIntentRequest,
  type PaymentWebhookVerifier,
  type VerifiedPaymentEvent,
} from "./contracts";
import { sha256Hex } from "./webhook";
import { assertGatewayCurrency } from "./currency-exponents";

export type CmiGatewayConfig = {
  environment?:"demo"|"live";
  gatewayUrl: string;
  allowedGatewayHosts: ReadonlySet<string>;
  merchantId: string;
  storeKey: string;
};

export class CmiPaymentGateway implements PaymentGateway, PaymentWebhookVerifier {
  readonly code = "CMI" as const;
  readonly providerEnvironment:"SANDBOX"|"UNVERIFIED";
  private readonly gatewayUrl: string;

  constructor(private readonly config: CmiGatewayConfig) {
    let url: URL;
    try {
      url = new URL(config.gatewayUrl);
    } catch {
      throw new PaymentGatewayError("CONFIGURATION_INVALID");
    }
    if (
      url.protocol !== "https:" ||
      !config.allowedGatewayHosts.has(url.hostname) ||
      !/^[A-Za-z0-9_-]{3,64}$/u.test(config.merchantId) ||
      config.storeKey.length < 16
    ) {
      throw new PaymentGatewayError("CONFIGURATION_INVALID");
    }
    this.providerEnvironment=config.environment !== "live" && url.hostname === "testpayment.cmi.co.ma" ? "SANDBOX" : "UNVERIFIED";
    this.gatewayUrl = url.toString();
  }

  async createIntent(request: PaymentIntentRequest): Promise<PaymentIntent> {
    assertPaymentRequest(request);
    assertGatewayCurrency(this.code, request.currency);
    const digest = await sha256Hex(request.purchaseKind === "CREDIT_PACK"
      ? `cmi:credit-pack:${request.organizationId}:${request.packVersionId}:${request.idempotencyKey}`
      : `cmi:${request.organizationId}:${request.planVersionId}:${request.idempotencyKey}`);
    const providerIntentId = `matricia-${digest.slice(0, 32)}`;
    const nonce = digest.slice(32);
    const callbackUrl = callbackFromReturnUrl(request.returnUrl, "cmi");
    const fields: Record<string, string> = {
      clientid: this.config.merchantId,
      oid: providerIntentId,
      amount: minorToDecimal(request.amountMinor),
      okUrl: request.returnUrl,
      failUrl: request.returnUrl,
      callbackUrl,
      TranType: "Auth",
      Instalment: "",
      rnd: nonce,
      currency: "504",
      lang: localeFromReturnUrl(request.returnUrl),
      storetype: "3D_PAY_HOSTING",
      hashAlgorithm: "ver1",
    };
    fields.hash = await cmiDigest(
      `${fields.clientid}${fields.oid}${fields.amount}${fields.okUrl}${fields.failUrl}${fields.TranType}${fields.Instalment}${fields.rnd}${fields.currency}${this.config.storeKey}`,
    );
    return {
      gateway: this.code,
      providerEnvironment:this.providerEnvironment,
      providerIntentId,
      status: "REQUIRES_CONFIRMATION",
      amountMinor: request.amountMinor,
      currency: request.currency,
      confirmation: { method: "POST", url: this.gatewayUrl, fields },
    };
  }

  async verifyWebhook(
    rawBody: Uint8Array,
    _headers: Readonly<Record<string, string | undefined>>,
    receivedAt = new Date(),
  ): Promise<VerifiedPaymentEvent> {
    let body: URLSearchParams;
    try {
      body = new URLSearchParams(new TextDecoder("utf-8", { fatal: true }).decode(rawBody));
    } catch {
      throw new PaymentGatewayError("INVALID_EVENT");
    }
    const hashParams = required(body, "HASHPARAMS", 1_000);
    const hashParamsValue = required(body, "HASHPARAMSVAL", 4_000);
    const suppliedHash = required(body, "HASH", 200);
    const names = hashParams.split(":").filter(Boolean);
    if (names.length === 0 || names.length > 64 || names.some((name) => !/^[A-Za-z0-9_.-]{1,80}$/u.test(name))) {
      throw new PaymentGatewayError("INVALID_EVENT");
    }
    const reconstructed = names.map((name) => body.get(name) ?? "").join("");
    if (!constantTimeEqual(reconstructed, hashParamsValue)) throw new PaymentGatewayError("INVALID_SIGNATURE");
    const expectedHash = await cmiDigest(`${hashParamsValue}${this.config.storeKey}`);
    if (!constantTimeEqual(expectedHash, suppliedHash)) throw new PaymentGatewayError("INVALID_SIGNATURE");
    if (body.get("Response") !== "Approved" || body.get("ProcReturnCode") !== "00" || !/^[1-4]$/u.test(body.get("mdStatus") ?? "")) {
      throw new PaymentGatewayError("UNSUPPORTED_EVENT");
    }
    const providerIntentId = required(body, "oid", 200);
    const providerEventId = required(body, "TransId", 200);
    const paymentReference = body.get("AuthCode")?.trim() || providerEventId;
    if (providerIntentId.length < 8 || providerEventId.length < 8 || paymentReference.length < 3) {
      throw new PaymentGatewayError("INVALID_EVENT");
    }
    const amountMinor = decimalToMinor(required(body, "amount", 32));
    const currency = body.get("currency") === "504" || body.get("currency") === "MAD" ? "MAD" : null;
    if (!currency || Number.isNaN(receivedAt.getTime())) throw new PaymentGatewayError("INVALID_EVENT");
    return {
      gateway: this.code,
      providerEnvironment:this.providerEnvironment,
      providerEventId,
      providerIntentId,
      eventType: "PAYMENT_SUCCEEDED",
      amountMinor,
      currency,
      paidAt: receivedAt.toISOString(),
      paymentReference,
      payloadHash: await sha256Hex(rawBody),
      signatureFingerprint: await sha256Hex(suppliedHash),
    };
  }
}

async function cmiDigest(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(value)));
  let binary = "";
  for (const byte of digest) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function required(body: URLSearchParams, name: string, maximum: number): string {
  const value = body.get(name);
  if (!value || value.length > maximum) throw new PaymentGatewayError("INVALID_EVENT");
  return value;
}

function callbackFromReturnUrl(returnUrl: string, provider: string): string {
  const url = new URL(returnUrl);
  return new URL(`/api/webhooks/payments/${provider}`, url.origin).toString();
}

function localeFromReturnUrl(returnUrl: string): "fr" | "ar" {
  return new URL(returnUrl).pathname.split("/")[1] === "ar" ? "ar" : "fr";
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

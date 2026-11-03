import { createPublicKey, createVerify } from "node:crypto";
import {
  assertPaymentRequest,
  assertMinorAmount,
  type PaymentRefundGateway,
  type PaymentOrderLookupGateway,
  type VerifiedOrderLookup,
  type VerifiedRefundLookup,
  type PaymentRefundRequest,
  type VerifiedPaymentAdjustmentEvent,
  decimalToMinor,
  minorToDecimal,
  PaymentGatewayError,
  type PaymentGateway,
  type PaymentCaptureGateway,
  type PaymentIntent,
  type PaymentIntentRequest,
  type PaymentWebhookVerifier,
  type VerifiedPaymentEvent,
} from "./contracts";
import { sha256Hex } from "./webhook";
import { assertGatewayCurrency, isSupportedTwoDecimalCurrency } from "./currency-exponents";

export type PayPalOrderClient = {
  createOrder(input: {
    requestId: string;
    invoiceId: string;
    amount: string;
    currency: string;
    returnUrl: string;
  }): Promise<unknown>;
  captureOrder(input: { orderId: string; requestId: string }): Promise<unknown>;
  lookupOrder?(orderId: string): Promise<unknown>;
  lookupRefund?(refundId: string): Promise<unknown>;
  refundCapture?(input: { captureId: string; requestId: string; amount: string; currency: string }): Promise<unknown>;
};

export type PayPalGatewayConfig = {
  environment?:"sandbox"|"live";
  webhookId: string;
  certificateUrl: string;
  certificatePem: string;
  allowedCurrencies: ReadonlySet<string>;
};

export class PayPalPaymentGateway implements PaymentGateway, PaymentCaptureGateway, PaymentRefundGateway, PaymentWebhookVerifier, PaymentOrderLookupGateway {
  readonly code = "PAYPAL" as const;
  readonly providerEnvironment:"LIVE"|"SANDBOX";
  private readonly certificateUrl: string;

  constructor(private readonly orderClient: PayPalOrderClient, private readonly config: PayPalGatewayConfig) {
    let certificateUrl: URL;
    try {
      certificateUrl = new URL(config.certificateUrl);
      createPublicKey(config.certificatePem);
    } catch {
      throw new PaymentGatewayError("CONFIGURATION_INVALID");
    }
    if (
      certificateUrl.protocol !== "https:" ||
      !isPayPalApiHost(certificateUrl.hostname) ||
      !certificateUrl.pathname.startsWith("/v1/notifications/certs/") ||
      !/^[A-Za-z0-9_-]{6,50}$/u.test(config.webhookId) ||
      config.allowedCurrencies.size === 0 ||
      [...config.allowedCurrencies].some((currency) => !isSupportedTwoDecimalCurrency(currency))
    ) {
      throw new PaymentGatewayError("CONFIGURATION_INVALID");
    }
    this.providerEnvironment=certificateUrl.hostname.includes(".sandbox.")?"SANDBOX":"LIVE";
    if(config.environment && (config.environment === "live" ? "LIVE" : "SANDBOX") !== this.providerEnvironment)throw new PaymentGatewayError("CONFIGURATION_INVALID");
    this.certificateUrl = certificateUrl.toString();
  }

  async createIntent(request: PaymentIntentRequest): Promise<PaymentIntent> {
    assertPaymentRequest(request);
    assertGatewayCurrency(this.code, request.currency);
    if (!this.config.allowedCurrencies.has(request.currency)) throw new PaymentGatewayError("INVALID_CURRENCY");
    const invoiceDigest = await paypalInvoiceDigest(request);
    let response: unknown;
    try {
      response = await this.orderClient.createOrder({
        requestId: request.purchaseKind === "CREDIT_PACK" ? `p-${invoiceDigest.slice(0, 32)}` : request.idempotencyKey,
        invoiceId: `matricia-${invoiceDigest.slice(0, 32)}`,
        amount: minorToDecimal(request.amountMinor),
        currency: request.currency,
        returnUrl: request.returnUrl,
      });
    } catch {
      throw new PaymentGatewayError("PROVIDER_UNAVAILABLE");
    }
    const parsed = parseOrder(response);
    return {
      gateway: this.code,
      providerEnvironment:this.providerEnvironment,
      providerIntentId: parsed.id,
      status: "REQUIRES_CONFIRMATION",
      amountMinor: request.amountMinor,
      currency: request.currency,
      confirmation: { method: "GET", url: parsed.approvalUrl },
    };
  }

  async requestCapture(providerIntentId: string, idempotencyKey: string): Promise<{ status: "PENDING_WEBHOOK" }> {
    if (!/^[A-Z0-9-]{8,200}$/u.test(providerIntentId) || !/^[0-9a-f-]{36}$/iu.test(idempotencyKey)) {
      throw new PaymentGatewayError("INVALID_REQUEST");
    }
    let response: unknown;
    try {
      response = await this.orderClient.captureOrder({ orderId: providerIntentId, requestId: idempotencyKey });
    } catch {
      throw new PaymentGatewayError("PROVIDER_UNAVAILABLE");
    }
    if (!isRecord(response) || response.id !== providerIntentId || !["COMPLETED", "APPROVED", "PAYER_ACTION_REQUIRED"].includes(String(response.status))) {
      throw new PaymentGatewayError("PROVIDER_UNAVAILABLE");
    }
    return { status: "PENDING_WEBHOOK" };
  }

  async lookupOrder(orderId: string, expected: PaymentIntentRequest): Promise<VerifiedOrderLookup> {
    assertPaymentRequest(expected);
    assertGatewayCurrency(this.code, expected.currency);
    if (!/^[A-Z0-9-]{8,200}$/u.test(orderId) || !this.orderClient.lookupOrder || !this.config.allowedCurrencies.has(expected.currency)) throw new PaymentGatewayError("INVALID_REQUEST");
    let response: unknown;
    try { response = await this.orderClient.lookupOrder(orderId); } catch { throw new PaymentGatewayError("PROVIDER_UNAVAILABLE"); }
    if (!isRecord(response) || response.id !== orderId || response.intent !== "CAPTURE" || !["CREATED", "SAVED", "APPROVED", "PAYER_ACTION_REQUIRED", "VOIDED", "COMPLETED"].includes(String(response.status)) || !Array.isArray(response.purchase_units) || response.purchase_units.length !== 1) throw new PaymentGatewayError("INVALID_EVENT");
    const unit: unknown = response.purchase_units[0];
    const invoiceId = `matricia-${(await paypalInvoiceDigest(expected)).slice(0, 32)}`;
    if (!isRecord(unit) || unit.invoice_id !== invoiceId || !isRecord(unit.amount) || unit.amount.currency_code !== expected.currency || unit.amount.value !== minorToDecimal(expected.amountMinor)) throw new PaymentGatewayError("INVALID_EVENT");
    const payments = isRecord(unit.payments) ? unit.payments : null;
    const captures = payments?.captures;
    let capture: VerifiedOrderLookup["capture"] = null;
    if (captures !== undefined) {
      if (!Array.isArray(captures) || captures.length !== 1 || !isRecord(captures[0])) throw new PaymentGatewayError("INVALID_EVENT");
      const item = captures[0];
      if (response.status !== "COMPLETED" || item.status !== "COMPLETED" || typeof item.id !== "string" || !/^[A-Z0-9-]{8,200}$/u.test(item.id) || !isRecord(item.amount) || item.amount.currency_code !== expected.currency || item.amount.value !== minorToDecimal(expected.amountMinor) || typeof item.create_time !== "string" || !Number.isFinite(Date.parse(item.create_time)) || Date.parse(item.create_time) > Date.now() + 300_000) throw new PaymentGatewayError("INVALID_EVENT");
      capture = {captureId:item.id, amountMinor:expected.amountMinor, currency:expected.currency, paidAt:new Date(item.create_time).toISOString()};
    }
    if ((response.status === "COMPLETED") !== (capture !== null)) throw new PaymentGatewayError("INVALID_EVENT");
    let confirmation: VerifiedOrderLookup["confirmation"] = null;
    if (Array.isArray(response.links) && response.links.some(link => isRecord(link) && link.rel === "approve")) {
      const parsed = parseOrder(response); const url = new URL(parsed.approvalUrl);
      if ((url.hostname.includes("sandbox")) !== (this.providerEnvironment === "SANDBOX")) throw new PaymentGatewayError("INVALID_EVENT");
      confirmation = {method:"GET",url:parsed.approvalUrl};
    }
    return {confirmation, orderId, status:response.status as VerifiedOrderLookup["status"], amountMinor:expected.amountMinor, currency:expected.currency, verificationMethod:"API_OAUTH2_TLS", responseHash:await sha256Hex(JSON.stringify(response)), observedAt:new Date().toISOString(), capture};
  }

  async lookupRefund(refundId: string): Promise<VerifiedRefundLookup> {
    if (!/^[A-Z0-9-]{8,200}$/u.test(refundId) || !this.orderClient.lookupRefund) throw new PaymentGatewayError("INVALID_REQUEST");
    let response: unknown;
    try { response = await this.orderClient.lookupRefund(refundId); } catch { throw new PaymentGatewayError("PROVIDER_UNAVAILABLE"); }
    if (!isRecord(response) || response.id !== refundId || !["COMPLETED", "PENDING", "FAILED", "CANCELLED"].includes(String(response.status)) || !isRecord(response.amount) || typeof response.amount.value !== "string" || typeof response.amount.currency_code !== "string" || typeof response.invoice_id !== "string" || !/^[0-9a-f-]{36}$/iu.test(response.invoice_id)) throw new PaymentGatewayError("INVALID_EVENT");
    const occurredAt = typeof response.update_time === "string" ? response.update_time : response.create_time;
    if (typeof occurredAt !== "string" || Number.isNaN(Date.parse(occurredAt))) throw new PaymentGatewayError("INVALID_EVENT");
    const captureId = refundCaptureParent(response);
    if (!captureId) throw new PaymentGatewayError("INVALID_EVENT");
    assertGatewayCurrency(this.code, response.amount.currency_code);
    if (!this.config.allowedCurrencies.has(response.amount.currency_code)) throw new PaymentGatewayError("INVALID_CURRENCY");
    return { refundId, captureId, invoiceId: response.invoice_id, amountMinor: decimalToMinor(response.amount.value), currency: response.amount.currency_code, status: response.status as VerifiedRefundLookup["status"], verificationMethod: "API_OAUTH2_TLS", occurredAt, responseHash: await sha256Hex(JSON.stringify(response)) };
  }

  async requestRefund(request: PaymentRefundRequest): Promise<{ refundId: string; status: "PENDING_WEBHOOK" }> {
    if (!/^[A-Z0-9-]{8,200}$/u.test(request.captureId) || !/^[0-9a-f-]{36}$/iu.test(request.idempotencyKey)) throw new PaymentGatewayError("INVALID_REQUEST");
    assertMinorAmount(request.amountMinor);
    assertGatewayCurrency(this.code, request.currency);
    if (!this.config.allowedCurrencies.has(request.currency)) throw new PaymentGatewayError("INVALID_CURRENCY");
    if (!this.orderClient.refundCapture) throw new PaymentGatewayError("CONFIGURATION_INVALID");
    let response: unknown;
    try { response = await this.orderClient.refundCapture({ captureId: request.captureId, requestId: request.idempotencyKey, amount: minorToDecimal(request.amountMinor), currency: request.currency }); }
    catch { throw new PaymentGatewayError("PROVIDER_UNAVAILABLE"); }
    if (!isRecord(response) || typeof response.id !== "string" || !/^[A-Z0-9-]{8,200}$/u.test(response.id) || !["PENDING", "COMPLETED"].includes(String(response.status)) || !isRecord(response.amount) || response.amount.value !== minorToDecimal(request.amountMinor) || response.amount.currency_code !== request.currency) throw new PaymentGatewayError("PROVIDER_UNAVAILABLE");
    return { refundId: response.id, status: "PENDING_WEBHOOK" };
  }

  async verifyWebhook(
    rawBody: Uint8Array,
    headers: Readonly<Record<string, string | undefined>>,
    receivedAt = new Date(),
  ): Promise<VerifiedPaymentEvent> {
    const transmissionId = header(headers, "paypal-transmission-id", 50);
    const transmissionTime = header(headers, "paypal-transmission-time", 100);
    const transmissionSignature = header(headers, "paypal-transmission-sig", 500);
    const certificateUrl = header(headers, "paypal-cert-url", 500);
    const algorithm = header(headers, "paypal-auth-algo", 100);
    const sentAt = Date.parse(transmissionTime);
    if (
      algorithm !== "SHA256withRSA" ||
      certificateUrl !== this.certificateUrl ||
      Number.isNaN(sentAt) ||
      Number.isNaN(receivedAt.getTime()) ||
      Math.abs(receivedAt.getTime() - sentAt) > 300_000
    ) {
      throw new PaymentGatewayError("INVALID_SIGNATURE");
    }
    const signedMessage = `${transmissionId}|${transmissionTime}|${this.config.webhookId}|${crc32(rawBody)}`;
    let verified = false;
    try {
      const verifier = createVerify("RSA-SHA256");
      verifier.update(signedMessage, "utf8");
      verifier.end();
      verified = verifier.verify(createPublicKey(this.config.certificatePem), transmissionSignature, "base64");
    } catch {
      throw new PaymentGatewayError("INVALID_SIGNATURE");
    }
    if (!verified) throw new PaymentGatewayError("INVALID_SIGNATURE");
    const adjustment = parseAdjustmentEvent(rawBody);
    if (adjustment) {
      assertGatewayCurrency(this.code, adjustment.currency);
      return { ...adjustment, providerEnvironment:this.providerEnvironment,gateway: this.code, payloadHash: await sha256Hex(rawBody), signatureFingerprint: await sha256Hex(transmissionSignature) };
    }
    const event = parseCaptureEvent(rawBody);
    assertGatewayCurrency(this.code, event.currency);
    return {
      gateway: this.code,
      providerEnvironment:this.providerEnvironment,
      providerEventId: event.eventId,
      providerIntentId: event.orderId,
      eventType: "PAYMENT_SUCCEEDED",
      amountMinor: decimalToMinor(event.amount),
      currency: event.currency,
      paidAt: event.paidAt,
      paymentReference: event.captureId,
      payloadHash: await sha256Hex(rawBody),
      signatureFingerprint: await sha256Hex(transmissionSignature),
    };
  }
}

export class FetchPayPalOrderClient implements PayPalOrderClient {
  private readonly baseUrl: string;

  constructor(
    environment: "sandbox" | "live",
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly timeoutMilliseconds = 10_000,
  ) {
    if (clientId.length < 8 || clientSecret.length < 8 || timeoutMilliseconds < 1_000 || timeoutMilliseconds > 30_000) {
      throw new PaymentGatewayError("CONFIGURATION_INVALID");
    }
    this.baseUrl = environment === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  }

  async createOrder(input: { requestId: string; invoiceId: string; amount: string; currency: string; returnUrl: string }): Promise<unknown> {
    const tokenResponse = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`, "utf8").toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(this.timeoutMilliseconds),
      cache: "no-store",
    });
    if (!tokenResponse.ok) throw new PaymentGatewayError("PROVIDER_UNAVAILABLE");
    const tokenBody: unknown = await tokenResponse.json();
    const accessToken = isRecord(tokenBody) && typeof tokenBody.access_token === "string" ? tokenBody.access_token : null;
    if (!accessToken || accessToken.length > 4_096) throw new PaymentGatewayError("PROVIDER_UNAVAILABLE");
    const orderResponse = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        "paypal-request-id": input.requestId,
        prefer: "return=representation",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{ invoice_id: input.invoiceId, amount: { currency_code: input.currency, value: input.amount } }],
        payment_source: { paypal: { experience_context: { return_url: input.returnUrl, cancel_url: input.returnUrl, user_action: "PAY_NOW" } } },
      }),
      signal: AbortSignal.timeout(this.timeoutMilliseconds),
      cache: "no-store",
    });
    if (!orderResponse.ok) throw new PaymentGatewayError("PROVIDER_UNAVAILABLE");
    return orderResponse.json();
  }

  async captureOrder(input: { orderId: string; requestId: string }): Promise<unknown> {
    const accessToken = await this.requestAccessToken();
    const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${encodeURIComponent(input.orderId)}/capture`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        "paypal-request-id": input.requestId,
        prefer: "return=representation",
      },
      body: "{}",
      signal: AbortSignal.timeout(this.timeoutMilliseconds),
      cache: "no-store",
    });
    if (!response.ok) throw new PaymentGatewayError("PROVIDER_UNAVAILABLE");
    return response.json();
  }

  async lookupOrder(orderId: string): Promise<unknown> {
    if (!/^[A-Z0-9-]{8,200}$/u.test(orderId)) throw new PaymentGatewayError("INVALID_REQUEST");
    const token = await this.requestAccessToken();
    const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
      headers:{authorization:`Bearer ${token}`}, signal:AbortSignal.timeout(this.timeoutMilliseconds), cache:"no-store", redirect:"error",
    });
    if (!response.ok || !response.body) throw new PaymentGatewayError("PROVIDER_UNAVAILABLE");
    const reader = response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
    try {
      for (;;) {const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>262_144){await reader.cancel();throw new PaymentGatewayError("PROVIDER_UNAVAILABLE");}chunks.push(value);}
      return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(Buffer.concat(chunks)));
    } catch {throw new PaymentGatewayError("PROVIDER_UNAVAILABLE");} finally {reader.releaseLock();}
  }

  async lookupRefund(refundId: string): Promise<unknown> {
    const token = await this.requestAccessToken();
    const response = await fetch(`${this.baseUrl}/v2/payments/refunds/${encodeURIComponent(refundId)}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(this.timeoutMilliseconds), cache: "no-store", redirect: "error" });
    if (!response.ok) throw new PaymentGatewayError("PROVIDER_UNAVAILABLE");
    return response.json();
  }

  async refundCapture(input: { captureId: string; requestId: string; amount: string; currency: string }): Promise<unknown> {
    const token = await this.requestAccessToken();
    const response = await fetch(`${this.baseUrl}/v2/payments/captures/${encodeURIComponent(input.captureId)}/refund`, {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "paypal-request-id": input.requestId, prefer: "return=representation" },
      body: JSON.stringify({ amount: { value: input.amount, currency_code: input.currency }, invoice_id: input.requestId }),
      signal: AbortSignal.timeout(this.timeoutMilliseconds), cache: "no-store", redirect: "error",
    });
    if (!response.ok) throw new PaymentGatewayError("PROVIDER_UNAVAILABLE");
    return response.json();
  }

  private async requestAccessToken(): Promise<string> {
    const tokenResponse = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`, "utf8").toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(this.timeoutMilliseconds),
      cache: "no-store",
    });
    if (!tokenResponse.ok) throw new PaymentGatewayError("PROVIDER_UNAVAILABLE");
    const tokenBody: unknown = await tokenResponse.json();
    const accessToken = isRecord(tokenBody) && typeof tokenBody.access_token === "string" ? tokenBody.access_token : null;
    if (!accessToken || accessToken.length > 4_096) throw new PaymentGatewayError("PROVIDER_UNAVAILABLE");
    return accessToken;
  }
}

function parseOrder(value: unknown): { id: string; approvalUrl: string } {
  if (!isRecord(value) || typeof value.id !== "string" || value.id.length < 8 || value.id.length > 200 || !Array.isArray(value.links)) {
    throw new PaymentGatewayError("PROVIDER_UNAVAILABLE");
  }
  const approval = value.links.find((link) => isRecord(link) && link.rel === "approve" && typeof link.href === "string");
  if (!isRecord(approval) || typeof approval.href !== "string") throw new PaymentGatewayError("PROVIDER_UNAVAILABLE");
  let url: URL;
  try {
    url = new URL(approval.href);
  } catch {
    throw new PaymentGatewayError("PROVIDER_UNAVAILABLE");
  }
  if (url.protocol !== "https:" || !isPayPalApprovalHost(url.hostname)) throw new PaymentGatewayError("PROVIDER_UNAVAILABLE");
  return { id: value.id, approvalUrl: url.toString() };
}

function parseCaptureEvent(rawBody: Uint8Array): { eventId: string; orderId: string; captureId: string; amount: string; currency: string; paidAt: string } {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody));
  } catch {
    throw new PaymentGatewayError("INVALID_EVENT");
  }
  if (!isRecord(value) || value.event_type !== "PAYMENT.CAPTURE.COMPLETED" || typeof value.id !== "string" || !isRecord(value.resource)) {
    throw new PaymentGatewayError("UNSUPPORTED_EVENT");
  }
  const resource = value.resource;
  const amount = isRecord(resource.amount) ? resource.amount : null;
  const supplementary = isRecord(resource.supplementary_data) ? resource.supplementary_data : null;
  const relatedIds = supplementary && isRecord(supplementary.related_ids) ? supplementary.related_ids : null;
  const paidAt = typeof resource.create_time === "string" ? resource.create_time : value.create_time;
  if (
    value.id.length < 8 || value.id.length > 200 ||
    resource.status !== "COMPLETED" || typeof resource.id !== "string" || resource.id.length < 8 || resource.id.length > 200 ||
    !amount || typeof amount.value !== "string" || typeof amount.currency_code !== "string" || !/^[A-Z]{3}$/u.test(amount.currency_code) ||
    !relatedIds || typeof relatedIds.order_id !== "string" || relatedIds.order_id.length < 8 || relatedIds.order_id.length > 200 ||
    typeof paidAt !== "string" || Number.isNaN(Date.parse(paidAt))
  ) {
    throw new PaymentGatewayError("INVALID_EVENT");
  }
  return { eventId: value.id, orderId: relatedIds.order_id, captureId: resource.id, amount: amount.value, currency: amount.currency_code, paidAt };
}

function refundCaptureParent(resource: Record<string, unknown>): string | null {
  if (!Array.isArray(resource.links)) return null;
  for (const link of resource.links) {
    if (!isRecord(link) || link.rel !== "up" || typeof link.href !== "string") continue;
    try { const url = new URL(link.href); if (url.protocol === "https:" && isPayPalApiHost(url.hostname) && !url.username && !url.password && !url.search && !url.hash) return /^\/v2\/payments\/captures\/([A-Z0-9-]{8,200})$/u.exec(url.pathname)?.[1] ?? null; } catch { return null; }
  }
  return null;
}

function parseAdjustmentEvent(rawBody: Uint8Array): Omit<VerifiedPaymentAdjustmentEvent, "gateway" | "providerEnvironment" | "payloadHash" | "signatureFingerprint"> | null {
  let value: unknown;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody)); } catch { throw new PaymentGatewayError("INVALID_EVENT"); }
  if (!isRecord(value) || typeof value.event_type !== "string") throw new PaymentGatewayError("INVALID_EVENT");
  if (!["PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REVERSED", "CUSTOMER.DISPUTE.CREATED", "CUSTOMER.DISPUTE.RESOLVED"].includes(value.event_type)) return null;
  if (typeof value.id !== "string" || value.id.length < 8 || value.id.length > 200 || !isRecord(value.resource)) throw new PaymentGatewayError("INVALID_EVENT");
  const resource = value.resource;
  const occurredAt = value.create_time;
  let eventType: VerifiedPaymentAdjustmentEvent["eventType"], captureId: unknown, amount: unknown;
  if (value.event_type.startsWith("CUSTOMER.DISPUTE.")) {
    const transactions = resource.disputed_transactions;
    if (!Array.isArray(transactions) || transactions.length !== 1 || !isRecord(transactions[0])) throw new PaymentGatewayError("UNSUPPORTED_EVENT");
    captureId = transactions[0].seller_transaction_id;
    amount = resource.dispute_amount;
    if (value.event_type === "CUSTOMER.DISPUTE.CREATED") eventType = "DISPUTE_OPENED";
    else {
      const outcome = isRecord(resource.dispute_outcome) ? resource.dispute_outcome.outcome_code : null;
      if (outcome === "RESOLVED_SELLER_FAVOUR") eventType = "DISPUTE_WON";
      else if (outcome === "RESOLVED_BUYER_FAVOUR") eventType = "DISPUTE_LOST";
      else throw new PaymentGatewayError("UNSUPPORTED_EVENT");
    }
  } else {
    eventType = value.event_type === "PAYMENT.CAPTURE.REFUNDED" ? "REFUND_SUCCEEDED" : "PAYMENT_REVERSED";
    amount = resource.amount;
    if (eventType === "REFUND_SUCCEEDED") {
      if (resource.status !== "COMPLETED") throw new PaymentGatewayError("INVALID_EVENT");
      const supplementary = isRecord(resource.supplementary_data) ? resource.supplementary_data : null;
      captureId = supplementary && isRecord(supplementary.related_ids) ? supplementary.related_ids.capture_id : null;
      if (!captureId && Array.isArray(resource.links)) {
        const parent = resource.links.find(link => isRecord(link) && link.rel === "up" && typeof link.href === "string");
        if (isRecord(parent) && typeof parent.href === "string") {
          const url = new URL(parent.href);
          if (url.protocol === "https:" && isPayPalApiHost(url.hostname) && !url.search && !url.hash) captureId = /^\/v2\/payments\/captures\/([A-Z0-9-]{8,200})$/u.exec(url.pathname)?.[1];
        }
      }
    } else captureId = resource.id;
  }
  if (typeof captureId !== "string" || !/^[A-Z0-9-]{8,200}$/u.test(captureId) || typeof resource.id !== "string" || !/^[A-Za-z0-9-]{8,200}$/u.test(resource.id) || !isRecord(amount) || typeof amount.value !== "string" || typeof amount.currency_code !== "string" || !/^[A-Z]{3}$/u.test(amount.currency_code) || typeof occurredAt !== "string" || Number.isNaN(Date.parse(occurredAt))) throw new PaymentGatewayError("INVALID_EVENT");
  return { providerEventId: value.id, eventType, providerPaymentId: captureId, providerAdjustmentId: resource.id, ...(eventType === "REFUND_SUCCEEDED" && typeof resource.invoice_id === "string" && /^[0-9a-f-]{36}$/iu.test(resource.invoice_id) ? { merchantReference: resource.invoice_id } : {}), amountMinor: decimalToMinor(amount.value), currency: amount.currency_code, occurredAt };
}

function header(headers: Readonly<Record<string, string | undefined>>, name: string, maximum: number): string {
  const value = headers[name];
  if (!value || value.length > maximum) throw new PaymentGatewayError("INVALID_SIGNATURE");
  return value;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function isPayPalApiHost(hostname: string): boolean {
  return hostname === "api-m.paypal.com" || hostname === "api-m.sandbox.paypal.com";
}

function isPayPalApprovalHost(hostname: string): boolean {
  return hostname === "paypal.com" || hostname.endsWith(".paypal.com");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Keep historical subscription references stable; packs have their own native order namespace.
async function paypalInvoiceDigest(request: PaymentIntentRequest): Promise<string> {
  return sha256Hex(request.purchaseKind === "CREDIT_PACK"
    ? `paypal:credit-pack:${request.organizationId}:${request.packVersionId}:${request.idempotencyKey}`
    : `paypal:${request.organizationId}:${request.planVersionId}:${request.idempotencyKey}`);
}

import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { CmiPaymentGateway } from "./cmi-gateway";
import { PaymentGatewayError, type PaymentIntentRequest } from "./contracts";
import { createPaymentGateway } from "./gateway-factory";
import { FetchPayPalOrderClient, PayPalPaymentGateway } from "./paypal-gateway";

const request: PaymentIntentRequest = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  planVersionId: "22222222-2222-4222-8222-222222222222",
  billingInterval: "MONTHLY",
  amountMinor: "12345",
  currency: "MAD",
  idempotencyKey: "33333333-3333-4333-8333-333333333333",
  returnUrl: "https://app.matricia.test/fr/client/abonnement?payment=pending",
};

describe("CmiPaymentGateway", () => {
  const gateway = new CmiPaymentGateway({
    gatewayUrl: "https://testpayment.cmi.co.ma/fim/est3Dgate",
    allowedGatewayHosts: new Set(["testpayment.cmi.co.ma"]),
    merchantId: "merchant-test",
    storeKey: "store-key-long-enough",
  });

  it("produit une requête signée déterministe sans exposer la clé", async () => {
    const first = await gateway.createIntent(request);
    const second = await gateway.createIntent(request);
    expect(first.providerIntentId).toBe(second.providerIntentId);
    expect(first.providerEnvironment).toBe("SANDBOX");
    expect(first.confirmation?.method).toBe("POST");
    expect(JSON.stringify(first)).not.toContain("store-key-long-enough");
  });

  it("accepte un callback signé et rejette sa modification", async () => {
    const intent = await gateway.createIntent(request);
    const values: Record<string, string> = {
      oid: intent.providerIntentId,
      TransId: "transaction-12345",
      amount: "123.45",
      currency: "504",
      Response: "Approved",
      ProcReturnCode: "00",
      mdStatus: "1",
      AuthCode: "auth-12345",
    };
    const names = Object.keys(values);
    const hashParamsValue = names.map((name) => values[name]).join("");
    const hash = createHash("sha1").update(`${hashParamsValue}store-key-long-enough`, "utf8").digest("base64");
    const body = new URLSearchParams({ ...values, HASHPARAMS: `${names.join(":")}:`, HASHPARAMSVAL: hashParamsValue, HASH: hash });
    const raw = new TextEncoder().encode(body.toString());
    const event = await gateway.verifyWebhook(raw, {}, new Date("2026-09-12T12:00:00Z"));
    expect(event).toMatchObject({ gateway: "CMI", amountMinor: "12345", currency: "MAD", providerEventId: "transaction-12345" });
    body.set("amount", "999.99");
    await expect(gateway.verifyWebhook(new TextEncoder().encode(body.toString()), {})).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
  });
});

describe("PayPalPaymentGateway", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const certificatePem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const certificateUrl = "https://api-m.sandbox.paypal.com/v1/notifications/certs/CERT-test";
  const client = {
    createOrder: vi.fn(async () => ({ id: "ORDER-12345678", links: [{ rel: "approve", href: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-12345678" }] })),
    captureOrder: vi.fn(async () => ({ id: "ORDER-12345678", status: "COMPLETED" })),
  };
  const gateway = new PayPalPaymentGateway(client, { webhookId: "WEBHOOK123", certificateUrl, certificatePem, allowedCurrencies: new Set(["EUR"]) });

  it("transmet montant exact et clé d’idempotence au port Orders", async () => {
    const intent = await gateway.createIntent({ ...request, currency: "EUR" });
    expect(intent.providerIntentId).toBe("ORDER-12345678");
    expect(client.createOrder).toHaveBeenCalledWith(expect.objectContaining({ amount: "123.45", requestId: request.idempotencyKey }));
  });

  it("capture avec une clé stable sans activer avant le webhook", async () => {
    const result = await gateway.requestCapture("ORDER-12345678", request.idempotencyKey);
    expect(result).toEqual({ status: "PENDING_WEBHOOK" });
    expect(client.captureOrder).toHaveBeenCalledWith({ orderId: "ORDER-12345678", requestId: request.idempotencyKey });
  });

  it("vérifie RSA sur le raw body, rejette altération et événement périmé", async () => {
    const receivedAt = new Date("2026-09-12T12:00:00Z");
    const body = new TextEncoder().encode(JSON.stringify({
      id: "EVENT-12345678", event_type: "PAYMENT.CAPTURE.COMPLETED", create_time: receivedAt.toISOString(),
      resource: { id: "CAPTURE-12345678", status: "COMPLETED", create_time: receivedAt.toISOString(), amount: { value: "123.45", currency_code: "EUR" }, supplementary_data: { related_ids: { order_id: "ORDER-12345678" } } },
    }));
    const transmissionId = "transmission-123";
    const transmissionTime = receivedAt.toISOString();
    const signature = sign("RSA-SHA256", Buffer.from(`${transmissionId}|${transmissionTime}|WEBHOOK123|${crc32(body)}`), privateKey).toString("base64");
    const headers = { "paypal-auth-algo": "SHA256withRSA", "paypal-cert-url": certificateUrl, "paypal-transmission-id": transmissionId, "paypal-transmission-sig": signature, "paypal-transmission-time": transmissionTime };
    const first = await gateway.verifyWebhook(body, headers, receivedAt);
    const replay = await gateway.verifyWebhook(body, headers, receivedAt);
    expect(replay).toEqual(first);
    expect(first.providerEnvironment).toBe("SANDBOX");
    const altered = new Uint8Array(body);
    const alteredIndex = altered.length - 2;
    altered[alteredIndex] = (altered[alteredIndex] ?? 0) ^ 1;
    await expect(gateway.verifyWebhook(altered, headers, receivedAt)).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
    await expect(gateway.verifyWebhook(body, headers, new Date(receivedAt.getTime() + 300_001))).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
  });
});

it("refuse un provider absent de l'allowlist et un mode live non autorisé", () => {
  expect(() => createPaymentGateway({ provider: "CMI", allowedProviders: new Set(["DEMO"]), liveEnabled: false })).toThrow(PaymentGatewayError);
});

it("refuse une devise à exposant non supporté", async () => {
  const gateway = new CmiPaymentGateway({ gatewayUrl: "https://testpayment.cmi.co.ma/fim/est3Dgate", allowedGatewayHosts: new Set(["testpayment.cmi.co.ma"]), merchantId: "merchant-test", storeKey: "store-key-long-enough" });
  await expect(gateway.createIntent({ ...request, currency: "JPY" })).rejects.toMatchObject({ code: "INVALID_CURRENCY" });
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}


describe("PayPal refunds and negative signed events", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const config = { webhookId: "WEBHOOK123", certificateUrl: "https://api-m.sandbox.paypal.com/v1/notifications/certs/CERT-test", certificatePem: publicKey.export({ type: "spki", format: "pem" }).toString(), allowedCurrencies: new Set(["EUR"]) };
  const refundCapture = vi.fn(async () => ({ id: "REFUND-12345678", status: "COMPLETED", amount: { value: "12.34", currency_code: "EUR" } }));
  const gateway = new PayPalPaymentGateway({ createOrder: vi.fn(), captureOrder: vi.fn(), refundCapture }, config);
  const now = new Date("2026-10-31T12:00:00Z");
  function signed(eventType: string, resource: unknown) {
    const raw = new TextEncoder().encode(JSON.stringify({ id: "EVENT-NEGATIVE-123", event_type: eventType, create_time: now.toISOString(), resource }));
    const signature = sign("RSA-SHA256", Buffer.from(`transmission-negative|${now.toISOString()}|WEBHOOK123|${crc32(raw)}`), privateKey).toString("base64");
    return { raw, headers: { "paypal-auth-algo": "SHA256withRSA", "paypal-cert-url": config.certificateUrl, "paypal-transmission-id": "transmission-negative", "paypal-transmission-sig": signature, "paypal-transmission-time": now.toISOString() } };
  }
  it("refunds an exact partial amount using a stable request ID and awaits confirmation", async () => {
    await expect(gateway.requestRefund({ captureId: "CAPTURE-12345678", amountMinor: "1234", currency: "EUR", idempotencyKey: request.idempotencyKey })).resolves.toEqual({ refundId: "REFUND-12345678", status: "PENDING_WEBHOOK" });
    expect(refundCapture).toHaveBeenCalledWith({ captureId: "CAPTURE-12345678", requestId: request.idempotencyKey, amount: "12.34", currency: "EUR" });
    await expect(gateway.requestRefund({ captureId: "CAPTURE-12345678", amountMinor: "0", currency: "EUR", idempotencyKey: request.idempotencyKey })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
  });
  it("verifies refund capture linkage from PayPal's parent link", async () => {
    const { raw, headers } = signed("PAYMENT.CAPTURE.REFUNDED", { id: "REFUND-12345678", status: "COMPLETED", amount: { value: "12.34", currency_code: "EUR" }, links: [{ rel: "up", href: "https://api-m.sandbox.paypal.com/v2/payments/captures/CAPTURE-12345678" }] });
    await expect(gateway.verifyWebhook(raw, headers, now)).resolves.toMatchObject({ eventType: "REFUND_SUCCEEDED", providerPaymentId: "CAPTURE-12345678", providerAdjustmentId: "REFUND-12345678", amountMinor: "1234" });
  });
  it("rejects an untrusted refund capture link", async () => {
    const { raw, headers } = signed("PAYMENT.CAPTURE.REFUNDED", { id: "REFUND-12345678", status: "COMPLETED", amount: { value: "12.34", currency_code: "EUR" }, links: [{ rel: "up", href: "https://attacker.example/v2/payments/captures/CAPTURE-12345678" }] });
    await expect(gateway.verifyWebhook(raw, headers, now)).rejects.toMatchObject({ code: "INVALID_EVENT" });
  });
  it.each([["CUSTOMER.DISPUTE.CREATED", undefined, "DISPUTE_OPENED"], ["CUSTOMER.DISPUTE.RESOLVED", "RESOLVED_SELLER_FAVOUR", "DISPUTE_WON"], ["CUSTOMER.DISPUTE.RESOLVED", "RESOLVED_BUYER_FAVOUR", "DISPUTE_LOST"]])("maps %s %s without treating it as a successful payment", async (type, outcome, expected) => {
    const { raw, headers } = signed(type!, { id: "DISPUTE-12345678", disputed_transactions: [{ seller_transaction_id: "CAPTURE-12345678" }], dispute_amount: { value: "12.34", currency_code: "EUR" }, dispute_outcome: { outcome_code: outcome } });
    await expect(gateway.verifyWebhook(raw, headers, now)).resolves.toMatchObject({ eventType: expected, providerPaymentId: "CAPTURE-12345678" });
  });
  it("maps a verified capture reversal independently of dispute status", async () => {
    const { raw, headers } = signed("PAYMENT.CAPTURE.REVERSED", { id: "CAPTURE-12345678", amount: { value: "123.45", currency_code: "EUR" } });
    await expect(gateway.verifyWebhook(raw, headers, now)).resolves.toMatchObject({ eventType: "PAYMENT_REVERSED", providerPaymentId: "CAPTURE-12345678" });
  });
});

it.each(["NODE_ENV", "APP_ENV"])("refuses DEMO when %s marks production", (name) => {
  vi.stubEnv(name, "production");
  try { expect(() => createPaymentGateway({ provider: "DEMO", allowedProviders: new Set(["DEMO"]), liveEnabled: true, demoWebhookSecret: "x".repeat(32) })).toThrow(PaymentGatewayError); }
  finally { vi.unstubAllEnvs(); }
});

it("uses authenticated GET for native refund lookup and verifies capture/invoice binding", async () => {
  const client = new FetchPayPalOrderClient("sandbox", "client-fixture", "secret-fixture");
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fixture = { id: "REFUND-LOOKUP-123", status: "COMPLETED", invoice_id: request.idempotencyKey, create_time: "2026-10-31T12:00:00Z", amount: { value: "12.34", currency_code: "EUR" }, links: [{ rel: "up", href: "https://api-m.sandbox.paypal.com/v2/payments/captures/CAPTURE-12345678" }] };
  const mocked = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    calls.push({ url: String(input), init }); return new Response(JSON.stringify(String(input).endsWith("/token") ? { access_token: "runtime-fixture-token" } : fixture));
  });
  try {
    const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const gateway = new PayPalPaymentGateway(client, { webhookId: "WEBHOOK123", certificateUrl: "https://api-m.sandbox.paypal.com/v1/notifications/certs/CERT-test", certificatePem: publicKey.export({ type: "spki", format: "pem" }).toString(), allowedCurrencies: new Set(["EUR"]) });
    await expect(gateway.lookupRefund("REFUND-LOOKUP-123")).resolves.toMatchObject({ refundId: fixture.id, captureId: "CAPTURE-12345678", invoiceId: request.idempotencyKey, amountMinor: "1234", verificationMethod: "API_OAUTH2_TLS", responseHash: expect.stringMatching(/^[0-9a-f]{64}$/u) });
    expect(calls[1]).toMatchObject({ url: "https://api-m.sandbox.paypal.com/v2/payments/refunds/REFUND-LOOKUP-123", init: { redirect: "error" } });
    expect(calls[1]?.init?.method ?? "GET").toBe("GET");
  } finally { mocked.mockRestore(); }
});


it("requires an explicitly enabled live gateway in production and permits staging sandbox", () => {
  const original = process.env.APP_ENV;
  const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const paypal = { environment: "sandbox" as const, clientId: "client-test", clientSecret: "secret-test", webhookId: "WEBHOOK123", certificateUrl: "https://api-m.sandbox.paypal.com/v1/notifications/certs/CERT-test", certificatePem: publicKey.export({ type: "spki", format: "pem" }).toString(), allowedCurrencies: new Set(["EUR"]) };
  const cmi = { environment: "demo" as const, gatewayUrl: "https://testpayment.cmi.co.ma/fim/est3Dgate", allowedGatewayHosts: new Set(["testpayment.cmi.co.ma"]), merchantId: "merchant-test", storeKey: "store-key-long-enough" };
  try {
    process.env.APP_ENV = " Production ";
    expect(() => createPaymentGateway({ provider: "PAYPAL", allowedProviders: new Set(["PAYPAL"]), liveEnabled: true, paypal })).toThrow(PaymentGatewayError);
    expect(() => createPaymentGateway({ provider: "CMI", allowedProviders: new Set(["CMI"]), liveEnabled: true, cmi })).toThrow(PaymentGatewayError);
    expect(() => createPaymentGateway({ provider: "PAYPAL", allowedProviders: new Set(["PAYPAL"]), liveEnabled: false, paypal: { ...paypal, environment: "live" } })).toThrow(PaymentGatewayError);
    process.env.APP_ENV = "staging";
    expect(createPaymentGateway({ provider: "PAYPAL", allowedProviders: new Set(["PAYPAL"]), liveEnabled: false, paypal })).toBeInstanceOf(PayPalPaymentGateway);
  } finally { if (original === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = original; }
});

it.each([['live','https://api-m.sandbox.paypal.com/v1/notifications/certs/CERT-test'],['sandbox','https://api-m.paypal.com/v1/notifications/certs/CERT-test']] as const)("refuses %s API configuration with a certificate from another native environment",(environment,certificateUrl)=>{
 const {publicKey}=generateKeyPairSync("rsa",{modulusLength:2048});const client={createOrder:vi.fn(),captureOrder:vi.fn()};
 expect(()=>new PayPalPaymentGateway(client,{environment,certificateUrl,certificatePem:publicKey.export({type:"spki",format:"pem"}).toString(),webhookId:"WEBHOOK123",allowedCurrencies:new Set(["EUR"])})).toThrow(PaymentGatewayError);
 expect(client.createOrder).not.toHaveBeenCalled();
});
it("does not invent a LIVE environment attestation for a CMI merchant hostname",async()=>{
 const gateway=new CmiPaymentGateway({environment:"live",gatewayUrl:"https://merchant.cmi.co.ma/fim/est3Dgate",allowedGatewayHosts:new Set(["merchant.cmi.co.ma"]),merchantId:"merchant-test",storeKey:"store-key-long-enough"});
 expect(gateway.providerEnvironment).toBe("UNVERIFIED");expect((await gateway.createIntent(request)).providerEnvironment).toBe("UNVERIFIED");
});

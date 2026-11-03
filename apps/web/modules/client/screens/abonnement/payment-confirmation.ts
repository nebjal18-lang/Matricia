export const paypalCaptureStorageKey = "matricia.paypal.capture.v1";

export type PaymentIntentResponse = {
  paymentIntentId: string;
  providerIntentId: string;
  gateway: "DEMO" | "CMI" | "PAYPAL";
  status: "REQUIRES_CONFIRMATION";
  confirmation: null | { method: "GET"; url: string } | { method: "POST"; url: string; fields: Record<string, string> };
};

export function parsePaymentIntent(value: unknown): PaymentIntentResponse | null {
  if (!isRecord(value) || typeof value.paymentIntentId !== "string" || typeof value.providerIntentId !== "string"
    || !["DEMO", "CMI", "PAYPAL"].includes(String(value.gateway)) || value.status !== "REQUIRES_CONFIRMATION") return null;
  if (value.confirmation === null) return value.gateway === "DEMO" ? value as PaymentIntentResponse : null;
  if (!isRecord(value.confirmation) || typeof value.confirmation.url !== "string") return null;
  if (!isSafeProviderUrl(value.confirmation.url)) return null;
  if (value.confirmation.method === "GET") return value.gateway === "PAYPAL" ? value as PaymentIntentResponse : null;
  if (value.gateway !== "CMI" || value.confirmation.method !== "POST" || !isRecord(value.confirmation.fields)
    || Object.entries(value.confirmation.fields).some(([key, field]) => !/^[A-Za-z0-9_.-]{1,80}$/u.test(key) || typeof field !== "string" || field.length > 4_096)) return null;
  return value as PaymentIntentResponse;
}

export function parsePayPalCaptureReturn(search: string, stored: string | null, organizationId?: string): { paymentIntentId: string } | null {
  if (!stored) return null;
  const parameters = new URLSearchParams(search);
  if (parameters.get("payment") !== "pending" || !parameters.get("PayerID")) return null;
  try {
    const value: unknown = JSON.parse(stored);
    if (!isRecord(value) || typeof value.paymentIntentId !== "string" || typeof value.providerIntentId !== "string"
      || (organizationId !== undefined && value.organizationId !== organizationId) || parameters.get("token") !== value.providerIntentId) return null;
    return { paymentIntentId: value.paymentIntentId };
  } catch {
    return null;
  }
}

function isSafeProviderUrl(value: string): boolean {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type PaymentCaptureStatus="CONFIRMED"|"PENDING_WEBHOOK"|"PENDING_NATIVE_REVIEW";
export function parsePaymentCapture(value:unknown,paymentIntentId:string):PaymentCaptureStatus|null{if(!isRecord(value)||value.paymentIntentId!==paymentIntentId||!["CONFIRMED","PENDING_WEBHOOK","PENDING_NATIVE_REVIEW"].includes(String(value.status)))return null;return value.status as PaymentCaptureStatus;}
const reconciliationErrors=new Set(["SUBSCRIPTION_CHECKOUT_ALREADY_PENDING","SUBSCRIPTION_CHECKOUT_RECONCILIATION_REQUIRED","SUBSCRIPTION_LEGACY_CHECKOUT_RECONCILIATION_REQUIRED","PAYMENT_CREATION_RECONCILIATION_REQUIRED","PAYMENT_NATIVE_REVIEW_REQUIRED","PAYMENT_NATIVE_REVIEW_UNAVAILABLE","PAYMENT_PROVIDER_UNAVAILABLE","PAYMENT_INTENT_UNAVAILABLE","PAYMENT_PROVIDER_CONTEXT_MISMATCH","PAYMENT_REQUEST_REJECTED"]);
export function paymentNeedsReconciliation(value:unknown){return isRecord(value)&&typeof value.error==="string"&&reconciliationErrors.has(value.error);}

export function parseConfirmedPayment(value:unknown):string|null{return isRecord(value)&&value.status==="CONFIRMED"&&typeof value.paymentIntentId==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(value.paymentIntentId)?value.paymentIntentId:null;}

export function paymentRequiresMfa(value:unknown){return isRecord(value)&&value.error==="PAYMENT_CUSTOMER_MFA_REQUIRED";}

import { PaymentGatewayError, type PaymentGatewayCode, type VerifiedPaymentEvent } from "./contracts";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const allowedGateways = new Set<PaymentGatewayCode>(["DEMO","CMI","PAYPAL"]);

export async function sha256Hex(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", asArrayBuffer(bytes))));
}

export async function signWebhook(rawBody: Uint8Array, secret: string) {
  if (secret.length < 32) throw new PaymentGatewayError("INVALID_REQUEST");
  const key = await crypto.subtle.importKey("raw",asArrayBuffer(encoder.encode(secret)),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return `v1=${hex(new Uint8Array(await crypto.subtle.sign("HMAC",key,asArrayBuffer(rawBody))))}`;
}

export async function verifyPaymentWebhook(rawBody: Uint8Array, signatureHeader: string, secret: string, expectedGateway: PaymentGatewayCode): Promise<VerifiedPaymentEvent> {
  const supplied = signatureHeader.match(/^v1=([0-9a-f]{64})$/i)?.[1]?.toLowerCase();
  if (!supplied) throw new PaymentGatewayError("INVALID_SIGNATURE");
  const expected = (await signWebhook(rawBody,secret)).slice(3);
  if (!constantTimeEqual(supplied,expected)) throw new PaymentGatewayError("INVALID_SIGNATURE");
  let value: unknown;
  try { value=JSON.parse(decoder.decode(rawBody)); } catch { throw new PaymentGatewayError("INVALID_EVENT"); }
  if (!isRecord(value)||value.gateway!==expectedGateway||!allowedGateways.has(value.gateway as PaymentGatewayCode)) throw new PaymentGatewayError("INVALID_EVENT");
  if (value.eventType!=="PAYMENT_SUCCEEDED") throw new PaymentGatewayError("UNSUPPORTED_EVENT");
  const fields=[value.providerEventId,value.providerIntentId,value.amountMinor,value.currency,value.paidAt,value.paymentReference];
  if(!fields.every((field)=>typeof field==="string")||!inRange(value.providerEventId,8,200)||!inRange(value.providerIntentId,8,200)||!inRange(value.paymentReference,3,200)||!/^(?:0|[1-9]\d*)$/.test(value.amountMinor as string)||BigInt(value.amountMinor as string)>BigInt("9223372036854775807")||!/^[A-Z]{3}$/.test(value.currency as string)||Number.isNaN(Date.parse(value.paidAt as string)))throw new PaymentGatewayError("INVALID_EVENT");
  return { providerEnvironment:expectedGateway === "DEMO" ? "DEMO" : "UNVERIFIED",gateway:value.gateway as PaymentGatewayCode, providerEventId:value.providerEventId as string, providerIntentId:value.providerIntentId as string, eventType:"PAYMENT_SUCCEEDED", amountMinor:value.amountMinor as string, currency:value.currency as string, paidAt:value.paidAt as string, paymentReference:value.paymentReference as string, payloadHash:await sha256Hex(rawBody), signatureFingerprint:await sha256Hex(signatureHeader) };
}

function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==="object"&&value!==null&&!Array.isArray(value)}
function hex(bytes:Uint8Array){return [...bytes].map((byte)=>byte.toString(16).padStart(2,"0")).join("")}
function constantTimeEqual(left:string,right:string){if(left.length!==right.length)return false;let difference=0;for(let index=0;index<left.length;index+=1)difference|=left.charCodeAt(index)^right.charCodeAt(index);return difference===0}
function asArrayBuffer(value:Uint8Array):ArrayBuffer{return Uint8Array.from(value).buffer}
function inRange(value:unknown,min:number,max:number):value is string{return typeof value==="string"&&value.length>=min&&value.length<=max}

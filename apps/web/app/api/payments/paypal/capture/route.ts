import { createPaymentGateway, PaymentGatewayError } from "@matricia/infrastructure";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPaymentRuntimeConfig, getServerEnvironment } from "@/modules/shared/lib/env";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

const inputSchema = z.object({ paymentIntentId: z.string().uuid() }).strict();
const preparedSchema = z.object({ provider_intent_id: z.string().min(8).max(200), replayed: z.boolean(), capture_authorized:z.boolean().optional(), activation_result:z.object({outcome:z.literal("SUBSCRIPTION_ACTIVATED"),payment_intent_id:z.string().uuid()}).passthrough().optional() }).passthrough();
const maximumBodyBytes = 8_192;

export async function POST(request: Request) {
  let gateway: ReturnType<typeof createPaymentGateway>;
  let appUrl: string;
  try {
    gateway = createPaymentGateway(getPaymentRuntimeConfig());
    appUrl = getServerEnvironment().NEXT_PUBLIC_APP_URL;
  } catch {
    return NextResponse.json({ error: "PAYMENT_CONFIGURATION_UNAVAILABLE" }, { status: 503 });
  }
  if (gateway.code !== "PAYPAL") return NextResponse.json({ error: "PAYMENT_PROVIDER_DISABLED" }, { status: 404 });
  if (!sameOrigin(request, appUrl)) return NextResponse.json({ error: "REQUEST_ORIGIN_DENIED" }, { status: 403 });
  const length = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isSafeInteger(length) || length > maximumBodyBytes) return NextResponse.json({ error: "REQUEST_TOO_LARGE" }, { status: 413 });
  let input: z.infer<typeof inputSchema>;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > maximumBodyBytes) return NextResponse.json({ error: "REQUEST_TOO_LARGE" }, { status: 413 });
    input = inputSchema.parse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { data, error } = await client.rpc("prepare_subscription_payment_capture_v2", { p_payment_intent_id: input.paymentIntentId,p_provider_environment:gateway.providerEnvironment });
  if (error) return NextResponse.json({ error: error.message==="PAYMENT_CUSTOMER_MFA_REQUIRED"?"PAYMENT_CUSTOMER_MFA_REQUIRED":error.code === "42501" ? "FORBIDDEN" : ["SUBSCRIPTION_NOT_ACTIVATABLE","SUBSCRIPTION_FINANCIAL_HOLD","CLIENT_IDENTITY_REVIEW_REQUIRED"].includes(error.message)?error.message:"PAYMENT_CAPTURE_REJECTED" }, { status: error.code === "42501" ? 403 : 409 });
  const prepared = preparedSchema.safeParse(data);
  if (!prepared.success) return NextResponse.json({ error: "PAYMENT_CAPTURE_REJECTED" }, { status: 409 });
  if(prepared.data.replayed){
    if(prepared.data.activation_result?.payment_intent_id!==input.paymentIntentId)return NextResponse.json({error:"PAYMENT_CAPTURE_REJECTED"},{status:409});
    return NextResponse.json({paymentIntentId:input.paymentIntentId,status:"CONFIRMED"},{status:200});
  }
  if(prepared.data.capture_authorized!==true)return NextResponse.json({paymentIntentId:input.paymentIntentId,status:"PENDING_NATIVE_REVIEW"},{status:202});
  try {
    const result = await gateway.requestCapture(prepared.data.provider_intent_id, input.paymentIntentId);
    return NextResponse.json({ paymentIntentId: input.paymentIntentId, status: result.status }, { status: 202 });
  } catch (captureError) {
    const unavailable = captureError instanceof PaymentGatewayError && captureError.code === "PROVIDER_UNAVAILABLE";
    return NextResponse.json({ error: unavailable ? "PAYMENT_PROVIDER_UNAVAILABLE" : "PAYMENT_CAPTURE_REJECTED" }, { status: unavailable ? 502 : 422 });
  }
}

function sameOrigin(request: Request, appUrl: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(appUrl).origin; } catch { return false; }
}

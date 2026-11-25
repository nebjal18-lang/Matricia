import { getPlatformRuntimeEnvironment } from "@/modules/shared/lib/platform-configuration/runtime";
import { createPaymentGateway } from "@matricia/infrastructure";
import { NextResponse } from "next/server";
import { getPaymentRuntimeConfig } from "@/modules/shared/lib/env";
import { processPaymentWebhook } from "../_shared";

export async function POST(request: Request) {
  try {
    const gateway = createPaymentGateway(getPaymentRuntimeConfig(await getPlatformRuntimeEnvironment(process.env, ["PAYPAL"])));
    if (gateway.code !== "PAYPAL") return NextResponse.json({ error: "PAYMENT_PROVIDER_DISABLED" }, { status: 404 });
    return processPaymentWebhook(request, gateway, {
      "paypal-auth-algo": request.headers.get("paypal-auth-algo") ?? undefined,
      "paypal-cert-url": request.headers.get("paypal-cert-url") ?? undefined,
      "paypal-transmission-id": request.headers.get("paypal-transmission-id") ?? undefined,
      "paypal-transmission-sig": request.headers.get("paypal-transmission-sig") ?? undefined,
      "paypal-transmission-time": request.headers.get("paypal-transmission-time") ?? undefined,
    }, "application/json");
  } catch {
    return NextResponse.json({ error: "PAYMENT_CONFIGURATION_UNAVAILABLE" }, { status: 503 });
  }
}

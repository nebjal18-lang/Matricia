import { getPlatformRuntimeEnvironment } from "@/modules/shared/lib/platform-configuration/runtime";
import { createPaymentGateway } from "@matricia/infrastructure";
import { NextResponse } from "next/server";
import { getPaymentRuntimeConfig } from "@/modules/shared/lib/env";
import { processPaymentWebhook } from "../_shared";

export async function POST(request: Request) {
  try {
    const gateway = createPaymentGateway(getPaymentRuntimeConfig(await getPlatformRuntimeEnvironment()));
    if (gateway.code !== "DEMO") return NextResponse.json({ error: "PAYMENT_PROVIDER_DISABLED" }, { status: 404 });
    return processPaymentWebhook(request, gateway, {
      "x-matricia-signature": request.headers.get("x-matricia-signature") ?? undefined,
    }, "application/json");
  } catch {
    return NextResponse.json({ error: "PAYMENT_CONFIGURATION_UNAVAILABLE" }, { status: 503 });
  }
}

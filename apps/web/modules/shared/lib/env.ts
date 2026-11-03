import { z } from "zod";
import type { PaymentGatewayCode, PaymentRuntimeConfig } from "@matricia/infrastructure";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const serverEnvironmentSchema = publicEnvironmentSchema.extend({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

export function getPublicEnvironment() {
  return publicEnvironmentSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

export function getServerEnvironment() {
  return serverEnvironmentSchema.parse({
    ...getPublicEnvironment(),
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}

export function getDemoPaymentWebhookSecret() {
  return z.string().min(32).parse(process.env.PAYMENT_WEBHOOK_SECRET_DEMO);
}

export function getPaymentRuntimeConfig(): PaymentRuntimeConfig {
  const provider = z.enum(["DEMO", "CMI", "PAYPAL"]).parse(process.env.PAYMENT_PROVIDER?.toUpperCase());
  const allowedProviders = parseEnumSet(process.env.PAYMENT_PROVIDER_ALLOWLIST, ["DEMO", "CMI", "PAYPAL"] as const);
  const liveEnabled = process.env.PAYMENT_LIVE_ENABLED === "true";
  if (provider === "DEMO") {
    if (process.env.NODE_ENV === "production" || process.env.APP_ENV?.trim().toLowerCase() === "production") throw new Error("PAYMENT_DEMO_FORBIDDEN");
    return { provider, allowedProviders, liveEnabled, demoWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET_DEMO };
  }
  if (provider === "CMI") {
    return {
      provider,
      allowedProviders,
      liveEnabled,
      cmi: {
        environment: z.enum(["demo", "live"]).parse(process.env.CMI_ENV),
        gatewayUrl: z.string().url().parse(process.env.CMI_GATEWAY_URL),
        allowedGatewayHosts: parseHostSet(process.env.CMI_GATEWAY_ALLOWED_HOSTS),
        merchantId: z.string().min(3).max(64).parse(process.env.CMI_MERCHANT_ID),
        storeKey: z.string().min(16).parse(process.env.CMI_STORE_KEY),
      },
    };
  }
  return {
    provider,
    allowedProviders,
    liveEnabled,
    paypal: {
      environment: z.enum(["sandbox", "live"]).parse(process.env.PAYPAL_ENV),
      clientId: z.string().min(8).parse(process.env.PAYPAL_CLIENT_ID),
      clientSecret: z.string().min(8).parse(process.env.PAYPAL_CLIENT_SECRET),
      webhookId: z.string().min(6).max(50).parse(process.env.PAYPAL_WEBHOOK_ID),
      certificateUrl: z.string().url().parse(process.env.PAYPAL_WEBHOOK_CERT_URL),
      certificatePem: decodeCertificate(process.env.PAYPAL_WEBHOOK_CERTIFICATE_PEM_BASE64),
      allowedCurrencies: parseCurrencySet(process.env.PAYPAL_ALLOWED_CURRENCIES),
    },
  };
}

function parseEnumSet<const T extends readonly PaymentGatewayCode[]>(value: string | undefined, allowed: T): ReadonlySet<T[number]> {
  const values = z.string().min(1).parse(value).split(",").map((item) => item.trim().toUpperCase());
  if (values.some((item) => !allowed.includes(item as T[number]))) throw new Error("PAYMENT_CONFIGURATION_INVALID");
  return new Set(values as T[number][]);
}

function parseHostSet(value: string | undefined): ReadonlySet<string> {
  const hosts = z.string().min(1).parse(value).split(",").map((item) => item.trim().toLowerCase());
  if (hosts.some((host) => !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/u.test(host))) {
    throw new Error("PAYMENT_CONFIGURATION_INVALID");
  }
  return new Set(hosts);
}

function parseCurrencySet(value: string | undefined): ReadonlySet<string> {
  const currencies = z.string().min(1).parse(value).split(",").map((item) => item.trim().toUpperCase());
  if (currencies.some((currency) => !/^[A-Z]{3}$/u.test(currency))) throw new Error("PAYMENT_CONFIGURATION_INVALID");
  return new Set(currencies);
}

function decodeCertificate(value: string | undefined): string {
  try {
    const decoded = Buffer.from(z.string().min(1).parse(value), "base64").toString("utf8");
    if (!decoded.includes("BEGIN CERTIFICATE") || decoded.length > 32_768) throw new Error("invalid");
    return decoded;
  } catch {
    throw new Error("PAYMENT_CONFIGURATION_INVALID");
  }
}

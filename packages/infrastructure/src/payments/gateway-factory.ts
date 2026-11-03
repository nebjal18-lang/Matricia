import { CmiPaymentGateway } from "./cmi-gateway";
import { PaymentGatewayError, type PaymentGatewayCode } from "./contracts";
import { DemoPaymentGateway } from "./demo-gateway";
import { FetchPayPalOrderClient, PayPalPaymentGateway } from "./paypal-gateway";

export type PaymentRuntimeConfig = {
  provider: PaymentGatewayCode;
  allowedProviders: ReadonlySet<PaymentGatewayCode>;
  liveEnabled: boolean;
  demoWebhookSecret?: string;
  cmi?: {
    environment: "demo" | "live";
    gatewayUrl: string;
    allowedGatewayHosts: ReadonlySet<string>;
    merchantId: string;
    storeKey: string;
  };
  paypal?: {
    environment: "sandbox" | "live";
    clientId: string;
    clientSecret: string;
    webhookId: string;
    certificateUrl: string;
    certificatePem: string;
    allowedCurrencies: ReadonlySet<string>;
  };
};

export function createPaymentGateway(config: PaymentRuntimeConfig) {
  assertProviderAllowed(config, config.provider);
  const appEnvironment = process.env.APP_ENV?.trim().toLowerCase();
  const production = appEnvironment === "production" || (!appEnvironment && process.env.NODE_ENV === "production");
  switch (config.provider) {
    case "DEMO":
      if (process.env.NODE_ENV === "production" || process.env.APP_ENV?.trim().toLowerCase() === "production") throw new PaymentGatewayError("CONFIGURATION_INVALID");
      return new DemoPaymentGateway(config.demoWebhookSecret);
    case "CMI": {
      if (!config.cmi || (production && (config.cmi.environment !== "live" || !config.liveEnabled)) || (config.cmi.environment === "live" && !config.liveEnabled)) {
        throw new PaymentGatewayError("CONFIGURATION_INVALID");
      }
      return new CmiPaymentGateway(config.cmi);
    }
    case "PAYPAL": {
      if (!config.paypal || (production && (config.paypal.environment !== "live" || !config.liveEnabled)) || (config.paypal.environment === "live" && !config.liveEnabled)) {
        throw new PaymentGatewayError("CONFIGURATION_INVALID");
      }
      const client = new FetchPayPalOrderClient(config.paypal.environment, config.paypal.clientId, config.paypal.clientSecret);
      return new PayPalPaymentGateway(client, config.paypal);
    }
  }
}

export function assertProviderAllowed(config: PaymentRuntimeConfig, provider: PaymentGatewayCode): void {
  if (!config.allowedProviders.has(provider)) throw new PaymentGatewayError("CONFIGURATION_INVALID");
}

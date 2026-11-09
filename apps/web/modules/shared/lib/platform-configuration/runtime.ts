import "server-only";

/** Values are scoped to one immutable, independently approved configuration.
 * The database includes historically activated sections in managedSections so
 * removing an activation can never resurrect older deployment credentials. */
export type ActiveConfigurationEnvironment = {
  environment: "DEVELOPMENT" | "STAGING" | "PRODUCTION";
  managedSections: readonly string[];
  values: Record<string, string>;
};

const sectionKeys = {
  COMPANY: ["PUBLIC_CONTACT_NOTIFICATION_EMAIL"],
  RESEND: ["RESEND_API_KEY", "RESEND_WEBHOOK_SECRET", "RESEND_FROM_EMAIL", "RESEND_FROM_NAME", "EMAIL_RECIPIENT_ALLOWLIST", "EMAIL_DELIVERY_MODE", "EMAIL_LIVE_DELIVERY_ENABLED", "EMAIL_PROVIDER_ENDPOINT", "EMAIL_PROVIDER_ENDPOINT_ALLOWLIST", "EMAIL_PROVIDER_TOKEN"],
  PAYPAL: ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_ENV", "PAYPAL_WEBHOOK_ID", "PAYPAL_WEBHOOK_CERT_URL", "PAYPAL_WEBHOOK_CERTIFICATE_PEM_BASE64", "PAYPAL_ALLOWED_CURRENCIES", "PAYMENT_PROVIDER", "PAYMENT_PROVIDER_ALLOWLIST", "PAYMENT_LIVE_ENABLED", "PAYMENT_WEBHOOK_SECRET_DEMO"],
  YOUSIGN: ["YOUSIGN_API_KEY", "YOUSIGN_WEBHOOK_SECRET", "YOUSIGN_WORKSPACE_ID", "YOUSIGN_ENVIRONMENT", "SIGNATURE_PROVIDER_MODE", "SIGNATURE_PROVIDER_CODE"],
  SCANNER: ["MALWARE_SCANNER_URL", "MALWARE_SCANNER_TOKEN", "MALWARE_SCANNER_ALLOWED_HOSTS", "DELIVERY_PROOF_SCANNER_MODE"],
} as const;
const legacyOnlyKeys = new Set(["EMAIL_PROVIDER_ENDPOINT", "EMAIL_PROVIDER_ENDPOINT_ALLOWLIST", "EMAIL_PROVIDER_TOKEN", "PAYMENT_WEBHOOK_SECRET_DEMO"]);
export type RuntimeConfigurationSection = keyof typeof sectionKeys;

/** Pure overlay: infrastructure identity and the process environment remain
 * immutable. Reject unexpected keys rather than silently accepting overposts. */
export function applyPlatformConfiguration(
  base: Record<string, string | undefined>,
  configuration: ActiveConfigurationEnvironment,
): Record<string, string | undefined> {
  const environment = base.APP_ENV?.trim().toUpperCase();
  if (!environment || environment !== configuration.environment || !["DEVELOPMENT", "STAGING", "PRODUCTION"].includes(configuration.environment)) {
    throw new Error("PLATFORM_CONFIGURATION_ENVIRONMENT_MISMATCH");
  }
  const output = { ...base };
  const allowed = new Set<string>();
  const managed = new Set(configuration.managedSections);
  for (const section of managed) {
    if (!Object.hasOwn(sectionKeys, section)) throw new Error("PLATFORM_CONFIGURATION_SECTION_INVALID");
    for (const key of sectionKeys[section as keyof typeof sectionKeys]) {
      if (!legacyOnlyKeys.has(key)) allowed.add(key);
      delete output[key];
    }
  }
  // Explicit denials survive both legacy credentials and absent active values.
  if (managed.has("RESEND")) output.EMAIL_LIVE_DELIVERY_ENABLED = "false";
  if (managed.has("PAYPAL")) output.PAYMENT_LIVE_ENABLED = "false";
  if (managed.has("YOUSIGN")) output.SIGNATURE_PROVIDER_MODE = "DISABLED";
  if (managed.has("SCANNER")) output.DELIVERY_PROOF_SCANNER_MODE = "DISABLED";
  for (const [key, value] of Object.entries(configuration.values)) {
    if (!allowed.has(key) || typeof value !== "string") throw new Error("PLATFORM_CONFIGURATION_KEY_INVALID");
    output[key] = value;
  }
  // An active sandbox integration must never become a production shortcut.
  if (configuration.environment === "PRODUCTION") {
    if (managed.has("PAYPAL") && output.PAYMENT_LIVE_ENABLED === "true" && output.PAYPAL_ENV !== "live") {
      throw new Error("PAYMENT_PRODUCTION_PROVIDER_REQUIRED");
    }
    if (managed.has("YOUSIGN") && output.SIGNATURE_PROVIDER_MODE === "EXTERNAL" && output.YOUSIGN_ENVIRONMENT !== "live") {
      throw new Error("YOUSIGN_PRODUCTION_PROVIDER_REQUIRED");
    }
  } else {
    if (managed.has("PAYPAL") && output.PAYMENT_LIVE_ENABLED === "true" && output.PAYPAL_ENV !== "sandbox") {
      throw new Error("PAYMENT_SANDBOX_PROVIDER_REQUIRED");
    }
    if (managed.has("YOUSIGN") && output.SIGNATURE_PROVIDER_MODE === "EXTERNAL" && output.YOUSIGN_ENVIRONMENT !== "sandbox") {
      throw new Error("YOUSIGN_SANDBOX_PROVIDER_REQUIRED");
    }
  }
  return output;
}

export async function getPlatformRuntimeEnvironment(base: Record<string, string | undefined> = process.env, sections?: readonly RuntimeConfigurationSection[]): Promise<Record<string, string | undefined>> {
  // Dependency-injected unit adapters and an unprovisioned local install have
  // no private backend. Once any private bootstrap is present, all failures are
  // blocking, including a missing master key; never fall back after a DB error.
  if (!base.SUPABASE_SERVICE_ROLE_KEY && !base.APP_ENCRYPTION_KEY) {
    if (base.NODE_ENV === "production" || ["STAGING", "PRODUCTION"].includes(base.APP_ENV?.trim().toUpperCase() ?? "")) {
      throw new Error("PLATFORM_CONFIGURATION_BOOTSTRAP_REQUIRED");
    }
    return { ...base };
  }
  if (!base.SUPABASE_SERVICE_ROLE_KEY || !base.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("PLATFORM_CONFIGURATION_BOOTSTRAP_REQUIRED");
  }
  const { loadActiveConfigurationEnvironment } = await import("./repository");
  if (sections?.some(section => !Object.hasOwn(sectionKeys, section))) throw new Error("PLATFORM_CONFIGURATION_SECTION_INVALID");
  const configuration = sections
    ? await loadActiveConfigurationEnvironment(base, sections)
    : await loadActiveConfigurationEnvironment(base);
  return applyPlatformConfiguration(base, configuration);
}

/** Used by server routes that need the approved current payment configuration. */
export async function getConfiguredPaymentRuntimeConfig(base: Record<string, string | undefined> = process.env) {
  const { getPaymentRuntimeConfig } = await import("../env");
  return getPaymentRuntimeConfig(await getPlatformRuntimeEnvironment(base, ["PAYPAL"]));
}

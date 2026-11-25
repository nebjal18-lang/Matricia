import { afterEach, describe, expect, it, vi } from "vitest";
import { applyPlatformConfiguration, getPlatformRuntimeEnvironment } from "./runtime";

const staging = (managedSections: string[], values: Record<string,string> = {}) => ({ environment: "STAGING" as const, managedSections, values });
afterEach(() => vi.unstubAllEnvs());

describe("approved Admin configuration runtime", () => {
  it("applies a request-scoped copy without mutating deployment credentials", () => {
    const base = { APP_ENV: "staging", RESEND_API_KEY: "legacy", NEXT_PUBLIC_SUPABASE_URL: "https://staging.example" };
    const next = applyPlatformConfiguration(base, staging(["RESEND"], { RESEND_API_KEY: "approved", EMAIL_LIVE_DELIVERY_ENABLED: "true" }));
    expect(next.RESEND_API_KEY).toBe("approved");
    expect(base.RESEND_API_KEY).toBe("legacy");
    expect(next.NEXT_PUBLIC_SUPABASE_URL).toBe(base.NEXT_PUBLIC_SUPABASE_URL);
    expect(next).not.toBe(base);
  });
  it("does not resurrect deployment email credentials after managed deactivation", () => {
    const next = applyPlatformConfiguration({ APP_ENV: "staging", EMAIL_LIVE_DELIVERY_ENABLED: "true", EMAIL_DELIVERY_MODE: "EXTERNAL", RESEND_API_KEY: "legacy", EMAIL_PROVIDER_TOKEN: "legacy-http", EMAIL_PROVIDER_ENDPOINT: "https://8.8.8.8/send" }, staging(["RESEND"]));
    expect(next).toMatchObject({ EMAIL_LIVE_DELIVERY_ENABLED: "false" });
    expect(next.RESEND_API_KEY).toBeUndefined();
    expect(next.EMAIL_PROVIDER_TOKEN).toBeUndefined();
    expect(next.EMAIL_PROVIDER_ENDPOINT).toBeUndefined();
    expect(next.EMAIL_DELIVERY_MODE).toBeUndefined();
  });
  it("removes old PayPal/demo flags, signer keys and sandbox scanner bypass on disable", () => {
    const next = applyPlatformConfiguration({ APP_ENV: "staging", PAYPAL_CLIENT_SECRET: "old", PAYMENT_PROVIDER: "DEMO", PAYMENT_WEBHOOK_SECRET_DEMO: "old", SIGNATURE_PROVIDER_MODE: "EXTERNAL", YOUSIGN_API_KEY: "old", DELIVERY_PROOF_SCANNER_MODE: "SANDBOX", MALWARE_SCANNER_TOKEN: "old" }, staging(["PAYPAL","YOUSIGN","SCANNER"]));
    expect(next.PAYMENT_LIVE_ENABLED).toBe("false");
    expect(next.PAYMENT_PROVIDER).toBeUndefined();
    expect(next.PAYPAL_CLIENT_SECRET).toBeUndefined();
    expect(next.PAYMENT_WEBHOOK_SECRET_DEMO).toBeUndefined();
    expect(next.SIGNATURE_PROVIDER_MODE).toBe("DISABLED");
    expect(next.YOUSIGN_API_KEY).toBeUndefined();
    expect(next.DELIVERY_PROOF_SCANNER_MODE).toBe("DISABLED");
    expect(next.MALWARE_SCANNER_TOKEN).toBeUndefined();
  });
  it.each(["APP_ENV","SUPABASE_SERVICE_ROLE_KEY","NEXT_PUBLIC_SUPABASE_URL","EMAIL_PROVIDER_ENDPOINT","PAYMENT_WEBHOOK_SECRET_DEMO"])("rejects infrastructure/legacy overposting of %s", key => {
    expect(() => applyPlatformConfiguration({ APP_ENV: "staging" }, staging(["RESEND","PAYPAL"], { [key]: "attacker" }))).toThrow("PLATFORM_CONFIGURATION_KEY_INVALID");
  });
  it("does not apply values belonging to a different unconfigured section", () => {
    expect(() => applyPlatformConfiguration({ APP_ENV: "staging" }, staging(["RESEND"], { PAYPAL_CLIENT_SECRET: "wrong-section" }))).toThrow("PLATFORM_CONFIGURATION_KEY_INVALID");
  });
  it.each(["production","development",undefined])("refuses trusted environment mismatch %s", appEnv => {
    expect(() => applyPlatformConfiguration({ APP_ENV: appEnv }, staging(["RESEND"]))).toThrow("PLATFORM_CONFIGURATION_ENVIRONMENT_MISMATCH");
  });
  it("rejects unknown sections rather than treating them as safe empty settings", () => {
    expect(() => applyPlatformConfiguration({ APP_ENV: "staging" }, staging(["PAYMENT_BYPASS"]))).toThrow("PLATFORM_CONFIGURATION_SECTION_INVALID");
  });
  it("retains unmanaged legacy settings until an Admin section has been created", () => {
    const base = { APP_ENV: "staging", RESEND_API_KEY: "legacy", PAYMENT_PROVIDER: "PAYPAL", PAYPAL_CLIENT_SECRET: "legacy-payment" };
    expect(applyPlatformConfiguration(base, staging(["COMPANY"]))).toEqual(base);
  });
  it("applies only the approved company support address and clears it after deactivation", () => {
    const base = { APP_ENV: "staging", PUBLIC_CONTACT_NOTIFICATION_EMAIL: "old@example.com" };
    expect(applyPlatformConfiguration(base, staging(["COMPANY"], { PUBLIC_CONTACT_NOTIFICATION_EMAIL: "support@new.example" })).PUBLIC_CONTACT_NOTIFICATION_EMAIL).toBe("support@new.example");
    expect(applyPlatformConfiguration(base, staging(["COMPANY"])).PUBLIC_CONTACT_NOTIFICATION_EMAIL).toBeUndefined();
    expect(() => applyPlatformConfiguration(base, staging(["COMPANY"], { RESEND_API_KEY: "wrong-scope" }))).toThrow("PLATFORM_CONFIGURATION_KEY_INVALID");
  });
  it("blocks sandbox providers in production and live providers in staging", () => {
    expect(() => applyPlatformConfiguration({ APP_ENV: "production" }, { environment: "PRODUCTION", managedSections: ["PAYPAL"], values: { PAYMENT_LIVE_ENABLED: "true", PAYPAL_ENV: "sandbox" } })).toThrow("PAYMENT_PRODUCTION_PROVIDER_REQUIRED");
    expect(() => applyPlatformConfiguration({ APP_ENV: "production" }, { environment: "PRODUCTION", managedSections: ["YOUSIGN"], values: { SIGNATURE_PROVIDER_MODE: "EXTERNAL", YOUSIGN_ENVIRONMENT: "sandbox" } })).toThrow("YOUSIGN_PRODUCTION_PROVIDER_REQUIRED");
    expect(() => applyPlatformConfiguration({ APP_ENV: "staging" }, staging(["PAYPAL"], { PAYMENT_LIVE_ENABLED: "true", PAYPAL_ENV: "live" }))).toThrow("PAYMENT_SANDBOX_PROVIDER_REQUIRED");
    expect(() => applyPlatformConfiguration({ APP_ENV: "staging" }, staging(["YOUSIGN"], { SIGNATURE_PROVIDER_MODE: "EXTERNAL", YOUSIGN_ENVIRONMENT: "live" }))).toThrow("YOUSIGN_SANDBOX_PROVIDER_REQUIRED");
  });
  it("permits an independently approved production integration without changing platform identity", () => {
    const next = applyPlatformConfiguration({ APP_ENV: "production" }, { environment: "PRODUCTION", managedSections: ["YOUSIGN","PAYPAL"], values: { SIGNATURE_PROVIDER_MODE: "EXTERNAL", YOUSIGN_ENVIRONMENT: "live", PAYMENT_LIVE_ENABLED: "true", PAYPAL_ENV: "live" } });
    expect(next.APP_ENV).toBe("production");
    expect(next.YOUSIGN_ENVIRONMENT).toBe("live");
  });
  it("does not mutate or share per-request integration keys across concurrent snapshots", async () => {
    const base = { APP_ENV: "staging", RESEND_API_KEY: "old" };
    const results = await Promise.all(["first","second"].map(async value => applyPlatformConfiguration(base, staging(["RESEND"], { RESEND_API_KEY: value }))));
    expect(results.map(row => row.RESEND_API_KEY)).toEqual(["first","second"]);
    expect(base.RESEND_API_KEY).toBe("old");
  });
  it("requires complete bootstrap even if the master key alone is configured", async () => {
    await expect(getPlatformRuntimeEnvironment({ APP_ENCRYPTION_KEY: "configured" })).rejects.toThrow("PLATFORM_CONFIGURATION_BOOTSTRAP_REQUIRED");
    await expect(getPlatformRuntimeEnvironment({ SUPABASE_SERVICE_ROLE_KEY: "configured" })).rejects.toThrow("PLATFORM_CONFIGURATION_BOOTSTRAP_REQUIRED");
  });
  it.each([{NODE_ENV:"production"},{APP_ENV:"production"},{APP_ENV:"staging"}])("fails closed for an unprovisioned deployed runtime %#", async base => {
    await expect(getPlatformRuntimeEnvironment(base)).rejects.toThrow("PLATFORM_CONFIGURATION_BOOTSTRAP_REQUIRED");
  });
  it("returns a copy for an unprovisioned local adapter without a private backend", async () => {
    const base = { EMAIL_DELIVERY_MODE: "DEMO" };
    expect(await getPlatformRuntimeEnvironment(base)).toEqual(base);
    expect(await getPlatformRuntimeEnvironment(base)).not.toBe(base);
  });
});

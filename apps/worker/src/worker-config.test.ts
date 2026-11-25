import { describe, expect, it } from "vitest";
import { readWorkerRuntimeConfig } from "./worker-config";

const base = {
  APP_ENV: "staging",
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
  SUPABASE_SERVICE_ROLE_KEY: "s".repeat(40),
  WORKER_DISPATCH_URL: "https://api.matricia.test/events",
  WORKER_DISPATCH_ALLOWED_HOSTS: "api.matricia.test",
  INTERNAL_WEBHOOK_SECRET: "w".repeat(40),
  MALWARE_SCANNER_TOKEN: "m".repeat(40),
  PORT: "8080",
};

describe("worker runtime configuration", () => {
  it("accepts exact HTTPS service endpoints", () => {
    const config = readWorkerRuntimeConfig(base);
    expect(config.supabaseProjectRef).toBe(base.SUPABASE_PROJECT_REF);
    expect(config.dispatchUrl.origin).toBe("https://api.matricia.test");
    expect(config.port).toBe(8080);
    expect(config.scannerToken).toBe(base.MALWARE_SCANNER_TOKEN);
  });

  it.each([undefined, "", " "])("requires scanner authentication before starting HTTP readiness: %s", (value) => {
    expect(() => readWorkerRuntimeConfig({ ...base, MALWARE_SCANNER_TOKEN: value }))
      .toThrow("WORKER_CONFIG_MALWARE_SCANNER_TOKEN_REQUIRED");
  });

  it.each(["m".repeat(31), "m".repeat(4_097), `${"m".repeat(32)}\n${"m".repeat(32)}`, `${"m".repeat(32)} ${"m".repeat(32)}`, ` ${"m".repeat(32)}`, `${"m".repeat(32)}\n`])("rejects scanner tokens that cannot authenticate a bounded HTTP request", (value) => {
    expect(() => readWorkerRuntimeConfig({ ...base, MALWARE_SCANNER_TOKEN: value }))
      .toThrow("WORKER_CONFIG_MALWARE_SCANNER_TOKEN_INVALID");
  });

  it.each([
    { ...base, NEXT_PUBLIC_SUPABASE_URL: "http://abcdefghijklmnopqrst.supabase.co" },
    { ...base, NEXT_PUBLIC_SUPABASE_URL: "https://evil.example.test" },
    { ...base, SUPABASE_PROJECT_REF: "differentprojectrefxx" },
    { ...base, SUPABASE_PROJECT_REF: "" },
    { ...base, WORKER_DISPATCH_URL: "http://api.matricia.test/events" },
    { ...base, WORKER_DISPATCH_URL: "ftp://api.matricia.test/events" },
    { ...base, WORKER_DISPATCH_URL: "https://other.example.test/events" },
    { ...base, WORKER_DISPATCH_URL: "https://user:pass@api.matricia.test/events" },
    { ...base, PORT: "8080junk" },
  ])("rejects unsafe or ambiguous endpoints", (environment) => {
    expect(() => readWorkerRuntimeConfig(environment)).toThrow(/WORKER_CONFIG_/);
  });

  it("allows HTTP only for an explicit local development dispatch target", () => {
    const config = readWorkerRuntimeConfig({
      ...base,
      APP_ENV: "development",
      WORKER_DISPATCH_URL: "http://127.0.0.1:5173/api/events",
      WORKER_DISPATCH_ALLOWED_HOSTS: "127.0.0.1",
    });
    expect(config.dispatchUrl.protocol).toBe("http:");
  });
});

const local = { ...base, APP_ENV: "development", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_PROJECT_REF: "Matricia", WORKER_LOCAL_SUPABASE_ENABLED: "true", WORKER_LOCAL_SUPABASE_PROJECT_ID: "Matricia" };
it("allows only explicit development access to the exact local Matricia Supabase API", () => {
  expect(readWorkerRuntimeConfig(local)).toMatchObject({ environment: "development", supabaseUrl: "http://127.0.0.1:54321", supabaseProjectRef: "Matricia" });
});
it.each([{ ...local, APP_ENV: "production" }, { ...local, APP_ENV: "staging" }, { ...local, NODE_ENV: "production" }, { ...local, WORKER_LOCAL_SUPABASE_ENABLED: "false" }, { ...local, WORKER_LOCAL_SUPABASE_PROJECT_ID: "Other" }, { ...local, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54322" }, { ...local, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.2:54321" }, { ...local, SUPABASE_PROJECT_REF: "wrong-project" }])("rejects local-mode drift and production/staging bypass", env => {
  expect(() => readWorkerRuntimeConfig(env)).toThrow(/WORKER_CONFIG_/);
});

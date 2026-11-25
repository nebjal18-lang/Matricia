import { describe, expect, it } from "vitest";
import {
  PREVIEW_PRODUCTION_SUPABASE_PROJECT_REF,
  PREVIEW_STAGING_SUPABASE_PROJECT_REF,
  applyPreviewIsolationDefaults,
  assertPreviewIsolation,
} from "./preview-isolation";

const staging = "a".repeat(20), production = "b".repeat(20);
const configured = {
  VERCEL_ENV: "preview", APP_ENV: "staging",
  NEXT_PUBLIC_SUPABASE_URL: `https://${staging}.supabase.co`,
  STAGING_SUPABASE_PROJECT_REF: staging, PRODUCTION_SUPABASE_PROJECT_REF: production,
};

describe("Preview database isolation", () => {
  it("accepts an explicitly isolated staging build", () => {
    expect(() => assertPreviewIsolation(configured)).not.toThrow();
  });
  it("preserves local and production build configuration", () => {
    expect(() => assertPreviewIsolation({})).not.toThrow();
    expect(() => assertPreviewIsolation({ VERCEL_ENV: "production" })).not.toThrow();
  });
  it.each([undefined, "development", "production"])("accepts Preview when APP_ENV=%s if the staging database is isolated", APP_ENV => {
    expect(() => assertPreviewIsolation({ ...configured, APP_ENV })).not.toThrow();
  });
  it.each([
    { STAGING_SUPABASE_PROJECT_REF: undefined },
    { PRODUCTION_SUPABASE_PROJECT_REF: undefined },
    { STAGING_SUPABASE_PROJECT_REF: production },
    { PRODUCTION_SUPABASE_PROJECT_REF: "invalid" },
  ])("requires distinct known references", override => {
    expect(() => assertPreviewIsolation({ ...configured, ...override })).toThrow("PREVIEW_DISTINCT_DATABASE_REFERENCES_REQUIRED");
  });
  it.each([
    `https://${production}.supabase.co`, `https://${staging}.supabase.co.attacker.example`,
    `http://${staging}.supabase.co`, `https://user:password@${staging}.supabase.co`,
    `https://${staging}.supabase.co:8443`, `https://${staging}.supabase.co/rest/v1`,
    `https://${staging}.supabase.co?token=value`, "invalid",
  ])("rejects a wrong or unsafe endpoint without logging it", NEXT_PUBLIC_SUPABASE_URL => {
    expect(() => assertPreviewIsolation({ ...configured, NEXT_PUBLIC_SUPABASE_URL })).toThrow("PREVIEW_STAGING_DATABASE_REQUIRED");
  });
});

describe("Preview isolation defaults", () => {
  it("does not change non-Preview environments", () => {
    const environment = { VERCEL_ENV: "production", APP_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" };
    applyPreviewIsolationDefaults(environment);
    expect(environment).toEqual({ VERCEL_ENV: "production", APP_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" });
  });

  it("fills missing Preview isolation refs and rewrites an inherited production URL", () => {
    const environment = {
      VERCEL_ENV: "preview",
      APP_ENV: "production",
      NEXT_PUBLIC_SUPABASE_URL: `https://${PREVIEW_PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`,
      SUPABASE_URL: `https://${PREVIEW_PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`,
    };
    applyPreviewIsolationDefaults(environment);
    expect(environment.APP_ENV).toBe("staging");
    expect(environment.STAGING_SUPABASE_PROJECT_REF).toBe(PREVIEW_STAGING_SUPABASE_PROJECT_REF);
    expect(environment.PRODUCTION_SUPABASE_PROJECT_REF).toBe(PREVIEW_PRODUCTION_SUPABASE_PROJECT_REF);
    expect(environment.NEXT_PUBLIC_SUPABASE_URL).toBe(`https://${PREVIEW_STAGING_SUPABASE_PROJECT_REF}.supabase.co`);
    expect(environment.SUPABASE_URL).toBe(`https://${PREVIEW_STAGING_SUPABASE_PROJECT_REF}.supabase.co`);
    expect(() => assertPreviewIsolation({
      VERCEL_ENV: environment.VERCEL_ENV,
      APP_ENV: environment.APP_ENV,
      NEXT_PUBLIC_SUPABASE_URL: environment.NEXT_PUBLIC_SUPABASE_URL,
      STAGING_SUPABASE_PROJECT_REF: environment.STAGING_SUPABASE_PROJECT_REF,
      PRODUCTION_SUPABASE_PROJECT_REF: environment.PRODUCTION_SUPABASE_PROJECT_REF,
    })).not.toThrow();
  });

  it("replaces a Preview production ref that collides with staging", () => {
    const environment = {
      VERCEL_ENV: "preview",
      STAGING_SUPABASE_PROJECT_REF: PREVIEW_STAGING_SUPABASE_PROJECT_REF,
      PRODUCTION_SUPABASE_PROJECT_REF: PREVIEW_STAGING_SUPABASE_PROJECT_REF,
      NEXT_PUBLIC_SUPABASE_URL: `https://${PREVIEW_STAGING_SUPABASE_PROJECT_REF}.supabase.co`,
    };
    applyPreviewIsolationDefaults(environment);
    expect(environment.PRODUCTION_SUPABASE_PROJECT_REF).toBe(PREVIEW_PRODUCTION_SUPABASE_PROJECT_REF);
  });
});

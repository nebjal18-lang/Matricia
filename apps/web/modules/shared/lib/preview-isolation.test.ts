import { describe, expect, it } from "vitest";
import { assertPreviewIsolation } from "./preview-isolation";

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
  it.each([undefined, "development", "production"])("rejects an inherited APP_ENV=%s", APP_ENV => {
    expect(() => assertPreviewIsolation({ ...configured, APP_ENV })).toThrow("PREVIEW_STAGING_ENVIRONMENT_REQUIRED");
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

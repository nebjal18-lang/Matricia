import { describe, expect, it } from "vitest";
import { resolvePublicSupabaseEnvironment } from "./public-supabase-environment";

const url = "https://project.example.invalid";
const publicKey = "sb_publishable_synthetic_configuration_test";
const jwt = (role: string) => `e30.${btoa(JSON.stringify({ role }))}.synthetic-signature`;

describe("public Supabase configuration", () => {
  it("keeps canonical values ahead of aliases and trims whitespace", () => {
    expect(resolvePublicSupabaseEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: ` ${url} `, SUPABASE_URL: "https://other.example.invalid",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ` ${publicKey} `,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "unused-public-alias",
    })).toEqual({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey });
  });
  it.each(["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"] as const)("accepts the public integration alias %s", name => {
    expect(resolvePublicSupabaseEnvironment({ SUPABASE_URL: url, [name]: publicKey }))
      .toEqual({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey });
  });
  it("skips blank canonical values and prefers a publishable alias to a legacy alias", () => {
    expect(resolvePublicSupabaseEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: " ", SUPABASE_URL: url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: " ",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: publicKey,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "unused-public-alias",
    }).NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe(publicKey);
  });
  it("explains missing variables without accepting a service key as fallback", () => {
    expect(() => resolvePublicSupabaseEnvironment({})).toThrow("PUBLIC_SUPABASE_CONFIGURATION_MISSING");
    const input = { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: "synthetic-private-value" };
    expect(() => resolvePublicSupabaseEnvironment(input)).toThrow("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    try { resolvePublicSupabaseEnvironment(input); } catch (error) {
      expect(String(error)).not.toContain(input.SUPABASE_SERVICE_ROLE_KEY);
    }
  });
  it.each(["not-a-url", "javascript:alert(1)", "https://user:password@example.invalid"])("rejects an invalid or credential-bearing URL", value => {
    expect(() => resolvePublicSupabaseEnvironment({ NEXT_PUBLIC_SUPABASE_URL: value, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey })).toThrow("PUBLIC_SUPABASE_URL_INVALID");
  });
  it("accepts an anonymous legacy JWT", () => {
    expect(resolvePublicSupabaseEnvironment({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("anon") }).NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe(jwt("anon"));
  });
  it.each(["sb_secret_synthetic_private_value", jwt("service_role"), jwt("authenticated"), "e30.invalid-json.signature"])("refuses privileged or malformed keys without printing them", value => {
    let error: unknown;
    try { resolvePublicSupabaseEnvironment({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: value }); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).not.toContain(value);
    expect(String(error)).toMatch(/PUBLIC_SUPABASE_/);
  });
});

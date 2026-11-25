import { describe, expect, it } from "vitest";
import { hasSupabaseAuthCookie } from "./session-cookie";

describe("hasSupabaseAuthCookie", () => {
  it("detects chunked and project-scoped Supabase auth cookies", () => {
    expect(hasSupabaseAuthCookie([{ name: "sb-xxxx-auth-token" }])).toBe(true);
    expect(hasSupabaseAuthCookie([{ name: "sb-xxxx-auth-token.0" }])).toBe(true);
    expect(hasSupabaseAuthCookie([{ name: "matricia.workspace" }, { name: "matricia_locale" }])).toBe(false);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildDemoAbuseCases,
  buildDemoAbuseRules,
  canApplyAdminDemoAntiAbuse,
} from "./demo-anti-abuse";

describe("demo anti-abus", () => {
  afterEach(() => {
    delete process.env.MATRICIA_DEMO_ACCESS_ENABLED;
    delete process.env.APP_ENV;
  });

  it("reste masqué hors flag / en production", () => {
    process.env.APP_ENV = "development";
    expect(canApplyAdminDemoAntiAbuse()).toBe(false);
    process.env.MATRICIA_DEMO_ACCESS_ENABLED = "true";
    expect(canApplyAdminDemoAntiAbuse()).toBe(true);
    process.env.APP_ENV = "production";
    expect(canApplyAdminDemoAntiAbuse()).toBe(false);
  });

  it("fournit règles versionnées et cas OPEN", () => {
    const rules = buildDemoAbuseRules();
    const cases = buildDemoAbuseCases();
    expect(rules).toHaveLength(4);
    expect(cases).toHaveLength(5);
    expect(rules.every((row) => /^[A-Z][A-Z0-9_]+$/u.test(row.rule_code))).toBe(true);
    expect(cases.every((row) => row.status === "OPEN")).toBe(true);
    expect(cases.every((row) => row.subject_hash.length === 64)).toBe(true);
  });

  it("branche la page anti-abus sur l’overlay", () => {
    const page = readFileSync(
      fileURLToPath(new URL("../../../../app/[locale]/administration/anti-abus/page.tsx", import.meta.url)),
      "utf8",
    );
    expect(page).toContain("canApplyAdminDemoAntiAbuse");
    expect(page).toContain("buildDemoAbuseRules");
    expect(page).toContain("buildDemoAbuseCases");
  });
});

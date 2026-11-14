import { describe, expect, it } from "vitest";
import { demoPersonaEmail, isPublicDemoAccessEnabled } from "./demo-policy";

describe("public demo access", () => {
  it("refuse toujours la démo en production (APP_ENV ou Vercel)", () => {
    expect(isPublicDemoAccessEnabled({ VERCEL_ENV: "production", MATRICIA_DEMO_ACCESS_ENABLED: "true", APP_ENV: "production" })).toBe(false);
    expect(isPublicDemoAccessEnabled({ VERCEL_ENV: "production", MATRICIA_DEMO_ACCESS_ENABLED: "true", APP_ENV: "development" })).toBe(false);
    expect(isPublicDemoAccessEnabled({ MATRICIA_DEMO_ACCESS_ENABLED: "true", APP_ENV: "production" })).toBe(false);
    expect(isPublicDemoAccessEnabled({ VERCEL_ENV: "production", APP_ENV: "production" })).toBe(false);
  });

  it("n’autorise preview/local que si le flag est actif et APP_ENV non-prod explicite", () => {
    expect(isPublicDemoAccessEnabled({ VERCEL_ENV: "preview", APP_ENV: "production" })).toBe(false);
    expect(isPublicDemoAccessEnabled({ VERCEL_ENV: "preview", MATRICIA_DEMO_ACCESS_ENABLED: "true", APP_ENV: "production" })).toBe(false);
    expect(isPublicDemoAccessEnabled({ VERCEL_ENV: "preview", MATRICIA_DEMO_ACCESS_ENABLED: "true" })).toBe(false);
    expect(isPublicDemoAccessEnabled({ VERCEL_ENV: "preview", MATRICIA_DEMO_ACCESS_ENABLED: "true", APP_ENV: "staging" })).toBe(true);
    expect(isPublicDemoAccessEnabled({ MATRICIA_DEMO_ACCESS_ENABLED: "true", APP_ENV: "development" })).toBe(true);
    expect(isPublicDemoAccessEnabled({ MATRICIA_DEMO_ACCESS_ENABLED: "true", APP_ENV: "test" })).toBe(true);
    expect(isPublicDemoAccessEnabled({})).toBe(false);
  });

  it("utilise le courriel de démonstration prévu pour chaque rôle", () => {
    expect(demoPersonaEmail("client", {})).toBe("demo.client@matricia.test");
    expect(demoPersonaEmail("provider", {})).toBe("demo.prestataire@matricia.test");
    expect(demoPersonaEmail("franchise", { MATRICIA_DEMO_FRANCHISE_EMAIL: " franchise@example.test " })).toBe("franchise@example.test");
  });
});

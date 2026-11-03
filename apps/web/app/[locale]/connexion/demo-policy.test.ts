import { describe, expect, it } from "vitest";
import { demoPersonaEmail, isPublicDemoAccessEnabled } from "./demo-policy";

describe("public demo access", () => {
  it("affiche les boutons sur l’aperçu Vercel et en développement", () => {
    expect(isPublicDemoAccessEnabled({ VERCEL_ENV: "preview", APP_ENV: "production" })).toBe(true);
    expect(isPublicDemoAccessEnabled({ MATRICIA_DEMO_ACCESS_ENABLED: "true", APP_ENV: "development" })).toBe(true);
    expect(isPublicDemoAccessEnabled({ MATRICIA_DEMO_ACCESS_ENABLED: "true", APP_ENV: "production" })).toBe(false);
    expect(isPublicDemoAccessEnabled({})).toBe(false);
  });

  it("active explicitement le déploiement principal Vercel uniquement pour une instance de démonstration", () => {
    for (const APP_ENV of ["development", "staging"]) {
      expect(isPublicDemoAccessEnabled({ VERCEL_ENV: "production", MATRICIA_DEMO_ACCESS_ENABLED: "true", APP_ENV })).toBe(true);
      expect(isPublicDemoAccessEnabled({ VERCEL_ENV: "production", APP_ENV })).toBe(false);
    }
    for (const APP_ENV of ["production", undefined, ""]) {
      expect(isPublicDemoAccessEnabled({ VERCEL_ENV: "production", MATRICIA_DEMO_ACCESS_ENABLED: "true", APP_ENV })).toBe(false);
    }
  });

  it("utilise le courriel de démonstration prévu pour chaque rôle", () => {
    expect(demoPersonaEmail("client", {})).toBe("demo.client@matricia.test");
    expect(demoPersonaEmail("provider", {})).toBe("demo.prestataire@matricia.test");
    expect(demoPersonaEmail("franchise", { MATRICIA_DEMO_FRANCHISE_EMAIL: " franchise@example.test " })).toBe("franchise@example.test");
  });
});
